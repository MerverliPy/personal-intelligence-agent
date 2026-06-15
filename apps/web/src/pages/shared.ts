/**
 * Shared CSS used across all P2-T09 document and retrieval pages.
 *
 * @remarks
 * NFR-UX-003 — accessible status announcements for core flows.
 * Uses high-contrast colors, system font stack, and ARIA-friendly design.
 */
export const sharedCss = `
  /* PIA-MUR-D-004 design tokens (locked; sourced from
   * .ui-redesign/contracts/DESIGN_CONTRACT.json). All subsequent
   * commits (PIA-MUR-D-004-IMPL #2-#8) reference these tokens. */
  :root {
    --accent: #2563EB;
    --accent-pressed: #1D4ED8;
    --accent-fg: #FFFFFF;
    --bg: #FFFFFF;
    --fg: #0A0A0A;
    --fg-muted: #5C5C5C;
    --fg-subtle: #9C9C9C;
    --divider: #ECECEC;
    --selection: #DBE7FF;
    --t-body: 19pt;
    --t-caption: 14pt;
    --t-section: 24pt;
    --s-1: 4pt; --s-2: 8pt; --s-3: 12pt; --s-4: 16pt;
    --s-5: 20pt; --s-6: 24pt; --s-8: 32pt; --s-10: 40pt; --s-12: 48pt;
    --r-sm: 8pt; --r-md: 12pt; --r-lg: 16pt; --r-pill: 9999pt;
    --motion-fast: 120ms;
    --motion-base: 200ms;
    --motion-slow: 280ms;
    --motion-sheet: 280ms;
    --motion-ease: cubic-bezier(0.32, 0.72, 0, 1);
    --touch-min: 44pt;
    --tab-bar-h: 49pt;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #f5f5f5; color: #1a1a1a; line-height: 1.5;
          padding-top: max(env(safe-area-inset-top, 0px), 59pt);
          padding-bottom: env(safe-area-inset-bottom, 0px);
          padding-left: env(safe-area-inset-left, 0px);
          padding-right: env(safe-area-inset-right, 0px);
  }
  .container { max-width: 960px; margin: 0 auto; padding: 2rem 1rem; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #e0e0e0; }
  .header h1 { font-size: 1.5rem; font-weight: 600; }
  .header nav a { margin-left: 1rem; color: #444; text-decoration: none; font-size: 0.9rem; }
  .header nav a:hover { text-decoration: underline; }
  .error { background: #fee2e2; border: 1px solid #fca5a5; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; color: #991b1b; }
  .success { background: #dcfce7; border: 1px solid #86efac; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; color: #166534; }
  .info { background: #dbeafe; border: 1px solid #93c5fd; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; color: #1e40af; }
  .warning { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; color: #92400e; }
  .card { background: white; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .card h2 { font-size: 1.1rem; margin-bottom: 0.25rem; }
  .card h3 { font-size: 1rem; margin-top: 1rem; margin-bottom: 0.5rem; }
  .card .meta { font-size: 0.85rem; color: #666; margin-bottom: 0.5rem; }
  .card .row { display: flex; justify-content: space-between; align-items: center; }
  .loading { color: #888; font-style: italic; padding: 2rem; text-align: center; }
  .empty { color: #999; padding: 2rem 0; text-align: center; }
  .btn { display: inline-block; padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid #ccc; background: white; cursor: pointer; font-size: 0.9rem; text-decoration: none; color: #1a1a1a; }
  .btn:hover { background: #f9f9f9; }
  .btn-primary { background: #1a1a1a; color: white; border-color: #1a1a1a; }
  .btn-primary:hover { background: #333; }
  .btn-danger { border-color: #dc2626; color: #dc2626; }
  .btn-danger:hover { background: #fef2f2; }
  .btn-sm { padding: 0.3rem 0.7rem; font-size: 0.8rem; }
  .btn:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; border-radius: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 0.6rem 0.75rem; text-align: left; border-bottom: 1px solid #f0f0f0; font-size: 0.9rem; }
  th { font-weight: 600; color: #555; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
  tr:hover td { background: #fafafa; }
  .badge { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
  .badge-ready { background: #dcfce7; color: #166534; }
  .badge-processing { background: #dbeafe; color: #1e40af; }
  .badge-failed { background: #fee2e2; color: #991b1b; }
  .badge-quarantined { background: #fef3c7; color: #92400e; }
  .badge-cancelled { background: #fef3c7; color: #92400e; }
  .badge-interrupted { background: #fee2e2; color: #991b1b; }
  .badge-uploaded { background: #f3e8ff; color: #6b21a8; }
  .badge-pending { background: #f3f4f6; color: #374151; }
  form { margin-bottom: 1.5rem; }
  label { display: block; margin-bottom: 0.25rem; font-weight: 500; font-size: 0.9rem; }
  input[type="text"], input[type="search"], input[type="file"], select { width: 100%; max-width: 480px; padding: 0.5rem 0.75rem; border: 1px solid #ccc; border-radius: 6px; font-size: 0.9rem; margin-bottom: 0.75rem; }
  fieldset { border: 1px solid #e0e0e0; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
  legend { font-weight: 600; font-size: 0.9rem; padding: 0 0.5rem; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border-width: 0; }
  [role="status"] { position: fixed; top: 1rem; right: 1rem; max-width: 360px; z-index: 1000; pointer-events: none; }
  .chunk { background: #fafafa; border: 1px solid #e5e5e5; border-radius: 6px; padding: 0.75rem; margin-bottom: 0.5rem; }
  .chunk-text { font-size: 0.9rem; line-height: 1.6; margin-bottom: 0.5rem; }
  .chunk-source { font-size: 0.8rem; color: #666; }
  .score-bar { display: inline-flex; gap: 0.5rem; font-size: 0.75rem; }
  .score-bar span { padding: 0.1rem 0.4rem; border-radius: 3px; background: #f0f0f0; }
  .tab-bar { display: flex; gap: 0; border-bottom: 2px solid #e0e0e0; margin-bottom: 1.5rem; }
  .tab-bar a { padding: 0.6rem 1rem; text-decoration: none; color: #666; border-bottom: 2px solid transparent; margin-bottom: -2px; font-size: 0.9rem; font-weight: 500; }
  .tab-bar a.active, .tab-bar a:hover { color: #1a1a1a; border-bottom-color: #1a1a1a; }
  .progress-container { margin: 1rem 0; }
  .progress-bar { height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; }
  .progress-fill { height: 100%; background: #2563eb; border-radius: 4px; transition: width 0.3s ease; }

  /* PIA-MUR-D-004-IMPL commit 3: 3-tab mobile-first bottom bar
   * (Documents / Search / Conversations). position: fixed so it
   * stays at the viewport bottom regardless of body content height.
   * Matches the Stream concept prototype (PIA-MUR-D-011). */
  .bottom-tab-bar {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    height: calc(var(--tab-bar-h) + env(safe-area-inset-bottom, 0px));
    padding-bottom: env(safe-area-inset-bottom, 0px);
    display: flex;
    background: var(--bg);
    border-top: 0.5pt solid var(--divider);
    z-index: 10;
  }
  .bottom-tab {
    flex: 1 1 0;
    min-height: var(--touch-min);
    border: 0;
    background: transparent;
    color: var(--fg-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    font: inherit;
    cursor: pointer;
  }
  .bottom-tab[aria-current="page"] { color: var(--accent); }
  .bottom-tab:focus-visible { outline: 2pt solid var(--accent); outline-offset: -2pt; }

  /* PIA-MUR-D-004-IMPL commit 4: top app bar (T4=A).
   * 44pt x 44pt avatar (PIA-MUR-D-009 touch target minimum). */
  .app-header {
    display: flex;
    align-items: center;
    gap: var(--s-4);
    padding: var(--s-3) var(--s-4);
  }
  .app-header__avatar {
    width: var(--touch-min);
    height: var(--touch-min);
    border-radius: 50%;
    background: var(--accent);
    color: var(--accent-fg);
    border: 0;
    font-size: 16pt;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .app-header__avatar:focus-visible { outline: 2pt solid var(--accent); outline-offset: 2pt; }
  .app-header__title {
    font-size: var(--t-body);
    font-weight: 700;
    letter-spacing: -0.02em;
  }
`;

