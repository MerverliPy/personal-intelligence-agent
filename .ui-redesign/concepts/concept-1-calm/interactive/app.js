/* ============================================================
   Concept 1 — Calm — interactive behavior
   - T1=A tab bar navigation
   - T2=A bottom-sheet citation modal
   - T4=A top-left avatar opens workspace switcher
   - T6=A persistent network banner; destructive actions disabled
   - T7=A FAB opens mode sheet
   - prefers-reduced-motion + dark mode + AX5 toggles
   ============================================================ */

(function () {
  'use strict';

  var root = document.documentElement;
  var body = document.body;
  var app = document.querySelector('.app');

  /* ---------- 1. Tab navigation (T1 = A) ---------- */
  var tabs = document.querySelectorAll('.tab-bar .tab');
  var screens = document.querySelectorAll('.screen');
  var headerTitle = document.getElementById('header-title');
  var backBtn = document.getElementById('back-btn');
  var avatarBtn = document.getElementById('avatar-btn');

  var TITLE_FOR_TAB = {
    conversations: 'Conversations',
    documents: 'Documents',
    search: 'Search',
  };

  function showScreen(name, opts) {
    screens.forEach(function (s) {
      if (s.dataset.screen === name) {
        s.hidden = false;
      } else {
        s.hidden = true;
      }
    });
    tabs.forEach(function (t) {
      if (t.dataset.tab === name) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });
    headerTitle.textContent = (opts && opts.title) || TITLE_FOR_TAB[name] || '';
    backBtn.hidden = !(opts && opts.back);
    body.dataset.screen = name;
    window.scrollTo(0, 0);
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      showScreen(t.dataset.tab);
    });
  });

  /* ---------- 2. Avatar opens workspace switcher (T4 = A) ---------- */
  function openSheet(id) {
    var sheet = document.getElementById(id);
    if (!sheet) return;
    sheet.hidden = false;
    avatarBtn.setAttribute('aria-expanded', 'true');
    // Focus the first focusable element in the panel for keyboard users
    var first = sheet.querySelector('.sheet__panel .sheet__row, .sheet__panel .mode-row');
    if (first) first.focus();
  }
  function closeSheet(id) {
    var sheet = document.getElementById(id);
    if (!sheet) return;
    sheet.hidden = true;
    avatarBtn.setAttribute('aria-expanded', 'false');
  }
  avatarBtn.addEventListener('click', function () { openSheet('workspace-sheet'); });
  backBtn.addEventListener('click', function () {
    showScreen('conversations');
  });

  /* Close on backdrop or Escape */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-close]');
    if (t) closeSheet(t.dataset.close);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      ['workspace-sheet', 'citation-sheet', 'mode-sheet'].forEach(function (id) {
        var s = document.getElementById(id);
        if (s && !s.hidden) closeSheet(id);
      });
    }
  });

  /* ---------- 3. Citation chip → bottom sheet (T2 = A) ---------- */
  var citations = {
    'cite-001': { idx: 1, total: 2, source: 'policy-v3', locator: 'page 1', verification: 'VERIFIED', claim: 'The retention period is 7 years.' },
    'cite-002': { idx: 2, total: 2, source: 'ai-v1',     locator: 'page 4', verification: 'VERIFIED', claim: 'AI and weather summary.' },
    'cite-003': { idx: 1, total: 2, source: 'ai-v1',     locator: 'page 4', verification: 'VERIFIED', claim: 'AI is transforming industries.' },
    'cite-004': { idx: 2, total: 2, source: 'weather-v1',locator: 'page 1', verification: 'VERIFIED', claim: "today's weather is sunny with a high of 75 degrees" },
  };
  document.querySelectorAll('.cite').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var c = citations[chip.dataset.citationId];
      if (!c) return;
      document.getElementById('citation-sheet-eyebrow').textContent =
        'Citation ' + c.idx + ' of ' + c.total;
      var dl = document.querySelector('#citation-sheet .citation-meta');
      dl.innerHTML =
        '<dt>Source</dt><dd>' + c.source + '</dd>' +
        '<dt>Locator</dt><dd>' + c.locator + '</dd>' +
        '<dt>Verification</dt><dd>' + c.verification + '</dd>';
      document.getElementById('citation-claim-text').textContent = c.claim;
      openSheet('citation-sheet');
    });
  });

  /* ---------- 4. Conversation list → detail ---------- */
  document.querySelectorAll('#conversation-list .row').forEach(function (row) {
    row.addEventListener('click', function () {
      showScreen('conversation-detail', { back: true, title: row.querySelector('.row__title').textContent });
    });
  });

  /* ---------- 5. Mode sheet radio behavior (M1) ---------- */
  document.querySelectorAll('#mode-sheet .mode-row').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#mode-sheet .mode-row').forEach(function (b) {
        b.setAttribute('aria-checked', b === btn ? 'true' : 'false');
      });
    });
  });

  /* ---------- 6. FABs (T7 = A) ---------- */
  var fabConv = document.getElementById('fab-conversation');
  var fabDoc = document.getElementById('fab-document');
  if (fabConv) fabConv.addEventListener('click', function () { openSheet('mode-sheet'); });
  if (fabDoc)  fabDoc.addEventListener('click', function () { openSheet('mode-sheet'); /* TODO: replace with upload sheet */ });

  /* ---------- 7. Composer (T5 = A: text-only) ---------- */
  var input = document.getElementById('message-input');
  var sendBtn = document.querySelector('.send-btn');
  if (input) {
    input.addEventListener('input', function () {
      sendBtn.disabled = !input.value.trim();
      // Auto-grow
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 6 * 56) + 'pt';
    });
  }
  var form = document.getElementById('message-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!input.value.trim()) return;
      // In the real product, this would POST to /v1/workspaces/{wid}/conversations/{cid}/messages
      // and open the SSE stream. We only echo.
      var thread = document.getElementById('message-thread');
      var html = '<article class="message message-user" data-message-id="m-new" aria-label="User message"><div class="message__content"></div></article>';
      thread.insertAdjacentHTML('beforeend', html);
      var last = thread.querySelector('article.message-user:last-of-type .message__content');
      last.textContent = input.value;
      input.value = '';
      sendBtn.disabled = true;
      input.style.height = 'auto';
    });
  }

  /* ---------- 8. Network-loss banner (T6 = A) ---------- */
  var offlineToggle = document.getElementById('toggle-offline');
  var banner = document.getElementById('network-banner');
  function setOffline(isOffline) {
    banner.hidden = !isOffline;
    // Disable destructive actions
    document.querySelectorAll('.fab, .send-btn, .citation-open-btn').forEach(function (el) {
      el.disabled = isOffline;
    });
  }
  if (offlineToggle) {
    offlineToggle.addEventListener('change', function () { setOffline(offlineToggle.checked); });
  }

  /* ---------- 9. Dark mode toggle ---------- */
  var darkToggle = document.getElementById('toggle-dark');
  if (darkToggle) {
    darkToggle.addEventListener('change', function () {
      root.classList.toggle('theme-dark', darkToggle.checked);
    });
  }

  /* ---------- 10. Reduce-motion toggle ---------- */
  var rmToggle = document.getElementById('toggle-reduce-motion');
  if (rmToggle) {
    rmToggle.addEventListener('change', function () {
      root.classList.toggle('theme-reduce-motion', rmToggle.checked);
    });
  }

  /* ---------- 11. AX5 (Larger Text) toggle ---------- */
  var ax5Toggle = document.getElementById('toggle-ax5');
  if (ax5Toggle) {
    ax5Toggle.addEventListener('change', function () {
      root.classList.toggle('theme-ax5', ax5Toggle.checked);
    });
  }

  /* ---------- 12. Reset ---------- */
  var resetBtn = document.getElementById('reset-zoom');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      document.documentElement.style.fontSize = '';
      [darkToggle, rmToggle, ax5Toggle, offlineToggle].forEach(function (t) {
        if (t) { t.checked = false; }
      });
      root.classList.remove('theme-dark', 'theme-reduce-motion', 'theme-ax5');
      setOffline(false);
    });
  }

  /* ---------- 13. Initial state ---------- */
  showScreen('conversations');
  if (sendBtn) sendBtn.disabled = true;

  /* ---------- 14. Keyboard: / focuses search ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== document.getElementById('query-input')) {
      e.preventDefault();
      showScreen('search');
      var q = document.getElementById('query-input');
      if (q) setTimeout(function () { q.focus(); }, 50);
    }
  });

  /* ---------- 15. Swipe-down to close sheet (basic) ---------- */
  document.querySelectorAll('.sheet__panel').forEach(function (panel) {
    var startY = 0; var currentY = 0; var dragging = false;
    panel.addEventListener('touchstart', function (e) {
      if (panel.scrollTop > 0) return; // only when at top
      startY = e.touches[0].clientY; dragging = true;
    }, { passive: true });
    panel.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      currentY = e.touches[0].clientY - startY;
      if (currentY > 0) panel.style.transform = 'translateY(' + currentY + 'px)';
    }, { passive: true });
    panel.addEventListener('touchend', function () {
      if (!dragging) return;
      dragging = false;
      if (currentY > 80) {
        var id = panel.closest('.sheet').id;
        closeSheet(id);
      }
      panel.style.transform = '';
      currentY = 0;
    });
  });

})();
