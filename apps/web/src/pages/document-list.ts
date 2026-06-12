import { pageShell } from './shared.js';

/**
 * Document list page — shows all documents in a workspace with status,
 * version info, upload/retry controls, and keyboard-navigable rows.
 *
 * Route: GET /app/workspaces/{wid}/documents
 */
export function documentListPage(workspaceId: string, workspaceName: string): string {
  return pageShell({
    title: 'Documents',
    workspaceId,
    workspaceName,
    tabActive: 'documents',
    bodyHtml: `
      <div class="loading" id="loading">Loading documents...</div>
      <div id="results" style="display:none">
        <div class="row" style="margin-bottom:1rem">
          <div id="result-count" class="meta"></div>
          <a href="/app/workspaces/${workspaceId}/upload" class="btn btn-primary btn-sm">+ Upload</a>
        </div>
        <table role="table" aria-label="Documents">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Sensitivity</th>
              <th>Version</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="doc-rows"></tbody>
        </table>
        <div id="pagination" class="meta" style="margin-top:1rem"></div>
      </div>
      <div class="empty" id="empty" style="display:none">
        <p>No documents yet.</p>
        <p style="margin-top:0.5rem"><a href="/app/workspaces/${workspaceId}/upload" class="btn btn-primary">Upload a Document</a></p>
      </div>`,
    bodyScript: `
const wsId = ${JSON.stringify(workspaceId)};
let currentCursor = null;
let hasMore = false;

async function loadDocuments(cursor) {
  clearError();
  document.getElementById('loading').style.display = 'block';
  document.getElementById('results').style.display = 'none';
  document.getElementById('empty').style.display = 'none';
  try {
    var url = '/v1/workspaces/' + wsId + '/documents?limit=25';
    if (cursor) url += '&cursor=' + encodeURIComponent(cursor);
    var data = await apiFetch(url);
    renderDocuments(data);
    announce('Loaded ' + data.items.length + ' documents');
  } catch (err) {
    showError(err.message);
    document.getElementById('loading').style.display = 'none';
  }
}

function renderDocuments(data) {
  document.getElementById('loading').style.display = 'none';
  var items = data.items || [];
  if (items.length === 0 && !currentCursor) {
    document.getElementById('empty').style.display = 'block';
    return;
  }
  document.getElementById('results').style.display = 'block';
  document.getElementById('result-count').textContent = items.length + ' document' + (items.length !== 1 ? 's' : '');
  var rowsHtml = '';
  for (var i = 0; i < items.length; i++) {
    var d = items[i];
    var statusBadge = statusBadgeHtml(d.current_version ? d.current_version.status : 'PENDING');
    rowsHtml += '<tr tabindex="0" role="row">' +
      '<td><a href="/app/workspaces/' + wsId + '/documents/' + d.id + '">' + escapeHtml(d.title) + '</a></td>' +
      '<td>' + statusBadge + '</td>' +
      '<td>' + escapeHtml(d.sensitivity || 'INTERNAL') + '</td>' +
      '<td>' + (d.current_version ? 'v' + d.current_version.version_number : '—') + '</td>' +
      '<td>' + new Date(d.created_at).toLocaleDateString() + '</td>' +
      '<td><a href="/app/workspaces/' + wsId + '/documents/' + d.id + '" class="btn btn-sm" aria-label="View document ' + escapeHtml(d.title) + '">View</a></td>' +
      '</tr>';
  }
  document.getElementById('doc-rows').innerHTML = rowsHtml;
  hasMore = !!data.next_cursor;
  currentCursor = data.next_cursor;
  var pagHtml = '';
  if (hasMore) {
    pagHtml = '<button id="load-more" class="btn btn-sm">Load more</button>';
  }
  document.getElementById('pagination').innerHTML = pagHtml;
  var loadMoreBtn = document.getElementById('load-more');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', function() { loadDocuments(currentCursor); });
  }
}

function statusBadgeHtml(status) {
  var cls = { READY: 'badge-ready', PROCESSING: 'badge-processing', FAILED: 'badge-failed',
    QUARANTINED: 'badge-quarantined', UPLOADED: 'badge-uploaded', PENDING: 'badge-pending' }[status] || 'badge-pending';
  return '<span class="badge ' + cls + '">' + escapeHtml(status) + '</span>';
}

loadDocuments(null);
`,
  });
}
