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
    --danger: #DC2626;
    --status-failed-bg: #FEF2F2;
    --status-failed-fg: #991B1B;
    --z-tab-bar: 10;
    --z-fab: 20;
    --z-banner: 50;
    --z-sheet: 100;
    --z-status: 1000;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--fg); line-height: 1.42; min-height: 100dvh; min-height: 100vh;
          padding-top: max(env(safe-area-inset-top, 0px), 59pt);
          padding-bottom: env(safe-area-inset-bottom, 0px);
          padding-left: env(safe-area-inset-left, 0px);
          padding-right: env(safe-area-inset-right, 0px);
  }
  .container { max-width: 960px; margin: 0 auto; padding: var(--s-4); }
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
    z-index: var(--z-tab-bar);
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
  .bottom-tab[aria-current="page"] { color: var(--accent); position: relative; }
  .bottom-tab[aria-current="page"]::after { content: ''; position: absolute; top: 0; left: 30%; width: 40%; height: 2pt; background: var(--accent); border-radius: 0 0 2pt 2pt; }
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

  /* Fresh-chat quick-ask composer on conversation list page */
  .quick-ask-form { margin: var(--s-4) 0; }
  .quick-ask__row { display: flex; gap: var(--s-3); align-items: flex-end; }
  .quick-ask-form textarea { flex: 1; resize: none; border: 1pt solid var(--divider); border-radius: var(--r-md); padding: var(--s-3); font: inherit; font-size: var(--t-body); min-height: 44pt; max-height: 120px; }
  .quick-ask-form .send-btn { min-width: 56pt; min-height: 44pt; border-radius: var(--r-md); font-size: var(--t-body); font-weight: 600; }
  .quick-ask__hint { display: block; color: var(--fg-subtle); font-size: var(--t-caption); margin-top: var(--s-2); }
  .conversation-list-heading { font-size: var(--t-section); font-weight: 700; margin: var(--s-6) 0 var(--s-3) 0; }

  /* Conversation layout: thread fills space, form sticks at the bottom */
  .conversation-layout { display: flex; flex-direction: column; min-height: calc(100dvh - 59pt - var(--tab-bar-h) - env(safe-area-inset-bottom, 0px) - 2*var(--s-4)); }
  .message-thread-section { flex: 1; overflow-y: auto; min-height: 0; }
  .message-form { position: sticky; bottom: 0; background: var(--bg); border-top: 0.5pt solid var(--divider); padding: var(--s-3) 0; margin-top: auto; }
  .message-form__row { display: flex; gap: var(--s-3); align-items: flex-end; }
  .message-form textarea { flex: 1; resize: none; border: 1pt solid var(--divider); border-radius: var(--r-md); padding: var(--s-3); font: inherit; font-size: var(--t-body); min-height: 44pt; max-height: 200px; }
  .message-form .send-btn { min-width: 56pt; min-height: 44pt; border-radius: var(--r-md); }

  .app-header__title {
    font-size: var(--t-body);
    font-weight: 700;
    letter-spacing: -0.02em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* PIA-MUR-D-004-IMPL commit 5: network-loss banner (T6=A).
   * Sits below the Dynamic Island, disables destructive actions
   * (FAB, Send, btn-danger) when offline. */
  .network-banner {
    position: fixed;
    top: max(env(safe-area-inset-top, 0px), 59pt);
    left: 0; right: 0;
    padding: 8pt 16pt;
    background: var(--status-failed-bg);
    color: var(--status-failed-fg);
    text-align: center;
    font-size: var(--t-caption);
    z-index: var(--z-banner);
    display: none;
  }
  .network-banner[data-offline="true"] { display: block; }

  /* PIA-MUR-D-004-IMPL commit 6: footnote-style citation chip
   * (PIA-MUR-D-009 44pt tap area) + slide-up citation sheet
   * (wraps the existing <dialog> in a sheet container). */
  .citation-chip {
    background: transparent;
    border: 0;
    color: var(--accent);
    font: inherit;
    font-size: 0.85em;
    text-decoration: none;
    min-width: var(--touch-min);
    min-height: var(--touch-min);
    padding: 0 4pt;
    cursor: pointer;
  }
  .citation-chip:hover, .citation-chip:focus-visible { text-decoration: underline; }
  .citation-sheet { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: var(--z-sheet); display: flex; align-items: flex-end; justify-content: center; }
  .citation-sheet[hidden] { display: none; }
  .citation-sheet__panel { width: 100%; max-width: 480px; max-height: 80vh; overflow-y: auto; background: var(--bg); border-top-left-radius: var(--r-lg); border-top-right-radius: var(--r-lg); padding: var(--s-4); transform: translateY(100%); transition: transform var(--motion-sheet) var(--motion-ease); }
  .citation-sheet.sheet-open .citation-sheet__panel { transform: translateY(0); }

  /* PIA-MUR-D-004-IMPL commit 7: FAB (T7=A) + mode-of-conversation
   * sheet. FAB is 56pt x 56pt; sits above the bottom tab bar. */
  .fab {
    position: fixed;
    bottom: calc(var(--tab-bar-h) + env(safe-area-inset-bottom, 0px) + var(--s-4));
    right: var(--s-4);
    width: 56pt;
    height: 56pt;
    border-radius: 50%;
    background: var(--accent);
    color: var(--accent-fg);
    border: 0;
    font-size: 24pt;
    font-weight: 700;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4pt 12pt rgba(0,0,0,0.2);
    cursor: pointer;
    z-index: 20;
    padding: 0;
  }
  .fab:focus-visible { outline: 2pt solid var(--accent); outline-offset: 2pt; }
  .fab:disabled { opacity: 0.4; cursor: not-allowed; }
  .sheet { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: var(--z-sheet); display: flex; align-items: flex-end; justify-content: center; }
  .sheet[hidden] { display: none; }
  .sheet__panel { width: 100%; max-width: 480px; max-height: 80vh; overflow-y: auto; background: var(--bg); border-top-left-radius: var(--r-lg); border-top-right-radius: var(--r-lg); padding: var(--s-4); transform: translateY(100%); transition: transform var(--motion-sheet) var(--motion-ease); }
  .sheet.sheet-open .sheet__panel { transform: translateY(0); }
  .sheet__panel h2 { margin: 0 0 var(--s-3) 0; font-size: 1.1em; }
  .mode-row { display: block; width: 100%; min-height: var(--touch-min); text-align: left; background: transparent; border: 0; border-bottom: 1px solid var(--divider); padding: var(--s-3) var(--s-2); font: inherit; cursor: pointer; }
  .mode-row:focus-visible { background: var(--selection); }
  .mode-row:last-child { border-bottom: 0; }
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

/* PIA-MUR-D-004-IMPL commit 5: network-loss banner.
 * Shows the banner when offline; disables destructive actions
 * (FAB, Send, btn-danger) so the user can't submit work that
 * won't reach the server. The existing app's resubmit path uses
 * idempotency keys (per AGENTS.md), so a delayed retry after
 * reconnect will not double-submit. */
var netBanner = document.getElementById('network-banner');
function setOffline(offline) {
  if (!netBanner) return;
  netBanner.hidden = !offline;
  if (offline) netBanner.setAttribute('data-offline', 'true');
  else netBanner.removeAttribute('data-offline');
  document.querySelectorAll('.fab, .send-btn, .btn-danger').forEach(function (el) {
    el.disabled = offline;
  });
}
window.addEventListener('online',  function () { setOffline(false); });
window.addEventListener('offline', function () { setOffline(true); });
setOffline(!navigator.onLine);

/* PIA-MUR-D-004-IMPL commit 3 + critique fix: tab click handler.
 * Extracts workspace ID from the current URL path to avoid relying
 * on window.__piaWorkspaceId (which isn't set on all pages). */
function getWorkspaceIdFromUrl() {
  var m = window.location.pathname.match(/^\/app\/workspaces\/([^\/]+)/);
  return m ? m[1] : '';
}
function initTabNav() {
  var wid = getWorkspaceIdFromUrl();
  // Expose for other code that may need it
  window.__piaWorkspaceId = wid;
  document.querySelectorAll('.bottom-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      var tabId = tab.getAttribute('data-tab');
      if (!tabId) return;
      var routes = { conversations: 'conversations', documents: 'documents', search: 'search' };
      if (routes[tabId]) window.location.href = '/app/workspaces/' + wid + '/' + routes[tabId];
    });
  });
}
initTabNav();

