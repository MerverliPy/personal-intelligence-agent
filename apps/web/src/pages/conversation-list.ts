// ---------------------------------------------------------------------------
// Conversation list page (P3-T09)
// ---------------------------------------------------------------------------
// Lists conversations for a workspace and provides a "New conversation"
// affordance. Server-rendered shell + client-side fetch.
//
// Acceptance: J-005 (correct a poor answer) starts here — the user picks
// a conversation to inspect and provide feedback on.
// ---------------------------------------------------------------------------

import { pageShell } from './shared.js';

/**
 * Server-rendered HTML for the conversation list page.
 *
 * The initial HTML is a skeleton; the client script populates the
 * table by fetching `GET /v1/workspaces/{wid}/conversations`.
 */
export function conversationListPage(workspaceId: string, workspaceName: string): string {
  const bodyHtml = `
<h2 class="sr-only">Conversations</h2>

<!-- Fresh-chat quick-ask composer — type and Send to start a new conversation -->
<form id="quick-ask-form" class="quick-ask-form" aria-label="Ask a question">
  <div class="quick-ask__row">
    <label for="quick-ask-input" class="sr-only">Ask a question</label>
    <textarea id="quick-ask-input" rows="1" required
      placeholder="Ask a question, or request research / analysis / planning."
      oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight, 120)+'px'"></textarea>
    <button type="submit" class="btn btn-primary send-btn">Ask</button>
  </div>
  <small class="quick-ask__hint">Ask a question to start a new conversation. Use the conversation list below to resume one.</small>
</form>

<!-- Existing conversations list -->
<h3 class="conversation-list-heading">Recent conversations</h3>
<table class="conversation-list" aria-label="Conversations">
  <thead>
    <tr>
      <th scope="col">Title</th>
      <th scope="col">Mode</th>
      <th scope="col">Updated</th>
      <th scope="col">Actions</th>
    </tr>
  </thead>
  <tbody id="conversation-list-body">
    <tr class="empty"><td colspan="4">Loading conversations…</td></tr>
  </tbody>
</table>
`;

  const bodyScript = `
window.__piaWorkspaceId = ${JSON.stringify(workspaceId)};
const WORKSPACE_ID = window.__piaWorkspaceId;

async function loadConversations() {
  const tbody = document.getElementById('conversation-list-body');
  try {
    const data = await apiFetch('/v1/workspaces/' + WORKSPACE_ID + '/conversations');
    const items = (data && data.items) || [];
    if (items.length === 0) {
      tbody.innerHTML = '<tr class="empty"><td colspan="4">No conversations yet. Use the quick-ask box above to start one.</td></tr>';
      return;
    }
    tbody.innerHTML = items.map(function(c) {
      const title = escapeHtml(c.title || '(untitled)');
      const mode = escapeHtml(c.mode);
      const updated = escapeHtml(new Date(c.updated_at).toISOString());
      return '<tr>' +
        '<td><a href="/app/workspaces/' + WORKSPACE_ID + '/conversations/' + escapeHtml(c.id) + '">' + title + '</a></td>' +
        '<td>' + mode + '</td>' +
        '<td>' + updated + '</td>' +
        '<td><a class="btn btn-sm" href="/app/workspaces/' + WORKSPACE_ID + '/conversations/' + escapeHtml(c.id) + '">Open</a></td>' +
      '</tr>';
    }).join('');
  } catch (err) {
    showError('Failed to load conversations: ' + err.message);
    tbody.innerHTML = '<tr class="empty"><td colspan="4">Could not load conversations.</td></tr>';
  }
}

// Quick-ask: type a question and Send to start a new ASK conversation
document.getElementById('quick-ask-form').addEventListener('submit', async function(ev) {
  ev.preventDefault();
  var input = document.getElementById('quick-ask-input');
  var question = input.value.trim();
  if (!question) return;
  try {
    var c = await apiFetch('/v1/workspaces/' + WORKSPACE_ID + '/conversations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'ASK', title: null }),
    });
    window.location.href = '/app/workspaces/' + WORKSPACE_ID + '/conversations/' + c.id;
  } catch (err) {
    showError('Failed to start conversation: ' + err.message);
  }
});

loadConversations();
`;

  // PIA-MUR-D-004-IMPL commit 7: FAB for "New conversation".
  // 56pt x 56pt circular button (T7=A). Wired to the mode sheet
  // (added in shared.ts). Tap opens the mode picker (default ASK).
  const fabHtml =
    '<button class="fab" id="fab-conversation" type="button" aria-label="New conversation" data-fab="conversation">+</button>';
  const bodyHtmlWithFab = bodyHtml.replace('</section>', '</section>' + fabHtml);

  return pageShell({
    title: 'Conversations',
    workspaceId,
    workspaceName,
    tabActive: 'conversations',
    bodyHtml: bodyHtmlWithFab,
    bodyScript,
  });
}
