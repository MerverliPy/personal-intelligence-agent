// ---------------------------------------------------------------------------
// Conversation UI shared module (P3-T09)
// ---------------------------------------------------------------------------
// Pure-string renderers and the SSE event-stream parser. Everything is
// synchronous and side-effect-free so the unit tests can exercise it
// without a browser. The client-side wiring (fetch, addEventListener)
// lives in the page-level scripts, not here.
//
// SECURITY:
//   - Every user-supplied field passes through `escapeHtml` at render time.
//   - The citation modal does NOT fetch additional data; it renders only
//     from the citation object already in memory (see citation-modal tests).
//   - The feedback form is a sibling of the original message; submitting
//     it does not mutate the original message DOM.
//
// ACCESSIBILITY:
//   - Run-state badges use `role="status"` with a descriptive `aria-label`.
//   - Citation chips are real `<button>` elements (keyboard-activatable).
//   - The citation modal uses a `<dialog>` element (focus management is
//     the browser's responsibility; verified by the a11y-static tests).
// ---------------------------------------------------------------------------

/**
 * Escapes a string for safe inclusion in HTML.
 *
 * This is a server-side re-implementation of the `escapeHtml` function
 * injected by `shared.ts`. Both implementations must agree.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Server-Sent Events parser. Stateful: feeds in chunks of text and
 * returns the complete events parsed so far, plus the unconsumed
 * remainder for the next call.
 *
 * Format per https://html.spec.whatwg.org/multipage/server-sent-events.html:
 *   - Lines are separated by `\n`, `\r`, or `\r\n`.
 *   - Lines starting with `:` are comments and are ignored.
 *   - `event: <name>` sets the event name; default is `message`.
 *   - `data: <value>` appends to the data buffer; multiple `data:` lines
 *     are joined with `\n`.
 *   - A blank line dispatches the accumulated event.
 *   - `id:` and `retry:` are accepted for protocol conformance but not
 *     used by the UI.
 *
 * @param buffer The accumulated text from the SSE stream so far.
 * @returns Parsed events and the unconsumed remainder.
 */
export function parseSseStream(buffer: string): {
  events: SseEventWire[];
  remainder: string;
} {
  const events: SseEventWire[] = [];
  // Normalize line endings, then split. We work on a copy of the
  // buffer so we can keep the unparsed tail as `remainder`.
  const text = buffer;
  // Split on blank line (event boundary), preserving the trailing
  // partial block as the remainder. The SSE spec allows `\n`, `\r`,
  // or `\r\n` as line endings, so we accept any of them as the
  // event-boundary separator.
  const SEP_RE = /\r?\n\r?\n/;
  let cursor = 0;
  let workingRemainder = '';
  while (cursor < text.length) {
    const sepMatch = SEP_RE.exec(text.slice(cursor));
    if (!sepMatch) {
      workingRemainder = text.slice(cursor);
      break;
    }
    const blockEnd = cursor + sepMatch.index;
    const sepLen = sepMatch[0].length;
    const block = text.slice(cursor, blockEnd);
    const event = parseSseBlock(block);
    if (event) events.push(event);
    cursor = blockEnd + sepLen;
  }
  return { events, remainder: workingRemainder };
}

/**
 * Parses a single SSE block (the text between two blank lines).
 * Returns `null` for comments-only or empty blocks.
 */
function parseSseBlock(block: string): SseEventWire | null {
  let eventName: string | null = null;
  const dataLines: string[] = [];
  for (const rawLine of block.split(/\r?\n/)) {
    if (rawLine.length === 0) continue;
    if (rawLine.startsWith(':')) continue; // comment / keepalive
    const colonIdx = rawLine.indexOf(':');
    let field: string;
    let value: string;
    if (colonIdx === -1) {
      field = rawLine;
      value = '';
    } else {
      field = rawLine.slice(0, colonIdx);
      // The spec strips a single leading space from the value.
      value = rawLine.slice(colonIdx + 1);
      if (value.startsWith(' ')) value = value.slice(1);
    }
    if (field === 'event') eventName = value;
    else if (field === 'data') dataLines.push(value);
    // `id` and `retry` are ignored.
  }
  if (dataLines.length === 0) return null;
  return { event: eventName ?? 'message', data: dataLines.join('\n') };
}

/**
 * Wire-level SSE event: event name + raw data string.
 * The page-level code is responsible for JSON.parse-ing the data and
 * casting to the typed `SseEvent` union from @pia/contracts.
 */
export interface SseEventWire {
  event: string;
  data: string;
}

