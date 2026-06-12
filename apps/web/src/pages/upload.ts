import { pageShell } from './shared.js';

/**
 * Upload page — file upload with progress, status polling, and error display.
 *
 * Route: GET /app/workspaces/{wid}/upload
 *
 * @remarks
 * Supports keyboard-navigable form controls and ARIA live-region
 * announcements for status changes. The upload flow uses the existing
 * /v1/workspaces/{wid}/uploads/initiate and .../complete endpoints
 * from P1-T07, combined with the ingestion-job creation from P2-T08.
 */
export function uploadPage(workspaceId: string, workspaceName: string): string {
  return pageShell({
    title: 'Upload Document',
    workspaceId,
    workspaceName,
    tabActive: 'upload',
    bodyHtml: `
      <div class="card">
        <h2>Upload a Document</h2>
        <p class="meta" style="margin-bottom:1rem">Supported formats: PDF, DOCX, plain text (.txt). Maximum size: 50 MB.</p>

        <form id="upload-form">
          <label for="file-input">Choose a file:</label>
          <input type="file" id="file-input" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" required>
          <div class="meta" id="file-info" style="margin-bottom:0.75rem"></div>

          <label for="title-input">Document title (optional):</label>
          <input type="text" id="title-input" placeholder="Leave blank to use filename" maxlength="500">

          <div class="progress-container" id="progress-container" style="display:none">
            <div class="meta" id="progress-label">Uploading...</div>
            <div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-label="Upload progress">
              <div class="progress-fill" id="progress-fill" style="width:0%"></div>
            </div>
          </div>

          <button type="submit" id="submit-btn" class="btn btn-primary">Upload</button>
        </form>
      </div>

      <div class="card" id="result-card" style="display:none">
        <h3 id="result-title">Upload Result</h3>
        <div id="result-body"></div>
      </div>`,
    bodyScript: `
const wsId = ${JSON.stringify(workspaceId)};

document.getElementById('file-input').addEventListener('change', function(e) {
  var file = e.target.files[0];
  var info = document.getElementById('file-info');
  if (file) {
    info.textContent = 'Selected: ' + file.name + ' (' + (file.size / 1024 / 1024).toFixed(1) + ' MB)';
  } else {
    info.textContent = '';
  }
});

document.getElementById('upload-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  clearError();
  var fileInput = document.getElementById('file-input');
  var file = fileInput.files[0];
  if (!file) { showError('Please select a file.'); return; }

  var title = document.getElementById('title-input').value.trim() || file.name;

  var submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Uploading...';

  var progressContainer = document.getElementById('progress-container');
  var progressBar = document.getElementById('progress-fill');
  var progressLabel = document.getElementById('progress-label');
  progressContainer.style.display = 'block';
  progressBar.style.width = '10%';
  progressLabel.textContent = 'Initiating upload...';
  announce('Upload started');

  try {
    // Step 1: Initiate upload
    var init = await apiFetch('/v1/workspaces/' + wsId + '/uploads/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        title: title
      })
    });
    progressBar.style.width = '30%';
    progressLabel.textContent = 'Uploading file...';
    announce('Upload key obtained, transferring file');

    // Step 2: Upload file to signed URL
    await fetch(init.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file
    });
    progressBar.style.width = '70%';
    progressLabel.textContent = 'Verifying upload...';
    announce('File transfer complete, verifying');

    // Step 3: Complete upload
    var complete = await apiFetch('/v1/workspaces/' + wsId + '/uploads/' + init.upload_id + '/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    progressBar.style.width = '100%';
    progressLabel.textContent = 'Processing...';

    showUploadResult({
      success: true,
      upload_id: init.upload_id,
      document_id: complete.document_id,
      version_id: complete.document_version_id,
      status: complete.status,
      title: title
    });
    announce('Upload complete. Document is being processed.');
  } catch (err) {
    progressBar.style.width = '0%';
    progressContainer.style.display = 'none';
    showError(err.message);
    announce('Upload failed: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Upload';
  }
});

function showUploadResult(result) {
  var resultCard = document.getElementById('result-card');
  var resultTitle = document.getElementById('result-title');
  var resultBody = document.getElementById('result-body');
  resultCard.style.display = 'block';

  if (result.success) {
    resultTitle.innerHTML = '&#10003; Upload Complete';
    resultBody.innerHTML =
      '<div class="success"><strong>Document uploaded.</strong> ' +
      'The ingestion pipeline will process this document. ' +
      'You can check its status on the document detail page.</div>' +
      '<div class="meta">Document ID: <code>' + escapeHtml(result.document_id || '—') + '</code></div>' +
      '<div class="meta">Version ID: <code>' + escapeHtml(result.version_id || '—') + '</code></div>' +
      '<div class="meta">Status: <span class="badge badge-processing">' + escapeHtml(result.status || 'PROCESSING') + '</span></div>' +
      (result.document_id ? '<p style="margin-top:1rem">' +
        '<a href="/app/workspaces/' + wsId + '/documents/' + result.document_id + '" class="btn btn-primary">View Document</a> ' +
        '<a href="/app/workspaces/' + wsId + '/documents" class="btn">All Documents</a>' +
      '</p>' : '');
  }
}

// Support keyboard-initiated upload via Enter on file input
document.getElementById('file-input').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('submit-btn').click();
  }
});
`,
  });
}