/**
 * Shared JavaScript utilities injected into every page.
 * Provides apiFetch, escapeHtml, showError, clearError, showStatus.
 */
export const sharedJs = `
const API_BASE = '';

async function apiFetch(path, opts) {
  const res = await fetch(path, opts);
  const body = await res.json().catch(function() { return {}; });
  if (!res.ok) {
    const code = (body && body.error && body.error.code) || 'UNKNOWN';
    const msg = (body && body.error && body.error.message) || 'Request failed';
    throw new Error(code + ': ' + msg);
  }
  return body;
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function showError(message) {
  var el = document.getElementById('error-container');
  if (el) el.innerHTML = '<div class="error" role="alert">' + escapeHtml(message) + '</div>';
}

function clearError() {
  var el = document.getElementById('error-container');
  if (el) el.innerHTML = '';
}

function showSuccess(message) {
  var el = document.getElementById('error-container');
  if (el) el.innerHTML = '<div class="success" role="status">' + escapeHtml(message) + '</div>';
}

var liveRegion = document.getElementById('live-region');
if (!liveRegion) {
  liveRegion = document.createElement('div');
  liveRegion.id = 'live-region';
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.className = 'sr-only';
  document.body.appendChild(liveRegion);
}

function announce(message) {
  liveRegion.textContent = '';
  setTimeout(function() { liveRegion.textContent = message; }, 50);
}
`;

