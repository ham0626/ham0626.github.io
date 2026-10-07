/* 成长日志 · 花圃小溪（Flower-bed Creek）
   一条竖直蜿蜒的小溪随滚动自绘延伸。溪水的每一个拐弯都是一段时光的节点，
   拐弯内侧的苗与花成簇生长，点开即弹出那段成长日记；空白处点缀萤火虫、
   蝴蝶与散落的小花。无 JS 时 .creek 不带 .is-live，退化为竖排卡片。 */
(function () {
  var creek = document.getElementById('creek');
  if (!creek) return;

  var svg = document.getElementById('creekWater');
  var path = document.getElementById('creekPath');
  var flow = document.getElementById('creekFlow');
  var pollenBox = document.getElementById('creekPollen');
  var buds = Array.prototype.slice.call(creek.querySelectorAll('.bud'));
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var TOP = 120, BOT = 140;     // 上下留白
  var BUD_GAP = 104;            // 同一簇内，苗/花之间的纵向间距
  var CLUSTER_GAP = 240;       // 相邻时间节点（拐弯）之间的纵向间距
  var INNER = 0.52;             // 苗/花相对拐弯点的内收比例（0=溪心，1=贴在拐弯上）
  var SEG = 200;                // 路径采样段数
  var W = 0, H = 0;

  // 窄屏振幅收一点，避免花被边缘裁掉
  function ampNow() { return W < 560 ? 0.30 : (W < 820 ? 0.36 : 0.42); }

  /* ---------- 把苗/花按 data-cluster 分簇（每簇对应一个拐弯 / 时间节点） ---------- */
  var clusters = {};
  buds.forEach(function (b) {
    var c = b.getAttribute('data-cluster') || '0';
    (clusters[c] = clusters[c] || []).push(b);
  });
  var clusterKeys = Object.keys(clusters).sort(function (a, b) { return (+a) - (+b); });
  var nC = clusterKeys.length;
  var dirs = clusterKeys.map(function (_, i) { return (i % 2) ? -1 : 1; });  // 拐弯左右交替
  var nodes = [];     // 时间节点元素
  var decoFlowers = []; // 散落 / 间隙的小花（含定位元数据）

  function maxSpan() {
    var m = 0;
    clusterKeys.forEach(function (k) { m = Math.max(m, (clusters[k].length - 1) * BUD_GAP); });
    return m;
  }
  function clusterHalf() { return maxSpan() / 2 + 80; }
  function centerOf(i) { return TOP + clusterHalf() + i * CLUSTER_GAP; }
  function sideX(i) { return W * 0.5 + dirs[i] * W * ampNow(); }

  /* ---------- 溪水路径：穿过「起点→各拐弯→终点」的锚点，余弦插值成平滑的拐弯 ---------- */
  function anchors() {
    var a = [{ y: 0, x: W * 0.5 }];
    for (var i = 0; i < nC; i++) a.push({ y: centerOf(i), x: sideX(i) });
    a.push({ y: H, x: W * 0.5 });
    return a;
  }
  function creekX(y) {
    var A = anchors(), i;
    for (i = 0; i < A.length - 1; i++) {
      if (y >= A[i].y && y <= A[i + 1].y) {
        var t = (y - A[i].y) / (A[i + 1].y - A[i].y);
        var c = 0.5 - 0.5 * Math.cos(Math.PI * t);   // 余弦插值：锚点处斜率为 0 → 正是一个拐弯
        return A[i].x + (A[i + 1].x - A[i].x) * c;
      }
    }
    return W * 0.5;
  }
  function buildPath() {
    var d = '', i, t, y, x;
    for (i = 0; i <= SEG; i++) {
      t = i / SEG; y = t * H; x = creekX(y);
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    d = d.trim();
    path.setAttribute('d', d);
    if (flow) flow.setAttribute('d', d);
  }

  function size() {
    W = creek.clientWidth;
    H = TOP + clusterHalf() + (nC > 1 ? (nC - 1) * CLUSTER_GAP : 0) + clusterHalf() + BOT;
    creek.style.minHeight = H + 'px';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    buildPath();

    // 每个簇：苗/花成簇地长在拐弯内侧
    clusterKeys.forEach(function (k, ci) {
      var arr = clusters[k], n = arr.length, cy = centerOf(ci);
      arr.forEach(function (b, j) {
        var y = cy + (j - (n - 1) / 2) * BUD_GAP;
        y = Math.max(TOP, Math.min(H - BOT, y));
        var x = W * 0.5 + (sideX(ci) - W * 0.5) * INNER;
        b.style.left = x + 'px';
        b.style.top = y + 'px';
        b._y = y; b._x = x;
      });
    });

    layoutNodes();
    layoutDeco();
    paint();
  }

  /* ---------- 滚动时，溪水自绘延伸 ---------- */
  function paint() {
    var r = creek.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var prog = (vh - r.top) / (vh + r.height);
    prog = Math.max(0, Math.min(1, prog));
    path.style.strokeDashoffset = reduce ? 0 : (1 - prog).toFixed(3);
  }

  /* ---------- 进入视野，苗 / 花生长出来 ---------- */
  var io = ('IntersectionObserver' in window)
    ? new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('is-grown'); io.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -12% 0px' })
    : null;
  buds.forEach(function (b) { if (io) io.observe(b); else b.classList.add('is-grown'); });

  /* ---------- 点开感悟（成长日记卡片） ---------- */
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

  /* ---------- 时间节点：溪水每个拐弯上的时光标记 ---------- */
  function buildNodes() {
    clusterKeys.forEach(function (k, ci) {
      var era = (clusters[k][0].getAttribute('data-cnode') || '');
      var el = document.createElement('span');
      el.className = 'cnode ' + (dirs[ci] > 0 ? 'cnode--r' : 'cnode--l');
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = '<span class="cnode__knot"></span><span class="cnode__label">' + era + '</span>';
      el._ci = ci;
      creek.appendChild(el);
      nodes.push(el);
    });
  }
  function layoutNodes() {
    nodes.forEach(function (el) {
      var ci = el._ci;
      el.style.left = sideX(ci) + 'px';
      el.style.top = centerOf(ci) + 'px';
    });
  }

  /* ---------- 装饰层：萤火虫 / 蝴蝶 / 散落小花 ---------- */
  function flowerSVG(c1, c2) {
    return '<svg class="deco-flower" viewBox="0 0 24 24" aria-hidden="true">' +
      '<ellipse cx="12" cy="4.6" rx="3.2" ry="4.4" fill="' + c1 + '"/>' +
      '<ellipse cx="12" cy="19.4" rx="3.2" ry="4.4" fill="' + c1 + '"/>' +
      '<ellipse cx="4.6" cy="12" rx="4.4" ry="3.2" fill="' + c1 + '"/>' +
      '<ellipse cx="19.4" cy="12" rx="4.4" ry="3.2" fill="' + c1 + '"/>' +
      '<circle cx="12" cy="12" r="3.4" fill="' + c2 + '"/></svg>';
  }
  function spawnFlower(xf, y, scale, sway) {
    var colors = [
      ['rgba(246,184,200,.92)', 'rgba(244,213,141,1)'],
      ['rgba(159,240,200,.9)', 'rgba(244,213,141,1)'],
      ['rgba(244,213,141,.92)', 'rgba(255,246,224,1)'],
      ['rgba(246,184,200,.85)', 'rgba(159,240,200,1)']
    ];
    var col = colors[decoFlowers.length % colors.length];
    var wrap = document.createElement('span');
    wrap.className = 'deco-flower-wrap';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = flowerSVG(col[0], col[1]);
    var fl = wrap.firstChild;
    fl.style.animationDuration = (5.5 + Math.random() * 4).toFixed(1) + 's';
    fl.style.animationDelay = (-Math.random() * 6).toFixed(1) + 's';
    wrap.style.transform = 'translate(-50%,-50%) scale(' + scale.toFixed(2) + ')';
    wrap._xf = xf; wrap._y = y;   // xf: 相对溪心(W/2)的偏移，占 W 的比例（可正可负）
    creek.appendChild(wrap);
    decoFlowers.push(wrap);
  }
  function buildDeco() {
    // 萤火虫
    if (!reduce) {
      var ff = document.createElement('div');
      ff.className = 'creek__fireflies'; ff.setAttribute('aria-hidden', 'true');
      for (var i = 0; i < 16; i++) {
        var f = document.createElement('i');
        f.className = 'firefly';
        f.style.left = (Math.random() * 100).toFixed(2) + '%';
        f.style.top = (Math.random() * 100).toFixed(2) + '%';
        f.style.setProperty('--fdur', (14 + Math.random() * 14).toFixed(1) + 's');
        f.style.setProperty('--ftw', (2.6 + Math.random() * 2.6).toFixed(1) + 's');
        f.style.animationDelay = (-Math.random() * 16).toFixed(1) + 's, ' + (-Math.random() * 4).toFixed(1) + 's';
        ff.appendChild(f);
      }
      creek.appendChild(ff);
    }
    // 蝴蝶
    if (!reduce) {
      var bf = document.createElement('div');
      bf.className = 'creek__butterflies'; bf.setAttribute('aria-hidden', 'true');
      var palette = [
        'rgba(246,184,200,.92)', 'rgba(244,213,141,.85)',
        'rgba(246,184,200,.85)', 'rgba(159,240,200,.8)', 'rgba(244,213,141,.9)'
      ];
      for (var j = 0; j < 5; j++) {
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
    // 簇内间隙的小花（苗与苗之间堆一点花）
    clusterKeys.forEach(function (k, ci) {
      var arr = clusters[k], n = arr.length;
      for (var m = 0; m < n - 1; m++) {
        var yMid = (arr[m]._y + arr[m + 1]._y) / 2;
        var xf = dirs[ci] * ampNow() * INNER * 0.78;   // 比苗更靠近溪心一点
        spawnFlower(xf, yMid, 0.62 + Math.random() * 0.18, true);
      }
    });
    // 簇与簇之间的空白：随机撒一些花（避开苗/节点）
    var gapN = nC * 4;
    var tries = 0;
    var target = gapN + countClusterFlowers();
    while (decoFlowers.length < target && tries < gapN * 14) {
      tries++;
      var gy = TOP + Math.random() * (H - TOP - BOT);
      var gside = Math.random() < 0.5 ? -1 : 1;
      var gxf = gside * (0.16 + Math.random() * 0.26);
      var gx = W * 0.5 + gxf * W;
      if (tooClose(gx, gy)) continue;
      spawnFlower(gxf, gy, 0.7 + Math.random() * 0.5, true);
    }
  }
  function countClusterFlowers() {
    var c = 0;
    clusterKeys.forEach(function (k) { c += Math.max(0, clusters[k].length - 1); });
    return c;
  }
  function tooClose(x, y) {
    for (var i = 0; i < buds.length; i++) {
      var dx = x - buds[i]._x, dy = y - buds[i]._y;
      if (dx * dx + dy * dy < 56 * 56) return true;
    }
    for (var j = 0; j < nodes.length; j++) {
      var nx = sideX(nodes[j]._ci), nyy = centerOf(nodes[j]._ci);
      var ndx = x - nx, ndy = y - nyy;
      if (ndx * ndx + ndy * ndy < 44 * 44) return true;
    }
    return false;
  }
  function layoutDeco() {
    decoFlowers.forEach(function (wrap) {
      var x = W * 0.5 + wrap._xf * W;
      wrap.style.left = x + 'px';
      wrap.style.top = wrap._y + 'px';
    });
  }

  // 飘浮的花粉
  if (pollenBox && !reduce) {
    for (var p = 0; p < 10; p++) {
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
    buildNodes();
    size();                 // 先算出 W / 各定位（苗与节点的位置），再据此布花
    buildDeco();            // 用已算好的苗/节点位置撒花、避开
    layoutDeco();           // 给新撒的花定位
    creek.classList.add('is-live');
    paint();
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot);
  else boot();
})();
