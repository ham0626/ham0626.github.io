/* ============================================================
   成长日志 ·「金门」翻页书（Golden Portal）
   —— 一叠 .leaf 按书页方式叠放，当前页在最上。
      向前翻：当前页绕左边缘 rotateY(-180deg) 翻走（backface 隐藏）→ 露出下一页；
      向后翻：目标页从 -180deg 转回 0 → 盖回当前页。
      金色扫光 + 门环脉冲，配合 prefers-reduced-motion 降级为瞬时切换。
   无 JS 时：CSS 里 .book 保持竖排列表，全部内容可读。
   ============================================================ */
(function () {
  'use strict';

  var portal = document.getElementById('portal');
  var book = document.getElementById('book');
  if (!portal || !book) return;

  var leaves = Array.prototype.slice.call(book.querySelectorAll('.leaf'));
  var n = leaves.length;
  if (!n) return;

  var countEl = document.getElementById('pgCount');
  var totalEl = document.getElementById('pgTotal');
  var prevBtn = document.getElementById('prevBtn');
  var nextBtn = document.getElementById('nextBtn');
  var zoneL = document.getElementById('zoneL');
  var zoneR = document.getElementById('zoneR');
  var ixItems = Array.prototype.slice.call(document.querySelectorAll('#ix .ix__i'));

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var DUR = reduce ? 0 : 900;

  var cur = 0;
  var busy = false;
  var lastSwipe = 0;

  function pad(v) { return (v < 10 ? '0' : '') + v; }

  /* 书高 = 最高的一页，保证内容不被裁掉；字体加载完 / 窗口变化后重算 */
  function fit() {
    var h = 0;
    for (var i = 0; i < n; i++) {
      var inn = leaves[i].querySelector('.leaf__inner');
      if (inn) h = Math.max(h, inn.offsetHeight);
    }
    if (h > 0) book.style.height = h + 'px';
  }

  /* 页码 / 章节高亮 / 按钮可用性 —— 翻动一开始就同步，别等动画结束 */
  function syncUI(i) {
    if (countEl) countEl.textContent = pad(i + 1);
    for (var k = 0; k < ixItems.length; k++) {
      ixItems[k].classList.toggle('is-on', k === i);
      ixItems[k].setAttribute('aria-current', k === i ? 'true' : 'false');
    }
    if (prevBtn) prevBtn.disabled = (i === 0);
    if (nextBtn) nextBtn.disabled = (i === n - 1);
  }

  /* 只调层级与页码，不动 transform —— 翻动由 flip() 负责 */
  function layout() {
    for (var i = 0; i < n; i++) {
      var turned = i < cur;                       // 已翻到左边的页
      leaves[i].classList.toggle('turned', turned);
      // 已翻走的（100+i，最大 100+n-1）永远在未翻的（200+…，最小 201）之下
      leaves[i].style.zIndex = String(turned ? (100 + i) : (200 + (n - i)));
    }
    leaves[cur].style.zIndex = String(200 + n + 5);
    syncUI(cur);
  }

  function ringPulse() {
    portal.classList.add('is-turning');
    window.setTimeout(function () { portal.classList.remove('is-turning'); }, Math.max(DUR, 320));
  }

  /* 相邻翻页：带 3D 翻动 */
  function flip(target) {
    if (busy || target === cur || target < 0 || target > n - 1) return;
    busy = true;
    ringPulse();
    syncUI(target);

    var forward = target > cur;
    var moving = forward ? leaves[cur] : leaves[target];

    moving.style.zIndex = '600';           // 翻动中的那张始终在最上层
    moving.classList.add('leaving');       // 触发金色扫光

    if (forward) {
      window.requestAnimationFrame(function () { moving.classList.add('turned'); });
    } else {
      moving.classList.remove('turned');   // 从 -180 转回 0
    }

    window.setTimeout(function () {
      moving.classList.remove('leaving');
      cur = target;
      layout();
      busy = false;
    }, DUR);
  }

  /* 远距离跳页：直接切换 + 新页淡入（不连翻十几张） */
  function jump(target) {
    if (busy || target === cur || target < 0 || target > n - 1) return;
    if (Math.abs(target - cur) === 1) { flip(target); return; }

    cur = target;
    layout();
    var lf = leaves[cur];
    lf.classList.remove('is-jump');
    void lf.offsetWidth;                   // 强制回流，让动画能重放
    lf.classList.add('is-jump');
  }

  function go(target) {
    if (target < 0 || target > n - 1) return;
    jump(target);
  }

  /* ===== 交互 ===== */
  if (prevBtn) prevBtn.addEventListener('click', function () { go(cur - 1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { go(cur + 1); });

  function tapFlip(dir) {
    if (Date.now() - lastSwipe < 450) return;   // 刚滑过就别再翻一次
    go(cur + dir);
  }
  if (zoneL) zoneL.addEventListener('click', function () { tapFlip(-1); });
  if (zoneR) zoneR.addEventListener('click', function () { tapFlip(1); });

  ixItems.forEach(function (b) {
    b.addEventListener('click', function () {
      var t = parseInt(b.getAttribute('data-go'), 10);
      if (!isNaN(t)) go(t);
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight') { go(cur + 1); }
    else if (e.key === 'ArrowLeft') { go(cur - 1); }
  });

  var tx = 0, ty = 0, swiping = false;
  book.addEventListener('touchstart', function (e) {
    var t = e.changedTouches[0];
    tx = t.clientX; ty = t.clientY; swiping = false;
  }, { passive: true });
  book.addEventListener('touchmove', function (e) {
    var t = e.changedTouches[0];
    var dx = t.clientX - tx, dy = t.clientY - ty;
    if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.4) swiping = true;
  }, { passive: true });
  book.addEventListener('touchend', function (e) {
    if (!swiping) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - tx;
    lastSwipe = Date.now();
    go(dx < 0 ? cur + 1 : cur - 1);
  }, { passive: true });

  /* ===== 启动 ===== */
  function boot() {
    fit();                        // 先在静态布局下量出自然高度
    book.classList.add('is-live');
    portal.classList.add('is-live');
    layout();
    leaves[0].classList.add('is-jump');

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { fit(); });
    }
  }

  var rt;
  window.addEventListener('resize', function () {
    window.clearTimeout(rt);
    rt = window.setTimeout(fit, 160);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
