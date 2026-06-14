/* ============================================================
   Concept 2 — Workspace — interactive behavior
   - T1=A (4-tab variant: Documents / Search / Conversations / Workspace)
   - T2=A bottom-sheet citation modal
   - T4=A top-left avatar (also the Workspace tab as a peer)
   - T6=A persistent network banner; destructive actions disabled
   - T7=A FAB on Documents / Conversations tabs
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
    documents: 'Documents',
    search: 'Search',
    conversations: 'Conversations',
    workspace: 'Workspace',
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

  /* Sheet open/close (used by citation + mode) */
  function openSheet(id) {
    var sheet = document.getElementById(id);
    if (!sheet) return;
    sheet.hidden = false;
    var first = sheet.querySelector('.sheet__panel .sheet__row, .sheet__panel .mode-row');
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

  /* Citation chip → sheet */
  var citations = {
    'cite-001': { idx: 1, total: 2, source: 'policy-v3', locator: 'page 1', verification: 'VERIFIED', claim: 'The retention period is 7 years.' },
    'cite-002': { idx: 2, total: 2, source: 'ai-v1', locator: 'page 4', verification: 'VERIFIED', claim: 'AI and weather summary.' },
  };
  document.querySelectorAll('.cite-pill').forEach(function (chip) {
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

  /* Conversation list → detail (hidden screen) */
  document.querySelectorAll('#conversation-list .card').forEach(function (card) {
    card.addEventListener('click', function () {
      screens.forEach(function (s) { s.hidden = s.dataset.screen !== 'conversation-detail'; });
      tabs.forEach(function (t) { t.removeAttribute('aria-current'); });
      headerTitle.textContent = 'Conversation';
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
      input.style.height = Math.min(input.scrollHeight, 6 * 56) + 'pt';
    });
  }
  var form = document.getElementById('message-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!input.value.trim()) return;
      var thread = document.getElementById('message-thread');
      var html = '<article class="message message-user" data-message-id="m-new"><div class="message__content"></div></article>';
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

  /* Initial: Documents is the default landing (per the Workspace thesis) */
  showScreen('documents');
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

})();