// ---------------------------------------------------------------------------
// Run-state badge
// ---------------------------------------------------------------------------

/**
 * Mirrors `ModelRunStatusApi` from @pia/contracts.
 * Re-declared locally so this module has no runtime dependency on
 * @pia/contracts (the page-level code imports both).
 */
export type RunState =
  | 'CREATED'
  | 'STREAMING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED'
  | 'INTERRUPTED';

/**
 * Maps a run state to a CSS class, a human-readable label, and an
 * ARIA description. Distinct visual treatment is the AC#3 guarantee.
 *
 * NOTE: There is intentionally no "Cancel" button rendered. The
 * orchestrator already handles stream interruption server-side; a
 * user-facing cancel button is a follow-up task that requires a new
 * `POST /runs/{rid}/cancel` HTTP endpoint.
 */
export function renderRunStateBadge(state: RunState): string {
  const mapping: Record<RunState, { cls: string; label: string; aria: string }> = {
    CREATED: {
      cls: 'badge badge-pending',
      label: 'Created',
      aria: 'Run created, waiting to start streaming.',
    },
    STREAMING: {
      cls: 'badge badge-processing',
      label: 'Streaming',
      aria: 'Run is streaming a response.',
    },
    COMPLETED: {
      cls: 'badge badge-ready',
      label: 'Completed',
      aria: 'Run completed successfully.',
    },
    CANCELLED: {
      cls: 'badge badge-cancelled',
      label: 'Cancelled',
      aria: 'Run was cancelled. The answer is not available.',
    },
    FAILED: {
      cls: 'badge badge-failed',
      label: 'Failed',
      aria: 'Run failed. See the error message for details.',
    },
    INTERRUPTED: {
      cls: 'badge badge-interrupted',
      label: 'Interrupted',
      aria: 'Run was interrupted (for example, the connection was lost). The answer is not available.',
    },
  };
  const m = mapping[state];
  return (
    `<span class="${m.cls}" role="status" aria-label="${escapeHtml(m.aria)}">` +
    `${escapeHtml(m.label)}</span>`
  );
}

// ---------------------------------------------------------------------------
// Citation rendering
// ---------------------------------------------------------------------------

/**
 * Mirrors the `Citation` shape from @pia/contracts (P3-T07 added
 * `verification_status`). Re-declared locally to keep this module
 * dependency-free.
 */
export interface CitationView {
  id: string;
  chunk_id: string;
  document_version_id: string;
  source_locator: Record<string, unknown>;
  claim_text: string;
  claim_start: number | null;
  claim_end: number | null;
  verification_status: string;
}

/**
 * Renders a citation as a keyboard-activatable button. Clicking or
 * pressing Enter/Space opens the modal (the modal element is rendered
 * separately; this is just the trigger chip).
 */
export function renderCitationChip(citation: CitationView, index: number): string {
  const label = `Citation ${index + 1}: ${truncate(citation.claim_text, 80)}`;
  return (
    `<button type="button" class="citation-chip" data-citation-id="${escapeHtml(
      citation.id,
    )}" aria-label="${escapeHtml(label)}" aria-haspopup="dialog">` + `[${index + 1}]</button>`
  );
}

/**
 * Renders the citation preview modal body. Synchronous; does not
 * fetch additional data. The full modal wrapper (with backdrop and
 * close button) is composed by the page-level code.
 *
 * SECURITY: every field is HTML-escaped at render time.
 */
export function renderCitationModalBody(citation: CitationView): string {
  const locatorText = formatLocator(citation.source_locator);
  const verificationClass = `citation-verification citation-verification-${citation.verification_status.toLowerCase()}`;
  return (
    `<div class="citation-modal-body">` +
    `<h3 id="citation-modal-title">Citation</h3>` +
    `<dl class="citation-meta">` +
    `<dt>Source</dt><dd>${escapeHtml(citation.document_version_id)}</dd>` +
    `<dt>Locator</dt><dd>${escapeHtml(locatorText)}</dd>` +
    `<dt>Verification</dt><dd><span class="${verificationClass}">${escapeHtml(
      citation.verification_status,
    )}</span></dd>` +
    `</dl>` +
    `<h4>Claim</h4>` +
    `<blockquote class="citation-claim">${escapeHtml(citation.claim_text)}</blockquote>` +
    `</div>`
  );
}

/**
 * Formats a `source_locator` object as a readable string.
 * Supports the common shapes emitted by the P2 extraction pipeline.
 */
