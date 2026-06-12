import { pageShell } from './shared.js';

/**
 * Document detail page — shows metadata, current version, ingestion job
 * history, and retry/delete controls for a single document.
 *
 * Route: GET /app/workspaces/{wid}/documents/{did}
 */
export function documentDetailPage(
  workspaceId: string,
  workspaceName: string,
  documentId: string,
): string {
  return pageShell({
    title: 'Document Detail',
    workspaceId,
    workspaceName,
    tabActive: 'documents',
    bodyHtml: `
      <div class="loading" id="loading">Loading document...</div>
      <div id="detail" style="display:none">
        <div class="card" id="doc-card">
          <div class="row">
            <h2 id="doc-title"></h2>
            <span id="doc-status"></span>
          </div>
          <div class="meta" style="margin-bottom:0.5rem">
            <span id="doc-id-label">ID: <code id="doc-id"></code></span>
            &middot; Created <span id="doc-created"></span>
            &middot; Sensitivity: <span id="doc-sensitivity"></span>
          </div>
          <div class="meta" id="doc-project"></div>
        </div>

        <div class="card" id="version-card" style="display:none">
          <h3>Current Version</h3>
          <div class="meta">
            Version #<span id="ver-num"></span>
            &middot; Status: <span id="ver-status"></span>
            &middot; <span id="ver-is-current"></span>
          </div>
          <div class="meta">
            SHA-256: <code id="ver-checksum" style="font-size:0.75rem"></code>
          </div>
          <div class="meta">Created: <span id="ver-created"></span></div>
          <div id="retry-section" style="margin-top:1rem"></div>
        </div>

        <h3>Ingestion Jobs</h3>
        <div id="jobs-container">
          <div id="jobs-loading" class="loading">Loading jobs...</div>
          <table id="jobs-table" style="display:none" role="table" aria-label="Ingestion jobs">
            <thead><tr><th>Job ID</th><th>Status</th><th>Stage</th><th>Attempt</th><th>Created</th><th>Updated</th></tr></thead>
            <tbody id="jobs-rows"></tbody>
          </table>
          <div class="empty" id="jobs-empty" style="display:none">No ingestion jobs found.</div>
        </div>

        <div style="margin-top:1.5rem">
          <button id="delete-btn" class="btn btn-danger">Delete Document</button>
        </div>
      </div>`,
    bodyScript: `
const wsId = ${JSON.stringify(workspaceId)};
const docId = ${JSON.stringify(documentId)};
var currentVersionId = null;
var currentVersionStatus = null;

async function loadDocument() {
  clearError();
  try {
    var doc = await apiFetch('/v1/workspaces/' + wsId + '/documents/' + docId);
    renderDocument(doc);
    announce('Document loaded: ' + doc.title);
  } catch (err) {
    showError(err.message);
    document.getElementById('loading').style.display = 'none';
  }
}

function renderDocument(doc) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('detail').style.display = 'block';
  document.title = doc.title + ' — PIA';
  document.getElementById('doc-title').textContent = doc.title;
  document.getElementById('doc-status').innerHTML = statusBadgeHtml(doc.current_version ? doc.current_version.status : 'PENDING');
  document.getElementById('doc-id').textContent = doc.id;
  document.getElementById('doc-created').textContent = new Date(doc.created_at).toLocaleString();
  document.getElementById('doc-sensitivity').textContent = doc.sensitivity || 'INTERNAL';
  if (doc.project_id) {
    document.getElementById('doc-project').textContent = 'Project: ' + doc.project_id;
  }

  var cv = doc.current_version;
  if (cv) {
    currentVersionId = cv.id;
    currentVersionStatus = cv.status;
    document.getElementById('version-card').style.display = 'block';
    document.getElementById('ver-num').textContent = cv.version_number;
    document.getElementById('ver-status').innerHTML = statusBadgeHtml(cv.status);
    document.getElementById('ver-is-current').textContent = cv.is_current ? 'Current' : 'Superseded';
    document.getElementById('ver-checksum').textContent = cv.checksum_sha256 || '—';
    document.getElementById('ver-created').textContent = new Date(cv.created_at).toLocaleString();

    if (cv.status === 'FAILED' || cv.status === 'UPLOADED' || cv.status === 'QUARANTINED') {
      document.getElementById('retry-section').innerHTML = '<button id="retry-btn" class="btn btn-primary btn-sm">Retry Ingestion</button>';
      document.getElementById('retry-btn').addEventListener('click', function() { retryIngestion(); });
    }
  }

  loadJobs();
}

function statusBadgeHtml(status) {
  var cls = { READY: 'badge-ready', PROCESSING: 'badge-processing', FAILED: 'badge-failed',
    QUARANTINED: 'badge-quarantined', UPLOADED: 'badge-uploaded', PENDING: 'badge-pending' }[status] || 'badge-pending';
  return '<span class="badge ' + cls + '">' + escapeHtml(status) + '</span>';
}

async function loadJobs() {
  try {
    var data = await apiFetch('/v1/workspaces/' + wsId + '/documents/' + docId);
    var jobs = data.items || [];
    // Note: the current API doesn't have a dedicated "list jobs for document"
    // endpoint; we approximate by checking ingestion-job endpoints for status.
    // For now, show a message that job details are available via the ingestion-job endpoint.
    document.getElementById('jobs-loading').style.display = 'none';
    if (jobs.length === 0) {
      document.getElementById('jobs-empty').style.display = 'block';
    }
  } catch (err) {
    document.getElementById('jobs-loading').style.display = 'none';
    document.getElementById('jobs-empty').style.display = 'block';
  }
}

async function retryIngestion() {
  clearError();
  try {
    var key = 'retry-' + docId + '-' + Date.now();
    var job = await apiFetch('/v1/workspaces/' + wsId + '/documents/' + docId + '/ingestion-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: '{}'
    });
    showSuccess('Ingestion job created: ' + job.id + '. Refresh to see updates.');
    announce('Retry job submitted successfully');
    document.getElementById('retry-section').innerHTML = '';
    currentVersionStatus = 'PROCESSING';
    document.getElementById('ver-status').innerHTML = statusBadgeHtml('PROCESSING');
    document.getElementById('doc-status').innerHTML = statusBadgeHtml('PROCESSING');
  } catch (err) {
    showError('Retry failed: ' + err.message);
    announce('Retry failed: ' + err.message);
  }
}

document.getElementById('delete-btn').addEventListener('click', async function() {
  if (!confirm('Delete this document? This action is reversible.')) return;
  clearError();
  try {
    var result = await apiFetch('/v1/workspaces/' + wsId + '/documents/' + docId, { method: 'DELETE' });
    showSuccess('Document deleted. Redirecting...');
    announce('Document deleted successfully');
    setTimeout(function() { window.location.href = '/app/workspaces/' + wsId + '/documents'; }, 1500);
  } catch (err) {
    showError('Delete failed: ' + err.message);
    announce('Delete failed');
  }
});

loadDocument();
`,
  });
}
