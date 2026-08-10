/* ============================================================
   书影记录 · 线上编辑脚本
   - 有服务器 API 时：用 /api/bookfilm 数据渲染页面，支持编辑
   - 无 API（如纯静态托管）时：页面保持原有静态内容，不做任何改动
   - 编辑需先在本地选择密钥文件 edit-key.txt 验证通过后才能开启
   ============================================================ */
(function () {
  'use strict';

  var API = '/api/bookfilm';
  var CHECK_API = '/api/check-key';
  var apiOk = false;
  var editKey = null;      // 本次会话的密钥，只保存在内存里
  var editOn = false;
  var dirty = false;
  var state = { movies: [], books: [] };

  var BRUSH = null;

  /* ---------- 工具 ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function textOf(sel, root) { var el = $(sel, root); return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }

  function toast(msg, ok) {
    var t = document.createElement('div');
    t.className = 'bf-toast' + (ok ? ' bf-toast-ok' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 20);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 2200);
  }

  function markDirty() {
    if (!dirty) {
      dirty = true;
      var b = $('.bf-save');
      if (b) b.textContent = '保存修改 ●未保存';
    }
  }

  /* ---------- 渲染 ---------- */
  function sprocket() {
    return '<svg class="bf-sprockets" viewBox="0 0 200 12" width="100%" height="12" aria-hidden="true">' +
      '<rect width="200" height="12" fill="var(--bf-strip)"/>' +
      '<rect width="200" height="12" fill="url(#bf-holes)"/></svg>';
  }

  function movieFrame(it) {
    return '<figure class="bf-frame" data-bf-review="bf-review-' + esc(it.id) + '" data-year="' + esc(it.year || '') + '" role="button" tabindex="0" aria-haspopup="dialog">' +
      sprocket() +
      '<div class="bf-gate"><div class="bf-gate-hint">' +
      '<span class="bf-gate-play">&#9654;</span>' +
      '<span class="bf-gate-hint-text">点击查看短评</span>' +
      '</div></div>' +
      sprocket() +
      '<figcaption class="bf-frame-caption"><b>' + esc(it.title) + '</b><span data-field="year">' + esc(it.en || '') + ' · ' + esc(it.year || '') + '</span></figcaption>' +
      '</figure>';
  }

  function bookHtml(it) {
    return '<div class="bf-book" data-bf-review="bf-review-' + esc(it.id) + '" data-color="' + esc(it.color || 'bf-book-color-default') + '" role="button" tabindex="0" aria-haspopup="dialog">' +
      '<div class="bf-book-cover ' + esc(it.color || 'bf-book-color-default') + '">' +
      '<span class="bf-book-title">' + esc(it.title) + '</span>' +
      '<span class="bf-book-hint">点击查看书评</span>' +
      '</div>' +
      '<div class="bf-book-spine"></div>' +
      '<div class="bf-book-pages"></div>' +
      '<div class="bf-book-kick"></div>' +
      '</div>';
  }

  function reviewHtml(it, type) {
    var tag = type === 'movie'
      ? '<span class="bf-review-tag bf-tag-movie">电影</span>'
      : '<span class="bf-review-tag bf-tag-book">书本</span>';
    var quote = it.quote ? '<blockquote class="bf-review-quote">「' + esc(it.quote) + '」</blockquote>' : '';
    return '<div class="bf-review" id="bf-review-' + esc(it.id) + '" data-type="' + type + '" style="--bf-card-accent:' + esc(it.accent || '#c08a4a') + '">' +
      tag +
      '<h4 class="bf-review-title"><span data-field="title">' + esc(it.title) + '</span> <span class="bf-review-en" data-field="en">' + esc(it.en || '') + '</span></h4>' +
      '<p class="bf-review-meta" data-field="meta">' + esc(it.meta || '') + '</p>' +
      '<p class="bf-review-stars" data-field="stars">' + esc(it.stars || '') + '</p>' +
      '<p class="bf-review-text" data-field="text">' + esc(it.text || '') + '</p>' +
      quote +
      '</div>';
  }

  function placeholderHtml(kind) {
    return '<p class="bf-empty">还没有内容，点击右下角编辑按钮添加' + (kind === 'movie' ? '电影' : '书本') + '吧。</p>';
  }

  function render() {
    if (!BRUSH) return;
    var moviesEl = $('.bf-movies'), booksEl = $('.bf-books'), bodyEl = $('.bf-modal-body');
    if (moviesEl) {
      moviesEl.innerHTML = '<h3 class="bf-side-title">电影 <span class="bf-en">MOVIES</span></h3>' +
        '<div class="bf-filmstrip">' +
        (state.movies.length ? state.movies.map(movieFrame).join('') : placeholderHtml('movie')) +
        '</div>';
    }
    if (booksEl) {
      booksEl.innerHTML = '<h3 class="bf-side-title">书本 <span class="bf-en">BOOKS</span></h3>' +
        '<div class="bf-bookcase">' +
        (state.books.length ? state.books.map(bookHtml).join('') : placeholderHtml('book')) +
        '</div>' +
        '<div class="bf-shelf"></div>';
    }
    if (bodyEl) {
      bodyEl.innerHTML = state.movies.map(function (m) { return reviewHtml(m, 'movie'); }).join('') +
        state.books.map(function (b) { return reviewHtml(b, 'book'); }).join('');
    }
    bindCards();
    if (editOn) applyEditUI();
  }

  /* ---------- 弹窗 ---------- */
  function openReview(id) {
    var modal = $('#bf-modal');
    var target = document.getElementById(id);
    if (!modal || !target) return;
    $$('.bf-review', modal).forEach(function (el) { el.classList.remove('active'); });
    target.classList.add('active');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeReview() {
    var modal = $('#bf-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function bindCards() {
    $$('[data-bf-review]').forEach(function (card) {
      if (card.__bfBound) return;
      card.__bfBound = true;
      card.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('.bf-del')) return;
        openReview('bf-review-' + card.getAttribute('data-bf-review').replace('bf-review-', ''));
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openReview('bf-review-' + card.getAttribute('data-bf-review').replace('bf-review-', ''));
        }
      });
    });
  }

  /* ---------- 数据 ---------- */
  function normalize(data) {
    state.movies = (data && Array.isArray(data.movies)) ? data.movies : [];
    state.books = (data && Array.isArray(data.books)) ? data.books : [];
  }

  function loadData() {
    fetch(API, { headers: { 'Accept': 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('no-api'); return r.json(); })
      .then(function (data) {
        apiOk = true;
        normalize(data);
        render();
        showEditEntry();
      })
      .catch(function () { /* 静态托管：保持页面原样 */ });
  }

  /* ---------- 编辑入口 ---------- */
  function showEditEntry() {
    var btn = $('.bf-edit-btn');
    if (!btn) return;
    btn.hidden = false;
  }

  function buildEditUI() {
    var style = document.createElement('style');
    style.textContent =
      '.bf-edit-btn{position:fixed;right:22px;bottom:22px;width:48px;height:48px;border-radius:50%;border:none;cursor:pointer;font-size:19px;color:#fff;background:#4a6fa5;box-shadow:0 6px 18px rgba(0,0,0,.35);z-index:1500;}' +
      '.bf-edit-btn:hover{background:#3c5b89;transform:scale(1.06);}' +
      '.bf-editbar{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);display:flex;gap:8px;align-items:center;padding:8px 14px;background:var(--bf-card-bg,#fff);border:1px solid var(--bf-card-line,#ddd);border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,.25);z-index:1500;font-size:13px;flex-wrap:wrap;justify-content:center;}' +
      '.bf-editbar .bf-e-status{color:var(--bf-muted,#888);margin-right:4px;}' +
      '.bf-editbar button{border:none;border-radius:999px;padding:6px 12px;cursor:pointer;font-size:13px;background:#eef1f5;color:#333;}' +
      '.bf-editbar button:hover{background:#dde4ec;}' +
      '.bf-editbar .bf-save{background:#2e7d32;color:#fff;}' +
      '.bf-editbar .bf-save:hover{background:#27632a;}' +
      '.bf-editbar .bf-e-exit{background:#c0392b;color:#fff;}' +
      '.bf-editbar .bf-e-exit:hover{background:#a33224;}' +
      '.bf-edit-on [data-field]:hover{outline:2px dashed rgba(74,111,165,.65);outline-offset:2px;cursor:text;border-radius:3px;}' +
      '.bf-edit-on [data-field]:focus{outline:2px solid rgba(74,111,165,.9);outline-offset:2px;border-radius:3px;}' +
      '.bf-del{position:absolute;top:-9px;right:-9px;width:24px;height:24px;border-radius:50%;border:none;background:#c0392b;color:#fff;font-size:14px;line-height:1;cursor:pointer;z-index:6;box-shadow:0 3px 8px rgba(0,0,0,.3);}' +
      '.bf-del:hover{background:#a33224;}' +
      '.bf-keydialog{position:fixed;inset:0;z-index:1800;display:flex;align-items:center;justify-content:center;background:rgba(10,10,14,.5);}' +
      '.bf-keydialog-card{width:min(430px,92vw);background:var(--bf-card-bg,#fff);border-radius:12px;padding:26px 26px 20px;box-shadow:0 24px 70px rgba(0,0,0,.4);color:var(--bf-text,#333);}' +
      '.bf-keydialog-card h4{margin:0 0 10px;font-size:18px;}' +
      '.bf-keydialog-card p{margin:0 0 16px;font-size:14px;line-height:1.8;color:var(--bf-muted,#888);}' +
      '.bf-keydialog-card p b{color:var(--bf-text,#333);}' +
      '.bf-keydialog-card input[type=file]{display:block;width:100%;margin-bottom:16px;font-size:13px;}' +
      '.bf-keydialog-actions{text-align:right;}' +
      '.bf-keydialog-actions button{border:none;border-radius:8px;padding:8px 16px;cursor:pointer;background:#eef1f5;color:#333;font-size:13px;}' +
      '.bf-keydialog-actions button:hover{background:#dde4ec;}' +
      '.bf-toast{position:fixed;left:50%;bottom:84px;transform:translateX(-50%) translateY(10px);background:#333;color:#fff;padding:9px 18px;border-radius:999px;font-size:13px;opacity:0;transition:all .25s;z-index:2000;box-shadow:0 8px 24px rgba(0,0,0,.3);}' +
      '.bf-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}' +
      '.bf-toast-ok{background:#2e7d32;}';
    document.head.appendChild(style);

    // 编辑按钮
    var btn = document.createElement('button');
    btn.className = 'bf-edit-btn';
    btn.title = '编辑书影内容（需密钥文件）';
    btn.setAttribute('aria-label', '编辑书影内容');
    btn.textContent = '\u270E';
    btn.hidden = true;
    btn.addEventListener('click', showKeyDialog);
    document.body.appendChild(btn);

    // 编辑工具栏
    var bar = document.createElement('div');
    bar.className = 'bf-editbar';
    bar.hidden = true;
    bar.innerHTML =
      '<span class="bf-e-status">编辑模式已开启</span>' +
      '<button type="button" data-act="add-movie">＋ 新增电影</button>' +
      '<button type="button" data-act="add-book">＋ 新增书本</button>' +
      '<button type="button" class="bf-save" data-act="save">保存修改</button>' +
      '<button type="button" class="bf-e-exit" data-act="exit">退出编辑</button>';
    bar.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (act === 'add-movie') addItem('movie');
      else if (act === 'add-book') addItem('book');
      else if (act === 'save') save();
      else if (act === 'exit') disableEdit();
    });
    document.body.appendChild(bar);

    // 密钥选择弹窗
    var dlg = document.createElement('div');
    dlg.className = 'bf-keydialog';
    dlg.hidden = true;
    dlg.innerHTML =
      '<div class="bf-keydialog-card">' +
      '<h4>开启编辑</h4>' +
      '<p>请选择你<strong>本机</strong>上的密钥文件 <b>edit-key.txt</b>（部署包一起生成的那份）。验证通过后，本页才会打开编辑选项。</p>' +
      '<input type="file" id="bf-keyfile" accept=".txt,text/plain">' +
      '<div class="bf-keydialog-actions"><button type="button" class="bf-kd-cancel">取消</button></div>' +
      '</div>';
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.hidden = true; });
    $('.bf-kd-cancel', dlg).addEventListener('click', function () { dlg.hidden = true; });
    var input = $('#bf-keyfile', dlg);
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () { unlock(String(reader.result).trim()); };
      reader.readAsText(file, 'utf-8');
    });
    document.body.appendChild(dlg);
  }

  function showKeyDialog() {
    var dlg = $('.bf-keydialog');
    if (!dlg) return;
    dlg.hidden = false;
  }

  /* ---------- 密钥验证与编辑模式 ---------- */
  function unlock(key) {
    if (!key) { toast('密钥文件内容为空', false); return; }
    fetch(CHECK_API + '?key=' + encodeURIComponent(key), { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.ok) {
          editKey = key;
          var dlg = $('.bf-keydialog');
          if (dlg) dlg.hidden = true;
          enableEdit();
          toast('密钥验证通过，编辑模式已开启', true);
        } else {
          toast(res.error || '密钥不正确，无法开启编辑', false);
        }
      })
      .catch(function () { toast('无法连接编辑服务，请确认站点运行在服务器上', false); });
  }

  function enableEdit() {
    editOn = true;
    dirty = false;
    document.body.classList.add('bf-edit-on');
    var bar = $('.bf-editbar');
    if (bar) { bar.hidden = false; var b = $('.bf-save', bar); if (b) b.textContent = '保存修改'; }
    applyEditUI();
  }

  function applyEditUI() {
    $$('[data-field]').forEach(function (el) {
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'false');
      if (!el.__bfDirtyBound) {
        el.__bfDirtyBound = true;
        el.addEventListener('input', markDirty);
      }
    });
    $$('.bf-frame, .bf-book').forEach(function (card) {
      if (card.querySelector('.bf-del')) return;
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'bf-del';
      del.setAttribute('aria-label', '删除此项');
      del.textContent = '\u00D7';
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        removeItem(card.getAttribute('data-bf-review').replace('bf-review-', ''));
      });
      card.appendChild(del);
    });
  }

  function disableEdit() {
    editOn = false;
    document.body.classList.remove('bf-edit-on');
    $$('[data-field]').forEach(function (el) {
      el.removeAttribute('contenteditable');
      el.removeAttribute('spellcheck');
    });
    $$('.bf-del').forEach(function (el) { el.remove(); });
    var bar = $('.bf-editbar');
    if (bar) bar.hidden = true;
    if (dirty) toast('有未保存的修改已放弃', false);
    dirty = false;
  }

  /* ---------- 新增 / 删除 ---------- */
  function defaults(type, id) {
    if (type === 'movie') {
      return { id: id, title: '新电影', en: 'NEW MOVIE', year: '', meta: '导演 · 年份 · 类型', stars: '★★★★☆', text: '在这里写下你的短评……', quote: '', accent: '#4a6fa5' };
    }
    return { id: id, title: '新书', en: 'NEW BOOK', meta: '作者 · 年份 · 类型', stars: '★★★★☆', text: '在这里写下你的书评……', quote: '', accent: '#8f5a3f', color: 'bf-book-color-default' };
  }

  function addItem(type) {
    if (!editOn) return;
    var id = 'new-' + type + '-' + Date.now();
    var item = defaults(type, id);
    var container = type === 'movie' ? $('.bf-filmstrip') : $('.bf-bookcase');
    if (container) container.insertAdjacentHTML('beforeend', type === 'movie' ? movieFrame(item) : bookHtml(item));
    var body = $('.bf-modal-body');
    if (body) body.insertAdjacentHTML('beforeend', reviewHtml(item, type));
    bindCards();
    applyEditUI();
    markDirty();
    openReview('bf-review-' + id);
  }

  function removeItem(id) {
    if (!editOn) return;
    var card = document.querySelector('[data-bf-review="bf-review-' + id + '"]');
    if (card) card.remove();
    var rev = document.getElementById('bf-review-' + id);
    if (rev) rev.remove();
    closeReview();
    markDirty();
    toast('已删除，记得点「保存修改」');
  }

  /* ---------- 保存 ---------- */
  function collect() {
    var movies = [], books = [];
    $$('.bf-modal-body .bf-review').forEach(function (el) {
      var id = el.id.replace('bf-review-', '');
      var type = el.getAttribute('data-type') || (el.querySelector('.bf-tag-movie') ? 'movie' : 'book');
      var card = document.querySelector('[data-bf-review="bf-review-' + id + '"]');
      var item = {
        id: id,
        title: textOf('[data-field="title"]', el),
        en: textOf('[data-field="en"]', el),
        meta: textOf('[data-field="meta"]', el),
        stars: textOf('[data-field="stars"]', el),
        text: textOf('[data-field="text"]', el),
        quote: el.querySelector('.bf-review-quote') ? textOf('.bf-review-quote', el).replace(/「|」/g, '').trim() : '',
        accent: (el.style.getPropertyValue('--bf-card-accent') || '#c08a4a').trim()
      };
      if (card) {
        var cap = card.querySelector('.bf-frame-caption span');
        if (cap) {
          var parts = cap.textContent.split('\u00B7');
          item.en = parts[0] ? parts[0].trim() : item.en;
          item.year = parts[1] ? parts[1].trim() : '';
        }
        item.color = card.getAttribute('data-color') || undefined;
      }
      if (type === 'book') { if (!item.color) item.color = 'bf-book-color-default'; books.push(item); }
      else movies.push(item);
    });
    return { movies: movies, books: books };
  }

  function save() {
    if (!editKey) { toast('请先验证密钥文件', false); return; }
    var payload = collect();
    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Edit-Key': editKey, 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.ok) {
          dirty = false;
          var b = $('.bf-save');
          if (b) b.textContent = '保存修改';
          normalize(payload);
          render();
          toast('已保存 ✔', true);
        } else {
          toast(res.error || '保存失败', false);
        }
      })
      .catch(function () { toast('网络错误，保存失败', false); });
  }

  /* ---------- 初始化 ---------- */
  function init() {
    buildEditUI();
    BRUSH = $('.bf-board');
    if (!BRUSH) return;
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeReview();
    });
    window.addEventListener('beforeunload', function (e) {
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    });
    loadData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.BFEditor = {
    unlock: unlock,
    enable: enableEdit,
    disable: disableEdit,
    save: save,
    addItem: addItem,
    removeItem: removeItem,
    getState: function () { return state; }
  };
})();