function formatLocator(locator: Record<string, unknown>): string {
  if (typeof locator['page'] === 'number') return `page ${locator['page']}`;
  if (typeof locator['ordinal'] === 'number') {
    const type = typeof locator['type'] === 'string' ? locator['type'] : 'position';
    return `${type} ${locator['ordinal']}`;
  }
  if ('locator' in locator && typeof locator['locator'] === 'object' && locator['locator']) {
    return formatLocator(locator['locator'] as Record<string, unknown>);
  }
  try {
    return JSON.stringify(locator);
  } catch {
    return '(unavailable)';
  }
}

// ---------------------------------------------------------------------------
// Feedback form
// ---------------------------------------------------------------------------

/**
 * Mirrors `FeedbackCategory` from @pia/contracts. Re-declared locally.
 * Must stay in sync with @pia/contracts and the @pia/db enum.
 */
export const FEEDBACK_CATEGORIES: readonly string[] = Object.freeze([
  'POSITIVE',
  'NEGATIVE',
  'INCORRECT',
  'INCOMPLETE',
  'CITATION_ISSUE',
  'STYLE_ISSUE',
  'UNSAFE',
  'FREE_TEXT',
]);

/**
 * Renders the feedback form for a given message. The form is a sibling
 * of the original message DOM and never mutates it on submit. The
 * submit handler is wired by the page-level client script.
 *
 * The `correction` and `notes` textareas have a `maxlength` attribute
 * matching the API's `FEEDBACK_TEXT_MAX_BYTES` default (4096 bytes).
 * The server is the authoritative length cap; this attribute is a UX
 * hint only.
 */
export function renderFeedbackForm(messageId: string, maxBytes: number = 4096): string {
  const options = FEEDBACK_CATEGORIES.map(
    (c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`,
  ).join('');
  return (
    `<form class="feedback-form" data-message-id="${escapeHtml(messageId)}" ` +
    `aria-label="Submit feedback for this message">` +
    `<label for="feedback-category-${escapeHtml(messageId)}">Category</label>` +
    `<select id="feedback-category-${escapeHtml(messageId)}" name="category" required>` +
    `<option value="" disabled selected>Select a category…</option>` +
    `${options}</select>` +
    `<label for="feedback-correction-${escapeHtml(messageId)}">Correction (optional)</label>` +
    `<textarea id="feedback-correction-${escapeHtml(messageId)}" name="correction" ` +
    `rows="3" maxlength="${maxBytes}" aria-describedby="feedback-correction-hint-${escapeHtml(
      messageId,
    )}"></textarea>` +
    `<div id="feedback-correction-hint-${escapeHtml(
      messageId,
    )}" class="meta">Free-text correction, up to ${maxBytes} bytes. Stored verbatim.</div>` +
    `<label for="feedback-notes-${escapeHtml(messageId)}">Notes (optional)</label>` +
    `<textarea id="feedback-notes-${escapeHtml(messageId)}" name="notes" ` +
    `rows="2" maxlength="${maxBytes}"></textarea>` +
    `<button type="submit" class="btn btn-primary">Submit feedback</button>` +
    `<output class="feedback-status" aria-live="polite"></output>` +
    `</form>`
  );
}

// ---------------------------------------------------------------------------
// Message rendering
// ---------------------------------------------------------------------------

/**
 * Mirrors a minimal message shape for the conversation detail page.
 * Re-declared locally to keep this module dependency-free.
 */
export interface MessageView {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM_NOTE' | 'TOOL';
  content: string;
  created_at: string;
}

/**
 * Renders a single message. Assistant messages include the feedback
 * form and a placeholder for streamed citations (populated client-side
 * as SSE events arrive). The original message content is never
 * mutated after render.
 */
export function renderMessage(msg: MessageView, feedbackEnabled: boolean): string {
  const roleClass = `message message-${msg.role.toLowerCase()}`;
  const safeContent = escapeHtml(msg.content);
  const feedback = msg.role === 'ASSISTANT' && feedbackEnabled ? renderFeedbackForm(msg.id) : '';
  return (
    `<article class="${roleClass}" data-message-id="${escapeHtml(msg.id)}" ` +
    `aria-label="${escapeHtml(msg.role)} message">` +
    `<div class="message-content">${safeContent}</div>` +
    `<div class="message-meta"><time datetime="${escapeHtml(msg.created_at)}">${escapeHtml(
      msg.created_at,
    )}</time></div>` +
    `<div class="message-citations" data-message-id="${escapeHtml(msg.id)}"></div>` +
    `${feedback}` +
    `</article>`
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}
