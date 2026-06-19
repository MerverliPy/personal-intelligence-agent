// ---------------------------------------------------------------------------
// Conversation detail page (P3-T09)
// ---------------------------------------------------------------------------
// Renders the message thread for a conversation, opens an SSE stream
// for the latest run, renders streamed deltas + citations, opens the
// citation preview modal on chip activation, and hosts the feedback
// form on each assistant message.
//
// SECURITY: All user-supplied content is HTML-escaped at render time
// by the helpers in `conversation-shared.ts`. The original message
// DOM is never mutated by feedback submission; the feedback form is
// a sibling element with its own submit handler.
// ---------------------------------------------------------------------------

import { pageShell } from './shared.js';

/**
 * Server-rendered HTML for the conversation detail page.
 */
export function conversationDetailPage(
  workspaceId: string,
  workspaceName: string,
  conversationId: string,
): string {
  const bodyHtml = `
<div class="conversation-layout">
<section aria-labelledby="conversation-title-heading">
  <h2 id="conversation-title-heading">Conversation</h2>
  <div id="run-state-container" aria-live="polite"></div>
</section>

<div class="message-thread-section">
  <div id="message-thread" role="log" aria-live="polite" aria-relevant="additions">
    <p class="loading">Loading messages…</p>
  </div>
</div>

<form id="message-form" class="message-form" aria-label="Send a message">
  <div class="message-form__row">
    <label for="message-content" class="sr-only">Your message</label>
    <textarea id="message-content" name="content" rows="1" required
      placeholder="Ask a question, or request research / analysis / planning."
      oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight, 200)+'px'"></textarea>
    <button type="submit" class="btn btn-primary send-btn">Send</button>
  </div>
</form>

<div id="citation-sheet" class="citation-sheet" role="dialog" aria-modal="true" aria-labelledby="citation-modal-title" hidden>
  <div class="citation-sheet__panel">
    <dialog id="citation-modal" class="citation-modal" aria-labelledby="citation-modal-title"></dialog>
  </div>
</div>
</div>
`;

  const bodyScript = `
const WORKSPACE_ID = ${JSON.stringify(workspaceId)};
window.__piaWorkspaceId = WORKSPACE_ID;
const CONVERSATION_ID = ${JSON.stringify(conversationId)};

let activeEventSource = null;
let citationModal = null;

async function loadMessages() {
  var thread = document.getElementById('message-thread');
  try {
    var data = await apiFetch('/v1/workspaces/' + WORKSPACE_ID + '/conversations/' + CONVERSATION_ID + '/messages');
    var items = (data && data.items) || [];
    if (items.length === 0) {
      thread.innerHTML = '<p class="empty">No messages yet. Send one above.</p>';
      return;
    }
    thread.innerHTML = items.map(function(msg) {
      return renderMessageClient(msg, true);
    }).join('');
    wireCitationChips();
    wireFeedbackForms();
  } catch (err) {
    thread.innerHTML = '<p class="empty">Could not load messages.</p>';
  }
}

// Client-side mirror of renderMessage (kept inline so the page works
// without bundling). The server-rendered thread for the initial
// message list is handled by the page-level code.
function renderMessageClient(msg, feedbackEnabled) {
  const roleClass = 'message message-' + String(msg.role).toLowerCase();
  const id = escapeHtml(msg.id);
  const role = escapeHtml(msg.role);
  const content = escapeHtml(msg.content || '');
  const created = escapeHtml(msg.created_at || '');
  const feedback = (msg.role === 'ASSISTANT' && feedbackEnabled) ? renderFeedbackFormClient(id) : '';
  return '<article class="' + roleClass + '" data-message-id="' + id + '" aria-label="' + role + ' message">' +
    '<div class="message-content">' + content + '</div>' +
    '<div class="message-meta"><time datetime="' + created + '">' + created + '</time></div>' +
    '<div class="message-citations" data-message-id="' + id + '"></div>' +
    feedback +
  '</article>';
}

function renderFeedbackFormClient(messageId) {
  // The server-rendered form is shipped with the page shell; the
  // client mirrors the same shape for messages added via SSE.
  var options = ['POSITIVE','NEGATIVE','INCORRECT','INCOMPLETE','CITATION_ISSUE','STYLE_ISSUE','UNSAFE','FREE_TEXT']
    .map(function(c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
  return '<form class="feedback-form" data-message-id="' + messageId + '" aria-label="Submit feedback for this message">' +
    '<label for="feedback-category-' + messageId + '">Category</label>' +
    '<select id="feedback-category-' + messageId + '" name="category" required>' +
    '<option value="" disabled selected>Select a category…</option>' +
    options + '</select>' +
    '<label for="feedback-correction-' + messageId + '">Correction (optional)</label>' +
    '<textarea id="feedback-correction-' + messageId + '" name="correction" rows="3" maxlength="4096"></textarea>' +
    '<label for="feedback-notes-' + messageId + '">Notes (optional)</label>' +
    '<textarea id="feedback-notes-' + messageId + '" name="notes" rows="2" maxlength="4096"></textarea>' +
    '<button type="submit" class="btn btn-primary">Submit feedback</button>' +
    '<output class="feedback-status" aria-live="polite"></output>' +
  '</form>';
}

function renderCitationChipClient(citation, index) {
  var label = 'Citation ' + (index + 1) + ': ' + String(citation.claim_text || '').slice(0, 80);
  return '<button type="button" class="citation-chip" data-citation-id="' + escapeHtml(citation.id) +
    '" aria-label="' + escapeHtml(label) + '" aria-haspopup="dialog">[' + (index + 1) + ']</button>';
}

function wireFeedbackForms() {
  var forms = document.querySelectorAll('form.feedback-form');
  forms.forEach(function(form) {
    if (form.dataset.wired === '1') return;
    form.dataset.wired = '1';
    form.addEventListener('submit', function(ev) {
      ev.preventDefault();
      submitFeedback(form);
    });
  });
}

function wireCitationChips() {
  var chips = document.querySelectorAll('.citation-chip');
  chips.forEach(function(chip) {
    if (chip.dataset.wired === '1') return;
    chip.dataset.wired = '1';
    chip.addEventListener('click', function() { openCitationModal(chip.dataset.citationId); });
  });
}

async function submitFeedback(form) {
  var status = form.querySelector('.feedback-status');
  var messageId = form.dataset.messageId;
  var category = form.querySelector('select[name=category]').value;
  var correction = form.querySelector('textarea[name=correction]').value;
  var notes = form.querySelector('textarea[name=notes]').value;
  var payload = { category: category };
  if (correction) payload.correction = correction;
  if (notes) payload.notes = notes;
  try {
    var result = await apiFetch(
      '/v1/workspaces/' + WORKSPACE_ID + '/messages/' + messageId + '/feedback',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }
    );
    var sug = (result && result.suggestion) || {};
    var sugText = sug.category
      ? 'Stored suggestion: ' + sug.category + ' (confidence ' + (sug.confidence || 0) + ').'
      : 'Feedback submitted (no failure class suggested).';
    status.textContent = sugText;
    announce('Feedback submitted for message ' + messageId);
  } catch (err) {
    status.textContent = 'Error: ' + err.message;
  }
}

async function openCitationModal(citationId) {
  // PIA-MUR-D-004-IMPL commit 6 + critique fix: slide-up sheet
  // animation uses a three-phase approach (remove hidden, wait for
  // paint, add .sheet-open class) to allow CSS transitions to fire.
  var sheet = document.getElementById('citation-sheet');
  var modal = document.getElementById('citation-modal');
  if (!sheet || !modal) return;
  var citations = (window.__piaCitations && window.__piaCitations[citationId]) || null;
  if (!citations) {
    modal.innerHTML = '<p>Citation details are no longer available.</p>';
  } else {
    modal.innerHTML = renderCitationModalBodyClient(citations);
  }
  // Store trigger (the citation chip that was clicked) for focus restoration
  if (__piaSheetTrigger === undefined) __piaSheetTrigger = null;
  __piaSheetTrigger = document.querySelector('.citation-chip[data-citation-id="' + citationId + '"]');
  // Three-phase slide-up animation
  sheet.hidden = false;
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      sheet.classList.add('sheet-open');
      // Focus the first focusable element inside the sheet
      var firstFocusable = sheet.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (firstFocusable) firstFocusable.focus();
    });
  });
}

function closeCitationModal() {
  var sheet = document.getElementById('citation-sheet');
  if (!sheet) return;
  sheet.classList.remove('sheet-open');
  var done = function() {
    sheet.removeEventListener('transitionend', done);
    sheet.hidden = true;
    if (__piaSheetTrigger) {
      __piaSheetTrigger.focus();
      __piaSheetTrigger = null;
    }
  };
  sheet.addEventListener('transitionend', done);
}

// Esc key closes the citation sheet. Tab cycles within it.
// Backdrop click dismisses the citation sheet.
document.addEventListener('keydown', function(ce) {
  var sheet = document.getElementById('citation-sheet');
  if (!sheet || !!sheet.hidden) return;
  if (ce.key === 'Escape') { closeCitationModal(); return; }
  trapTabIn(sheet, ce);
});
var citationSheet = document.getElementById('citation-sheet');
if (citationSheet) {
  citationSheet.addEventListener('click', function(ce) {
    if (ce.target === this) closeCitationModal();
  });
}

function renderCitationModalBodyClient(citation) {
  var locator = citation.source_locator || {};
  var locatorText;
  if (typeof locator.page === 'number') locatorText = 'page ' + locator.page;
  else if (typeof locator.ordinal === 'number') locatorText = (locator.type || 'position') + ' ' + locator.ordinal;
  else locatorText = JSON.stringify(locator);
  return '<div class="citation-modal-body">' +
    '<h3 id="citation-modal-title">Citation</h3>' +
    '<dl class="citation-meta">' +
    '<dt>Source</dt><dd>' + escapeHtml(citation.document_version_id) + '</dd>' +
    '<dt>Locator</dt><dd>' + escapeHtml(locatorText) + '</dd>' +
    '<dt>Verification</dt><dd>' + escapeHtml(citation.verification_status) + '</dd>' +
    '</dl>' +
    '<h4>Claim</h4>' +
    '<blockquote class="citation-claim">' + escapeHtml(citation.claim_text || '') + '</blockquote>' +
  '</div>';
}

function openRunStream(runId) {
  if (activeEventSource) {
    try { activeEventSource.close(); } catch (e) { /* ignore */ }
    activeEventSource = null;
  }
  // Use fetch + ReadableStream because EventSource does not send
  // credentials (cookies) reliably across all browsers. The server
  // emits text/event-stream.
  fetch('/v1/workspaces/' + WORKSPACE_ID + '/conversations/' + CONVERSATION_ID + '/events?run_id=' + encodeURIComponent(runId), {
    credentials: 'same-origin',
    headers: { 'accept': 'text/event-stream' },
  }).then(function(res) {
    if (!res.ok || !res.body) {
      showError('Stream failed: HTTP ' + res.status);
      return;
    }
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    function pump() {
      return reader.read().then(function(r) {
        if (r.done) return;
        buffer += decoder.decode(r.value, { stream: true });
        var parsed = parseSseStreamClient(buffer);
        buffer = parsed.remainder;
        for (var i = 0; i < parsed.events.length; i++) {
          handleSseEvent(parsed.events[i]);
        }
        return pump();
      });
    }
    return pump();
  }).catch(function(err) {
    showError('Stream error: ' + err.message);
  });
}

// Client-side SSE parser (mirrors the one in conversation-shared.ts).
// Kept inline because the page is rendered as a single ES module
// without bundling, so we cannot import from another module.
function parseSseStreamClient(buffer) {
  var events = [];
  var SEP_RE = /\\r?\\n\\r?\\n/;
  var cursor = 0;
  var workingRemainder = '';
  while (cursor < buffer.length) {
    var slice = buffer.slice(cursor);
    var sepMatch = SEP_RE.exec(slice);
    if (!sepMatch) {
      workingRemainder = slice;
      break;
    }
    var blockEnd = cursor + sepMatch.index;
    var sepLen = sepMatch[0].length;
    var block = buffer.slice(cursor, blockEnd);
    var parsed = parseSseBlockClient(block);
    if (parsed) events.push(parsed);
    cursor = blockEnd + sepLen;
  }
  return { events: events, remainder: workingRemainder };
}

function parseSseBlockClient(block) {
  var eventName = null;
  var dataLines = [];
  var lines = block.split(/\\r?\\n/);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.length === 0) continue;
    if (line.charAt(0) === ':') continue;
    var colonIdx = line.indexOf(':');
    var field, value;
    if (colonIdx === -1) { field = line; value = ''; }
    else {
      field = line.slice(0, colonIdx);
      value = line.slice(colonIdx + 1);
      if (value.charAt(0) === ' ') value = value.slice(1);
    }
    if (field === 'event') eventName = value;
    else if (field === 'data') dataLines.push(value);
  }
  if (dataLines.length === 0) return null;
  return { event: eventName || 'message', data: dataLines.join('\\n') };
}

function handleSseEvent(ev) {
  // Server emits named events (event: run.started, response.delta, etc.).
  // Accept any event with a parseable JSON data payload — the inner
  // data.type drives the UI branches below.
  var data;
  try { data = JSON.parse(ev.data); } catch (e) { return; }
  if (!data || typeof data !== 'object') return;
  var type = data.type;
  var container = document.getElementById('run-state-container');
  if (type === 'run.started') {
    container.innerHTML = renderRunStateBadge('STREAMING');
    return;
  }
  if (type === 'response.delta') {
    appendAssistantDelta(data.text || '');
    return;
  }
  if (type === 'citation.provisional') {
    registerCitation(data);
    return;
  }
  if (type === 'response.completed') {
    container.innerHTML = renderRunStateBadge('COMPLETED');
    announce('Response completed.');
    return;
  }
  if (type === 'run.failed') {
    container.innerHTML = renderRunStateBadge('FAILED');
    var msg = (data.error && data.error.message) || 'Run failed.';
    showError(msg);
    return;
  }
  // Unknown event types are ignored.
}

function appendAssistantDelta(text) {
  var thread = document.getElementById('message-thread');
  var last = thread.querySelector('article.message-assistant:last-of-type .message-content');
  if (!last) {
    // No assistant message yet; create one.
    var msgId = 'streaming-' + Date.now();
    var html = '<article class="message message-assistant" data-message-id="' + msgId + '" aria-label="Assistant message"><div class="message-content"></div></article>';
    thread.insertAdjacentHTML('beforeend', html);
    last = thread.querySelector('article.message-assistant:last-of-type .message-content');
  }
  // SECURITY: text from the model is untrusted. We render via
  // textContent (never innerHTML) so the browser escapes it.
  last.textContent += text;
}

function registerCitation(c) {
  if (!window.__piaCitations) window.__piaCitations = {};
  window.__piaCitations[c.id] = c;
  var container = document.querySelector('.message-citations[data-message-id="' + c.message_id + '"]');
  if (!container) return;
  var index = container.querySelectorAll('.citation-chip').length;
  container.insertAdjacentHTML('beforeend', renderCitationChipClient(c, index));
  wireCitationChips();
}

function renderRunStateBadge(state) {
  var map = {
    CREATED: ['badge-pending','Created'],
    STREAMING: ['badge-processing','Streaming'],
    COMPLETED: ['badge-ready','Completed'],
    CANCELLED: ['badge-quarantined','Cancelled'],
    FAILED: ['badge-failed','Failed'],
    INTERRUPTED: ['badge-quarantined','Interrupted'],
  };
  var m = map[state] || ['badge-pending', state];
  return '<span class="badge ' + m[0] + '" role="status" aria-label="' + m[1] + '">' + m[1] + '</span>';
}

// Server-rendered renderRunStateBadge is used for the initial paint.
// The client-side helper above handles post-load updates. The
// server-side helper is exported for tests.

document.getElementById('message-form').addEventListener('submit', async function(ev) {
  ev.preventDefault();
  var content = document.getElementById('message-content').value.trim();
  if (!content) return;
  try {
    var result = await apiFetch(
      '/v1/workspaces/' + WORKSPACE_ID + '/conversations/' + CONVERSATION_ID + '/messages',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: content }) }
    );
    document.getElementById('message-content').value = '';
    var thread = document.getElementById('message-thread');
    thread.insertAdjacentHTML('beforeend',
      '<article class="message message-user" data-message-id="' + escapeHtml(result.user_message_id) + '" aria-label="User message"><div class="message-content">' + escapeHtml(content) + '</div></article>'
    );
    var runId = (result && (result.id || (result.run && result.run.id))) || null;
    if (runId) openRunStream(runId);
  } catch (err) {
    showError('Failed to send message: ' + err.message);
  }
});

loadMessages();
`;

  return pageShell({
    title: 'Conversation',
    workspaceId,
    workspaceName,
    tabActive: 'conversations',
    bodyHtml,
    bodyScript,
  });
}
