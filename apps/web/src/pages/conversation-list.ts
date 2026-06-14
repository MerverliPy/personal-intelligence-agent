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
<form id="new-conversation-form" aria-label="Start a new conversation">
  <label for="new-conversation-mode">Mode</label>
  <select id="new-conversation-mode" name="mode" required>
    <option value="ASK" selected>Ask — direct question</option>
    <option value="RESEARCH">Research — multi-source investigation</option>
    <option value="ANALYZE">Analyze — evaluate evidence</option>
    <option value="PLAN">Plan — define work</option>
    <option value="EXECUTE">Execute — perform authorized work</option>
    <option value="LEARN">Learn — improve future performance</option>
  </select>
  <label for="new-conversation-title">Title (optional)</label>
  <input type="text" id="new-conversation-title" name="title" maxlength="200" />
  <button type="submit" class="btn btn-primary">New conversation</button>
</form>
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
const WORKSPACE_ID = ${JSON.stringify(workspaceId)};

async function loadConversations() {
  const tbody = document.getElementById('conversation-list-body');
  try {
    const data = await apiFetch('/v1/workspaces/' + WORKSPACE_ID + '/conversations');
    const items = (data && data.items) || [];
    if (items.length === 0) {
      tbody.innerHTML = '<tr class="empty"><td colspan="4">No conversations yet. Start one above.</td></tr>';
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

document.getElementById('new-conversation-form').addEventListener('submit', async function(ev) {
  ev.preventDefault();
  const mode = document.getElementById('new-conversation-mode').value;
  const title = document.getElementById('new-conversation-title').value.trim();
  try {
    const c = await apiFetch('/v1/workspaces/' + WORKSPACE_ID + '/conversations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: mode, title: title || null }),
    });
    window.location.href = '/app/workspaces/' + WORKSPACE_ID + '/conversations/' + c.id;
  } catch (err) {
    showError('Failed to create conversation: ' + err.message);
  }
});

loadConversations();
`;

  return pageShell({
    title: 'Conversations',
    workspaceId,
    workspaceName,
    tabActive: 'conversations',
    bodyHtml,
    bodyScript,
  });
}
