import { pageShell } from './shared.js';

/**
 * Search/retrieval page — query input, results with source/version/locator
 * display, history mode toggle, keyboard-navigable results.
 *
 * Route: GET /app/workspaces/{wid}/search
 *
 * @remarks
 * NFR-UX-001 — search results display source/version/locator.
 * NFR-UX-003 — keyboard navigation and accessible status announcements.
 */
export function searchPage(workspaceId: string, workspaceName: string): string {
  return pageShell({
    title: 'Search',
    workspaceId,
    workspaceName,
    tabActive: 'search',
    bodyHtml: `
      <div class="card">
        <form id="search-form" role="search" aria-label="Document search">
          <label for="query-input">Search your documents:</label>
          <div style="display:flex; gap:0.5rem; align-items:flex-end">
            <input type="search" id="query-input" placeholder="Enter your question or keywords..." required autofocus maxlength="10000" style="margin-bottom:0;flex:1">
            <button type="submit" id="search-btn" class="btn btn-primary">Search</button>
          </div>
          <fieldset style="margin-top:0.75rem">
            <legend>Options</legend>
            <div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap">
              <label style="font-weight:normal;display:flex;align-items:center;gap:0.25rem;font-size:0.9rem">
                <input type="checkbox" id="include-history" style="width:auto;margin-bottom:0"> Include historical versions
              </label>
              <label style="font-weight:normal;font-size:0.9rem">
                Results: <select id="result-limit" style="width:auto;display:inline-block;margin-bottom:0">
                  <option value="5">5</option>
                  <option value="10" selected>10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
              </label>
            </div>
          </fieldset>
        </form>
      </div>

      <div id="results-container" style="display:none">
        <div class="row" style="margin-bottom:1rem">
          <div class="meta" id="results-summary"></div>
          <span id="latency" class="meta"></span>
        </div>
        <div id="results-list" role="list" aria-label="Search results"></div>
        <div class="meta" style="margin-top:1rem">
          <span id="trace-info"></span>
        </div>
      </div>

      <div class="empty" id="no-results" style="display:none">No results found for your query.</div>
      <div class="loading" id="search-loading" style="display:none">Searching...</div>`,
    bodyScript: `
const wsId = ${JSON.stringify(workspaceId)};

document.getElementById('search-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  clearError();
  var query = document.getElementById('query-input').value.trim();
  if (!query) { showError('Please enter a search query.'); return; }

  document.getElementById('results-container').style.display = 'none';
  document.getElementById('no-results').style.display = 'none';
  document.getElementById('search-loading').style.display = 'block';
  var searchBtn = document.getElementById('search-btn');
  searchBtn.disabled = true;
  searchBtn.textContent = 'Searching...';
  announce('Searching for: ' + query);

  try {
    var includeHistory = document.getElementById('include-history').checked;
    var limit = parseInt(document.getElementById('result-limit').value, 10);

    var start = Date.now();
    var data = await apiFetch('/v1/workspaces/' + wsId + '/retrieval/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query,
        history_mode: includeHistory ? 'INCLUDE_HISTORY' : 'CURRENT_ONLY',
        limit: limit,
        include_debug: false
      })
    });
    var clientLatency = Date.now() - start;

    renderResults(data, query, clientLatency);
    announce('Found ' + (data.results ? data.results.length : 0) + ' results for: ' + query);
  } catch (err) {
    showError(err.message);
    document.getElementById('search-loading').style.display = 'none';
    announce('Search failed');
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = 'Search';
  }
});

function renderResults(data, query, clientLatency) {
  document.getElementById('search-loading').style.display = 'none';
  var results = data.results || [];
  if (results.length === 0) {
    document.getElementById('no-results').style.display = 'block';
    return;
  }

  document.getElementById('results-container').style.display = 'block';
  document.getElementById('results-summary').textContent =
    results.length + ' result' + (results.length !== 1 ? 's' : '') + ' for "' + query + '"';
  document.getElementById('latency').textContent =
    'Server: ' + data.latency_ms + 'ms &middot; Client: ' + clientLatency + 'ms';
  document.getElementById('trace-info').innerHTML =
    'Trace: <code>' + escapeHtml(data.trace_id) + '</code> &middot; Config: ' + escapeHtml(data.configuration_version);

  var html = '';
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    html += '<div class="chunk" role="listitem" tabindex="0" aria-label="Result ' + (i + 1) + '">' +
      '<div class="chunk-text">' + escapeHtml(r.text) + '</div>' +
      '<div class="chunk-source">' +
        '<strong>Rank ' + r.rank + '</strong>' +
        ' &middot; Chunk: <code>' + escapeHtml(r.chunk_id) + '</code>' +
        ' &middot; Version: <code>' + escapeHtml(r.document_version_id) + '</code>' +
        (r.source_id ? ' &middot; Source: <code>' + escapeHtml(r.source_id) + '</code>' : '') +
        (r.locator && Object.keys(r.locator).length > 0 ? ' &middot; Locator: ' + escapeHtml(JSON.stringify(r.locator)) : '') +
      '</div>' +
      '<div class="score-bar">' +
        (r.scores.lexical != null ? '<span title="Lexical score">Lex: ' + r.scores.lexical.toFixed(3) + '</span>' : '') +
        (r.scores.vector != null ? '<span title="Vector score">Vec: ' + r.scores.vector.toFixed(3) + '</span>' : '') +
        '<span title="Fused score">Fuse: ' + r.scores.fused.toFixed(3) + '</span>' +
      '</div>' +
      '</div>';
  }
  document.getElementById('results-list').innerHTML = html;

  // Keyboard navigation: focus first result
  var firstChunk = document.querySelector('.chunk');
  if (firstChunk) firstChunk.focus();
}

// Keyboard shortcut: Ctrl+K or / to focus search input
document.addEventListener('keydown', function(e) {
  if ((e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement !== document.getElementById('query-input')) ||
      (e.key === 'k' && (e.ctrlKey || e.metaKey))) {
    e.preventDefault();
    document.getElementById('query-input').focus();
  }
});
`,
  });
}
