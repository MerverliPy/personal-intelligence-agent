/* ============================================================
   Concept 3 — Stream — interactive behavior
   - T1=A (3 tabs; Conversations is default landing)
   - T2=A bottom-sheet citation modal
   - T4=A top-left avatar opens workspace switcher
   - T6=A persistent network banner; destructive actions disabled
   - T7=A FAB on Documents / Conversations tabs
   - Motion tokens centralized: --motion-sheet, --motion-fade
   ============================================================ */

(function () {
  'use strict';

  var root = document.documentElement;
  var body = document.body;

  var tabs = document.querySelectorAll('.tab-bar .tab');
  var screens = document.querySelectorAll('.screen');
  var headerTitle = document.getElementById('header-title');
  var avatarBtn = document.getElementById('avatar-btn');

  var TITLE_FOR_TAB = {
    conversations: 'Conversations',
    documents: 'Documents',
    search: 'Search',
  };

  function showScreen(name) {
    screens.forEach(function (s) { s.hidden = s.dataset.screen !== name; });
    tabs.forEach(function (t) {
      if (t.dataset.tab === name) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });
    headerTitle.textContent = TITLE_FOR_TAB[name] || '';
    body.dataset.screen = name;
    window.scrollTo(0, 0);
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () { showScreen(t.dataset.tab); });
  });

  function openSheet(id) {
    var sheet = document.getElementById(id);
    if (!sheet) return;
    sheet.hidden = false;
    var first = sheet.querySelector('.sheet__panel .mode-row');
    if (first) first.focus();
  }
  function closeSheet(id) {
    var sheet = document.getElementById(id);
    if (sheet) sheet.hidden = true;
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-close]');
    if (t) closeSheet(t.dataset.close);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      ['citation-sheet', 'mode-sheet'].forEach(function (id) {
        var s = document.getElementById(id);
        if (s && !s.hidden) closeSheet(id);
      });
    }
  });

  /* Avatar → workspace switcher (T4 = A) */
  if (avatarBtn) {
    avatarBtn.addEventListener('click', function () {
      // Stream uses the avatar to open a sheet — reuses the citation sheet as a stand-in
      // (the prototype's workspace switcher sheet is identical in shape).
      openSheet('citation-sheet');
      // In a real implementation, a separate #workspace-sheet would be opened.
    });
  }

  /* Citation chip → sheet */
  var citations = {
    'cite-001': { idx: 1, total: 2, source: 'policy-v3', locator: 'page 1', verification: 'VERIFIED', claim: 'The retention period is 7 years.' },
    'cite-002': { idx: 2, total: 2, source: 'ai-v1', locator: 'page 4', verification: 'VERIFIED', claim: 'AI and weather summary.' },
    'cite-003': { idx: 1, total: 2, source: 'ai-v1', locator: 'page 4', verification: 'VERIFIED', claim: 'AI is transforming industries.' },
    'cite-004': { idx: 2, total: 2, source: 'weather-v1', locator: 'page 1', verification: 'VERIFIED', claim: "today's weather is sunny with a high of 75 degrees" },
  };
  document.querySelectorAll('.cite').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var c = citations[chip.dataset.citationId];
      if (!c) return;
      document.getElementById('citation-sheet-eyebrow').textContent = 'Citation ' + c.idx + ' of ' + c.total;
      var dl = document.querySelector('#citation-sheet .citation-meta');
      dl.innerHTML =
        '<dt>Source</dt><dd>' + c.source + '</dd>' +
        '<dt>Locator</dt><dd>' + c.locator + '</dd>' +
        '<dt>Verification</dt><dd>' + c.verification + '</dd>';
      document.getElementById('citation-claim-text').textContent = c.claim;
      openSheet('citation-sheet');
    });
  });

  /* Conversation list → detail */
  document.querySelectorAll('#conversation-list .conv').forEach(function (row) {
    row.addEventListener('click', function () {
      screens.forEach(function (s) { s.hidden = s.dataset.screen !== 'conversation-detail'; });
      tabs.forEach(function (t) { t.removeAttribute('aria-current'); });
      headerTitle.textContent = row.querySelector('.conv__title').textContent;
      body.dataset.screen = 'conversation-detail';
    });
  });
  var backBtn = document.getElementById('back-btn');
  if (backBtn) backBtn.addEventListener('click', function () { showScreen('conversations'); });

  /* Mode radio */
  document.querySelectorAll('#mode-sheet .mode-row').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#mode-sheet .mode-row').forEach(function (b) {
        b.setAttribute('aria-checked', b === btn ? 'true' : 'false');
      });
    });
  });

  /* FABs */
  var fabConv = document.getElementById('fab-conversation');
  var fabDoc = document.getElementById('fab-document');
  if (fabConv) fabConv.addEventListener('click', function () { openSheet('mode-sheet'); });
  if (fabDoc)  fabDoc.addEventListener('click', function () { openSheet('mode-sheet'); /* TODO: upload sheet */ });

  /* Composer */
  var input = document.getElementById('message-input');
  var sendBtn = document.querySelector('.send-btn');
  if (input) {
    input.addEventListener('input', function () {
      sendBtn.disabled = !input.value.trim();
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 8 * 56) + 'pt';
    });
  }
  var form = document.getElementById('message-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!input.value.trim()) return;
      var thread = document.getElementById('message-thread');
      var html = '<article class="message message-user" data-message-id="m-new"><div class="message__content"></div><div class="message__meta"><time>now</time></div></article>';
      thread.insertAdjacentHTML('beforeend', html);
      var last = thread.querySelector('article.message-user:last-of-type .message__content');
      last.textContent = input.value;
      input.value = '';
      sendBtn.disabled = true;
      input.style.height = 'auto';
    });
  }

  /* Network banner */
  var offlineToggle = document.getElementById('toggle-offline');
  var banner = document.getElementById('network-banner');
  function setOffline(isOffline) {
    banner.hidden = !isOffline;
    document.querySelectorAll('.fab, .send-btn, .citation-open-btn').forEach(function (el) {
      el.disabled = isOffline;
    });
  }
  if (offlineToggle) offlineToggle.addEventListener('change', function () { setOffline(offlineToggle.checked); });

  /* Toggles */
  var darkToggle = document.getElementById('toggle-dark');
  if (darkToggle) darkToggle.addEventListener('change', function () { root.classList.toggle('theme-dark', darkToggle.checked); });
  var rmToggle = document.getElementById('toggle-reduce-motion');
  if (rmToggle) rmToggle.addEventListener('change', function () { root.classList.toggle('theme-reduce-motion', rmToggle.checked); });
  var ax5Toggle = document.getElementById('toggle-ax5');
  if (ax5Toggle) ax5Toggle.addEventListener('change', function () { root.classList.toggle('theme-ax5', ax5Toggle.checked); });

  var resetBtn = document.getElementById('reset-zoom');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      [darkToggle, rmToggle, ax5Toggle, offlineToggle].forEach(function (t) { if (t) t.checked = false; });
      root.classList.remove('theme-dark', 'theme-reduce-motion', 'theme-ax5');
      setOffline(false);
    });
  }

  /* Initial: Conversations is the default landing */
  showScreen('conversations');
  if (sendBtn) sendBtn.disabled = true;

  /* Keyboard shortcut: / focuses search */
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== document.getElementById('query-input')) {
      e.preventDefault();
      showScreen('search');
      var q = document.getElementById('query-input');
      if (q) setTimeout(function () { q.focus(); }, 50);
    }
  });

  /* Swipe-down to close sheet */
  document.querySelectorAll('.sheet__panel').forEach(function (panel) {
    var startY = 0; var currentY = 0; var dragging = false;
    panel.addEventListener('touchstart', function (e) {
      if (panel.scrollTop > 0) return;
      startY = e.touches[0].clientY; dragging = true;
    }, { passive: true });
    panel.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      currentY = e.touches[0].clientY - startY;
      if (currentY > 0) panel.style.transform = 'translateY(' + currentY + 'pt)';
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