/**
 * Shared page shell: wraps content with header, error container, CSS, JS.
 */
export function pageShell({
  title,
  workspaceId,
  workspaceName,
  tabActive,
  bodyHtml,
  bodyScript,
}: {
  title: string;
  workspaceId: string;
  workspaceName: string;
  tabActive: 'documents' | 'upload' | 'search' | 'conversations' | null;
  bodyHtml: string;
  bodyScript: string;
}): string {
  const encodedName = workspaceName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  let tabs = '';
  if (workspaceId) {
    // PIA-MUR-D-004-IMPL commit 3: 3-tab mobile-first bottom bar
    // (Documents / Search / Conversations). Upload is a sub-page of
    // Documents and is reached via the FAB (commit 7). Map
    // tabActive === 'upload' to 'documents' for the bar.
    const ACTIVE_TAB = tabActive === 'upload' ? 'documents' : tabActive;
    const makeTab = (id: string, label: string, active: boolean) =>
      `<button class="bottom-tab" data-tab="${id}" type="button"${active ? ' aria-current="page"' : ''}>${label}</button>`;
    tabs = `
      <nav class="bottom-tab-bar" role="navigation" aria-label="Primary">
        ${makeTab('documents', 'Documents', ACTIVE_TAB === 'documents')}
        ${makeTab('search', 'Search', ACTIVE_TAB === 'search')}
        ${makeTab('conversations', 'Conversations', ACTIVE_TAB === 'conversations')}
      </nav>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — PIA</title>
  <style>${sharedCss}</style>
</head>
<body>
  <div id="live-region" class="sr-only" aria-live="polite" aria-atomic="true"></div>
  <div class="container">
    <header class="app-header" role="banner">
      <button id="avatar-btn" class="app-header__avatar" type="button" aria-label="Workspace: ${encodedName}. Tap to switch." aria-haspopup="dialog" aria-expanded="false">P</button>
      <div class="app-header__title">${encodedName}</div>
    </header>
    <div class="header">
      <div>
        <h1>${encodedName}</h1>
        <div class="meta">PIA — Personal Intelligence Agent</div>
      </div>
      <nav>
        <a href="/app">← Workspaces</a>
      </nav>
    </div>
    ${tabs}
    <div id="error-container"></div>
    <div id="content">
${bodyHtml}
    </div>
  </div>
  <script type="module">
${sharedJs}
${bodyScript}
  </script>
</body>
</html>`;
}
