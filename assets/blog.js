/* 成长日志 · 花圃小溪（Flower-bed Creek）
   一条竖直蜿蜒的小溪随滚动自绘延伸，沿岸的苗与花进入视野时生长，
   点开即弹出那段感悟。无 JS 时 .creek 不带 .is-live，退化为竖排卡片。 */
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
  var TOP = 120, BOT = 120;
  var WAVES = 2.4;        // 蜿蜒的波数
  var AMP = 0.13;         // 振幅（占宽度比例）
  var W = 0, H = 0;

  function buildPath() {
    var seg = 90, d = '';
    for (var i = 0; i <= seg; i++) {
      var t = i / seg;
      var y = t * H;
      var x = W * 0.5 + Math.sin(t * Math.PI * WAVES) * W * AMP;
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
      var t = y / H;
      var x = W * 0.5 + Math.sin(t * Math.PI * WAVES) * W * AMP;
      b.style.left = x + 'px';
      b.style.top = y + 'px';
    });
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

  // 飘浮的花粉
  if (pollenBox && !reduce) {
    var n = 16;
    for (var k = 0; k < n; k++) {
      var s = document.createElement('i');
      s.style.left = (Math.random() * 100).toFixed(2) + '%';
      s.style.animationDuration = (9 + Math.random() * 10).toFixed(1) + 's';
      s.style.animationDelay = (-Math.random() * 14).toFixed(1) + 's';
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
    size();
    creek.classList.add('is-live');
    paint();
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot);
  else boot();
})();