/* PIA-MUR-D-004-IMPL commit 7: FAB + mode-of-conversation
 * sheet (T7=A). The FAB on the Conversations tab opens the
 * mode sheet; selecting a mode posts to /v1/workspaces/:wid/
 * conversations and navigates to the new conversation. */
var modeSheet = document.getElementById('mode-sheet');
function openSheet(el) {
  if (!el) return;
  el.hidden = false;
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      el.classList.add('sheet-open');
    });
  });
}
function closeSheet(el) {
  if (!el) return;
  el.classList.remove('sheet-open');
  var done = function() {
    el.removeEventListener('transitionend', done);
    el.hidden = true;
  };
  el.addEventListener('transitionend', done);
}
function openModeSheet() { openSheet(modeSheet); }
function closeModeSheet() { closeSheet(modeSheet); }
if (modeSheet) {
  var fabConv = document.getElementById('fab-conversation');
  if (fabConv) fabConv.addEventListener('click', openModeSheet);
  modeSheet.querySelectorAll('.mode-row[data-mode]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var mode = btn.getAttribute('data-mode');
      // Disable button to prevent double-tap
      btn.disabled = true;
      try {
        var c = await apiFetch('/v1/workspaces/' + (window.__piaWorkspaceId || '') + '/conversations', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mode: mode, title: null }),
        });
        window.location.href = '/app/workspaces/' + (window.__piaWorkspaceId || '') + '/conversations/' + c.id;
      } catch (err) {
        showError('Failed to create conversation: ' + err.message);
        btn.disabled = false;
        closeModeSheet();
      }
    });
  });
  // Esc key closes the mode sheet
  modeSheet.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeModeSheet();
  });
}

