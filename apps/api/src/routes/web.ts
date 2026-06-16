import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

/**
 * Web shell — serves a minimal authenticated HTML page.
 *
 * In production this would be served by a dedicated Next.js frontend
 * (apps/web). For P1-T07 the shell is served directly from the API
 * as a convenience.
 */
const webShell: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/', async (_request, reply) => {
    return reply.redirect('/app', 302);
  });

  app.get('/app', async (_request, reply) => {
    void reply.header('content-type', 'text/html; charset=utf-8');
    return WEB_SHELL_HTML;
  });
};

const WEB_SHELL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>PIA — Personal Intelligence Agent</title>
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta name="theme-color" content="#2563EB">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #f5f5f5; color: #1a1a1a; line-height: 1.5; }
    .container { max-width: 960px; margin: 0 auto; padding: 2rem 1rem; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #e0e0e0; }
    .header h1 { font-size: 1.5rem; font-weight: 600; }
    .error { background: #fff0f0; border: 1px solid #ffcccc; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; color: #cc0000; }
    .card { background: white; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .card h2 { font-size: 1.1rem; margin-bottom: 0.5rem; }
    .card .meta { font-size: 0.85rem; color: #666; }
    .projects { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #f0f0f0; }
    .projects ul { list-style: none; }
    .projects li { padding: 0.35rem 0; font-size: 0.9rem; color: #444; }
    .loading { color: #888; font-style: italic; }
    .btn { display: inline-block; padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid #ccc; background: white; cursor: pointer; font-size: 0.9rem; }
    .btn-primary { background: #1a1a1a; color: white; border-color: #1a1a1a; }
    .empty { color: #999; padding: 2rem 0; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>PIA</h1>
      <span id="user-display"><a href="/auth/login" class="btn btn-primary">Sign In</a></span>
    </div>
    <div id="error-container"></div>
    <div id="content"><div class="loading">Loading workspaces...</div></div>
  </div>

  <script type="module">
    const content = document.getElementById('content');
    const errorContainer = document.getElementById('error-container');
    const userDisplay = document.getElementById('user-display');

    function showError(message) {
      errorContainer.innerHTML = '<div class="error">' + escapeHtml(message) + '</div>';
    }

    function clearError() { errorContainer.innerHTML = ''; }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.appendChild(document.createTextNode(str));
      return div.innerHTML;
    }

    async function apiFetch(path) {
      const res = await fetch(path);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const code = body?.error?.code || 'UNKNOWN';
        const msg = body?.error?.message || 'Request failed';
        throw new Error(code + ': ' + msg);
      }
      return res.json();
    }

    async function load() {
      clearError();
      try {
        // Load current user
        const me = await apiFetch('/v1/me');
        userDisplay.textContent = me.display_name || me.email;

        // Load workspaces
        const { items: workspaces } = await apiFetch('/v1/workspaces');

        if (workspaces.length === 0) {
          content.innerHTML = '<div class="empty">No workspaces yet. Create one to get started.</div>';
          return;
        }

        let html = '';
        for (const ws of workspaces) {
          html += '<div class="card ws-card" data-href="/app/workspaces/' + ws.id + '/conversations" role="link" tabindex="0" style="cursor:pointer;"><h2>' + escapeHtml(ws.name) + '</h2>';
          html += '<div class="meta">Workspace &middot; Created ' + new Date(ws.created_at).toLocaleDateString() + '</div>';

          // Load projects for this workspace
          try {
            const { items: projects } = await apiFetch('/v1/workspaces/' + ws.id + '/projects');
            if (projects.length > 0) {
              html += '<div class="projects"><strong>Projects</strong><ul>';
              for (const proj of projects) {
                html += '<li>' + escapeHtml(proj.name) + (proj.description ? ' &mdash; ' + escapeHtml(proj.description) : '') + '</li>';
              }
              html += '</ul></div>';
            }
          } catch (e) {
            // Silently skip project loading errors
          }

          html += '</div>';
        }
        content.innerHTML = html;
        // iOS PWA: use click handlers instead of <a> tags to stay in standalone mode
        content.querySelectorAll('.ws-card').forEach(function(card) {
          card.addEventListener('click', function() { window.location.href = card.getAttribute('data-href'); });
          card.addEventListener('keydown', function(e) { if (e.key === 'Enter') window.location.href = card.getAttribute('data-href'); });
        });
      } catch (err) {
        showError(err.message);
        content.innerHTML = '<div class="empty">Unable to load.<br><br><a href="/auth/login" class="btn btn-primary">Sign In</a></div>';
      }
    }

    load();
  </script>
</body>
</html>`;

export default webShell;
