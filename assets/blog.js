/* 成长日志 · 花圃小溪（Flower-bed Creek）
   一条竖直蜿蜒的小溪随滚动自绘延伸，沿岸的苗与花进入视野时生长，
   点开即弹出那段感悟。空白之处点缀萤火虫、蝴蝶与散落的小花。
   无 JS 时 .creek 不带 .is-live，退化为竖排卡片。 */
(function () {
  var creek = document.getElementById('creek');
  if (!creek) return;

  var svg = document.getElementById('creekWater');
  var path = document.getElementById('creekPath');
  var flow = document.getElementById('creekFlow');
  var pollenBox = document.getElementById('creekPollen');
  var buds = Array.prototype.slice.call(creek.querySelectorAll('.bud'));
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ROW = 176;          // 相邻花之间的纵向间距 (px)
  var TOP = 130, BOT = 130;
  var WAVES = 3;          // 蜿蜒的波数（越多越爱摆动）
  var AMP = 0.44;         // 振幅（占宽度比例，越大越接近两边）
  var SEG = 160;          // 路径采样段数
  var W = 0, H = 0;

  // 窄屏振幅收一点，避免花被边缘裁掉
  function ampNow() { return W < 560 ? 0.30 : (W < 820 ? 0.36 : AMP); }

  function creekX(y) {
    var t = y / H;
    return W * 0.5 + Math.sin(t * Math.PI * WAVES) * W * ampNow();
  }

  function buildPath() {
    var d = '', a = ampNow();
    for (var i = 0; i <= SEG; i++) {
      var t = i / SEG;
      var y = t * H;
      var x = W * 0.5 + Math.sin(t * Math.PI * WAVES) * W * a;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    d = d.trim();
    path.setAttribute('d', d);
    if (flow) flow.setAttribute('d', d);
  }

  function size() {
    W = creek.clientWidth;
    H = TOP + BOT + Math.max(0, buds.length - 1) * ROW;
    creek.style.minHeight = H + 'px';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    buildPath();
    buds.forEach(function (b, i) {
      var y = TOP + i * ROW;
      b.style.left = creekX(y) + 'px';
      b.style.top = y + 'px';
    });
    layoutDeco();
    paint();
  }

  function paint() {
    var r = creek.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var prog = (vh - r.top) / (vh + r.height);
    prog = Math.max(0, Math.min(1, prog));
    path.style.strokeDashoffset = reduce ? 0 : (1 - prog).toFixed(3);
  }

  // 进入视野时，苗 / 花生长出来
  var io = ('IntersectionObserver' in window)
    ? new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('is-grown'); io.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -12% 0px' })
    : null;
  buds.forEach(function (b) { if (io) io.observe(b); else b.classList.add('is-grown'); });

  // 点开感悟
  var petal = document.getElementById('petal');
  var pEra = document.getElementById('petalEra');
  var pTitle = document.getElementById('petalTitle');
  var pText = document.getElementById('petalText');
  var pQuote = document.getElementById('petalQuote');

  function openBud(b) {
    var panel = b.querySelector('.bud__panel');
    pEra.textContent = (panel.querySelector('.bud__p-era') || {}).textContent || '';
    pTitle.textContent = (panel.querySelector('.bud__p-title') || {}).textContent || '';
    pText.innerHTML = (panel.querySelector('.bud__p-text') || {}).innerHTML || '';
    pQuote.textContent = (panel.querySelector('.bud__p-quote') || {}).textContent || '';
    petal.classList.add('is-open');
    petal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeBud() {
    petal.classList.remove('is-open');
    petal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  buds.forEach(function (b) {
    b.addEventListener('click', function () { openBud(b); });
    b.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBud(b); }
    });
  });
  document.getElementById('petalClose').addEventListener('click', closeBud);
  document.getElementById('petalBackdrop').addEventListener('click', closeBud);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeBud(); });

  /* ---------- 装饰层：萤火虫 / 蝴蝶 / 散落小花 ---------- */
  var decoFlowers = [];

  function flowerSVG(c1, c2) {
    return '<svg class="deco-flower" viewBox="0 0 24 24" aria-hidden="true">' +
      '<ellipse cx="12" cy="4.6" rx="3.2" ry="4.4" fill="' + c1 + '"/>' +
      '<ellipse cx="12" cy="19.4" rx="3.2" ry="4.4" fill="' + c1 + '"/>' +
      '<ellipse cx="4.6" cy="12" rx="4.4" ry="3.2" fill="' + c1 + '"/>' +
      '<ellipse cx="19.4" cy="12" rx="4.4" ry="3.2" fill="' + c1 + '"/>' +
      '<circle cx="12" cy="12" r="3.4" fill="' + c2 + '"/></svg>';
  }

  function buildDeco() {
    // 萤火虫
    if (!reduce) {
      var ff = document.createElement('div');
      ff.className = 'creek__fireflies';
      ff.setAttribute('aria-hidden', 'true');
      var nF = 16;
      for (var i = 0; i < nF; i++) {
        var f = document.createElement('i');
        f.className = 'firefly';
        f.style.left = (Math.random() * 100).toFixed(2) + '%';
        f.style.top = (Math.random() * 100).toFixed(2) + '%';
        f.style.setProperty('--fdur', (14 + Math.random() * 14).toFixed(1) + 's');
        f.style.setProperty('--ftw', (2.6 + Math.random() * 2.6).toFixed(1) + 's');
        f.style.animationDelay = (-Math.random() * 16).toFixed(1) + 's, ' + (-Math.random() * 4).toFixed(1) + 's';
        f.style.setProperty('--wk', (Math.floor(Math.random() * 3) + 1));
        ff.appendChild(f);
      }
      creek.appendChild(ff);
    }

    // 蝴蝶
    if (!reduce) {
      var bf = document.createElement('div');
      bf.className = 'creek__butterflies';
      bf.setAttribute('aria-hidden', 'true');
      var nB = 5;
      var palette = [
        'rgba(246,184,200,.92)', 'rgba(244,213,141,.85)',
        'rgba(246,184,200,.85)', 'rgba(159,240,200,.8)', 'rgba(244,213,141,.9)'
      ];
      for (var j = 0; j < nB; j++) {
        var b2 = document.createElement('div');
        b2.className = 'butterfly';
        var dir = j % 2 ? -1 : 1;
        b2.style.left = (dir > 0 ? Math.random() * 35 : 55 + Math.random() * 35).toFixed(1) + '%';
        b2.style.top = (8 + Math.random() * 82).toFixed(1) + '%';
        b2.style.setProperty('--bdur', (20 + Math.random() * 14).toFixed(1) + 's');
        b2.style.setProperty('--bdist', (340 + Math.random() * 220).toFixed(0) + 'px');
        b2.style.setProperty('--dir', dir);
        b2.style.animationDelay = (-Math.random() * 18).toFixed(1) + 's';
        var c = palette[j % palette.length];
        b2.innerHTML = '<span class="bf-wing bf-l" style="background:linear-gradient(140deg,' + c + ',rgba(244,213,141,.7))"></span>' +
          '<span class="bf-wing bf-r" style="background:linear-gradient(140deg,' + c + ',rgba(244,213,141,.7))"></span>' +
          '<span class="bf-body"></span>';
        bf.appendChild(b2);
      }
      creek.appendChild(bf);
    }

    // 散落的小花（在溪水两侧的空白里）
    var colors = [
      ['rgba(246,184,200,.92)', 'rgba(244,213,141,1)'],
      ['rgba(159,240,200,.9)', 'rgba(244,213,141,1)'],
      ['rgba(244,213,141,.92)', 'rgba(255,246,224,1)'],
      ['rgba(246,184,200,.85)', 'rgba(159,240,200,1)']
    ];
    var nFlo = Math.max(10, Math.round(H / 190));
    for (var k = 0; k < nFlo; k++) {
      var t = 0.04 + (k + 0.5) / nFlo * 0.92;
      var side = (k % 2) ? 1 : -1;
      var col = colors[k % colors.length];
      var wrap = document.createElement('span');
      wrap.className = 'deco-flower-wrap';
      wrap.setAttribute('aria-hidden', 'true');
      wrap.innerHTML = flowerSVG(col[0], col[1]);
      var fl = wrap.firstChild;
      fl.style.animationDuration = (5.5 + Math.random() * 4).toFixed(1) + 's';
      fl.style.animationDelay = (-Math.random() * 6).toFixed(1) + 's';
      var sc = (0.7 + Math.random() * 0.7).toFixed(2);
      fl.style.transform = 'scale(' + sc + ')';
      wrap._t = t; wrap._side = side;
      creek.appendChild(wrap);
      decoFlowers.push(wrap);
    }
  }

  function layoutDeco() {
    if (!decoFlowers.length) return;
    var usable = H - TOP - BOT;
    decoFlowers.forEach(function (wrap) {
      var y = TOP + wrap._t * usable;
      var cx = creekX(y);
      var x = cx + wrap._side * W * 0.30;
      x = Math.max(34, Math.min(W - 34, x));
      wrap.style.left = x + 'px';
      wrap.style.top = y + 'px';
    });
  }

  // 飘浮的花粉
  if (pollenBox && !reduce) {
    var n = 10;
    for (var k = 0; k < n; k++) {
      var s = document.createElement('i');
      s.style.left = (Math.random() * 100).toFixed(2) + '%';
      s.style.animationDuration = (11 + Math.random() * 11).toFixed(1) + 's';
      s.style.animationDelay = (-Math.random() * 16).toFixed(1) + 's';
      var sc = (0.6 + Math.random() * 0.9).toFixed(2);
      s.style.transform = 'scale(' + sc + ')';
      pollenBox.appendChild(s);
    }
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(function () { paint(); ticking = false; });
    }
  }, { passive: true });

  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(size, 150); });

  function boot() {
    size();          // 先算出 W / H，装饰才好按高度铺量
    buildDeco();
    creek.classList.add('is-live');
    paint();
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot);
  else boot();
})();