/* PIA-MUR-D-004-IMPL commit 8: service-worker registration.
 * PIA is a network-required PWA (per PIA-MUR-D-001 / DECISION_LEDGER).
 * The SW caches the shell so a second visit is fast; the /v1/* API
 * and SSE streams are excluded from caching (see sw.js). */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function (err) {
      console.warn('PIA SW registration failed:', err);
    });
  });
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
    // PIA-MUR-D-004-IMPL commit 3 + critique fix: 3-tab mobile-first bottom bar
    // (Conversations / Documents / Search). Conversations is the default landing.
    // Upload is a sub-page of Documents and is reached via the FAB (commit 7).
    const ACTIVE_TAB = tabActive === 'upload' ? 'documents' : tabActive;
    const makeTab = (id: string, label: string, active: boolean) =>
      `<button class="bottom-tab" data-tab="${id}" type="button"${active ? ' aria-current="page"' : ''}>${label}</button>`;
    tabs = `
      <nav class="bottom-tab-bar" role="navigation" aria-label="Primary">
        ${makeTab('conversations', 'Conversations', ACTIVE_TAB === 'conversations')}
        ${makeTab('documents', 'Documents', ACTIVE_TAB === 'documents')}
        ${makeTab('search', 'Search', ACTIVE_TAB === 'search')}
      </nav>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${title} — PIA</title>
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta name="theme-color" content="#2563EB">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <style>${sharedCss}</style>
</head>
<body>
  <a href="#content" class="sr-only skip-link" style="position:absolute;left:-9999px;top:0;z-index:9999;padding:8px;background:var(--bg);color:var(--accent);" onfocus="this.style.left='0'" onblur="this.style.left='-9999px'">Skip to main content</a>
  <div id="live-region" class="sr-only" aria-live="polite" aria-atomic="true"></div>
  <div id="network-banner" class="network-banner" role="status" aria-live="polite" hidden>You're offline. Some actions are disabled.</div>
  <div class="container">
    <header class="app-header" role="banner">
      <button id="avatar-btn" class="app-header__avatar" type="button" aria-label="Workspace: ${encodedName}. Tap to switch." aria-haspopup="dialog" aria-expanded="false">${encodedName.charAt(0).toUpperCase() || '?'}</button>
      <div class="app-header__title">${encodedName}</div>
    </header>
    ${tabs}
    <div id="error-container"></div>
    <div id="content" tabindex="-1">
${bodyHtml}
    </div>
    <div id="mode-sheet" class="sheet" role="dialog" aria-modal="true" aria-labelledby="mode-sheet-title" hidden>
      <div class="sheet__panel" onclick="event.stopPropagation()">
        <h2 id="mode-sheet-title">Mode</h2>
        <button class="mode-row" type="button" data-mode="ASK">Ask</button>
        <button class="mode-row" type="button" data-mode="RESEARCH">Research</button>
        <button class="mode-row" type="button" data-mode="ANALYZE">Analyze</button>
        <button class="mode-row" type="button" data-mode="PLAN">Plan</button>
        <button class="mode-row" type="button" data-mode="EXECUTE">Execute</button>
        <button class="mode-row" type="button" data-mode="LEARN">Learn</button>
        <button class="mode-row" type="button" onclick="document.getElementById('mode-sheet').hidden=true" style="border-bottom:0;color:var(--accent);text-align:center">Cancel</button>
      </div>
    </div>
  </div>
  <script type="module">
${sharedJs}
${bodyScript}
  </script>
</body>
</html>`;
}
