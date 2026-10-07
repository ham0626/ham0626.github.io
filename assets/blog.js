/* 成长日志 · 花圃小溪（Flower-bed Creek）
   一条竖直蜿蜒的小溪随滚动自绘延伸。溪水的每一个拐弯都是一段时光的节点，
   拐弯内侧的凹处（crook）里错落生长着苗与花（不挤成一列），点开即弹出那段成长日记；
   空白处点缀萤火虫、蝴蝶与散落的小花。无 JS 时 .creek 不带 .is-live，退化为竖排卡片。 */
(function () {
  var creek = document.getElementById('creek');
  if (!creek) return;

  var svg = document.getElementById('creekWater');
  var path = document.getElementById('creekPath');
  var flow = document.getElementById('creekFlow');
  var pollenBox = document.getElementById('creekPollen');
  var buds = Array.prototype.slice.call(creek.querySelectorAll('.bud'));
  var words = Array.prototype.slice.call(creek.querySelectorAll('.word'));
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var TOP = 120, BOT = 140;     // 上下留白
  var BUD_GAP = 104;            // 同一簇内，苗/花之间的纵向间距
  var CLUSTER_GAP = 470;       // 相邻时间节点（拐弯）之间的纵向间距（太密会让水线极陡，内侧就没地方放苗了）
  var SEG = 200;                // 路径采样段数
  var W = 0, H = 0, LABEL_M = 98; // LABEL_M：苗/花中心到水线的安全留白（保证文字不压到水线）
  var creekPts = [];            // 溪流折线采样点，用于算「到水线的真实距离」
  var ffBox = null, bfBox = null; // 萤火虫 / 蝴蝶容器（resize 时整块重建）

  // 窄屏振幅收一点，避免花被边缘裁掉
  function ampNow() { return W < 560 ? 0.30 : (W < 820 ? 0.36 : 0.42); }
  // 小确定性的伪随机（同一次加载内稳定，不每次刷新乱跳）
  function rnd(a, b) { var s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); }
  // 簇内第 j 朵（共 n 朵）的横向单位偏移：
  // 相邻两朵一内一外拉开 ~128px，既错落铺开，也避免上一朵的花压到下一朵的字
  function budUnit(j, n) {
    if (n <= 1) return 0;
    return (j % 2 === 0) ? -0.7 : 1;
  }

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
    creekPts = [];
    for (i = 0; i <= SEG; i++) {
      t = i / SEG; y = t * H; x = creekX(y);
      creekPts.push([x, y]);
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    d = d.trim();
    path.setAttribute('d', d);
    if (flow) flow.setAttribute('d', d);
  }

  // 到溪流折线的最近点：返回 {d 距离, px, py}
  function nearest(x, y) {
    var best = 1e9, bx = x, by = y, i, ax, ay, dx, dy, l2, t2, qx, qy, d2;
    if (!creekPts.length) return { d: 1e9, px: x, py: y };
    for (i = 0; i < creekPts.length - 1; i++) {
      ax = creekPts[i][0]; ay = creekPts[i][1];
      dx = creekPts[i + 1][0] - ax; dy = creekPts[i + 1][1] - ay;
      l2 = dx * dx + dy * dy;
      t2 = l2 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
      t2 = t2 < 0 ? 0 : (t2 > 1 ? 1 : t2);
      qx = ax + t2 * dx; qy = ay + t2 * dy;
      d2 = (x - qx) * (x - qx) + (y - qy) * (y - qy);
      if (d2 < best) { best = d2; bx = qx; by = qy; }
    }
    return { d: Math.sqrt(best), px: bx, py: by };
  }

  // 在 y 高度上，该拐弯内侧可用的最大「内外比例」t：t=0 在溪心，t=1 在拐弯极点。
  // 水线是斜的，横向让开 Δ 只换来 Δ/√(1+s²) 的垂直距离（s=dx/dy），所以余量要按斜率放大。
  function safeTMax(y, dir, margin) {
    var ampW = W * ampNow();
    if (!ampW) return 0.3;
    var s = (creekX(Math.min(H, y + 2)) - creekX(Math.max(0, y - 2))) / 4;  // dx/dy
    var need = margin * Math.sqrt(1 + s * s) / ampW;
    var tSigned = (creekX(y) - W * 0.5) / (dir * ampW);
    if (tSigned <= 0) return 1;   // 水线在另一侧：这一侧的内侧整个是空的
    return tSigned - need;
  }

  // 在拐弯内侧的凹处取一个点：保证离水线 >= margin。
  // 若该高度这一侧放不下，就把点朝拐弯中心 cy 收，直到放得下。
  function crookPoint(y, dir, margin, tLo, tHi, r, cy) {
    var ampW = W * ampNow(), guard = 0, tMax;
    y = Math.max(TOP + 8, Math.min(H - BOT - 8, y));
    tMax = safeTMax(y, dir, margin);
    while (tMax < 0.09 && cy != null && guard < 50) {
      y += (cy > y ? 6 : -6);
      y = Math.max(TOP + 8, Math.min(H - BOT - 8, y));
      tMax = safeTMax(y, dir, margin);
      guard++;
      if (Math.abs(y - cy) < 3) break;
    }
    var hi = Math.min(tHi, Math.max(0.08, tMax));
    var lo = Math.min(tLo, hi);
    var t = lo + r * (hi - lo);
    var x = W * 0.5 + dir * t * ampW;
    // 收尾保险：真实距离不够就先朝溪心收，收到底了再把点往拐弯中心拉
    guard = 0;
    while (nearest(x, y).d < margin * 0.92 && guard < 90) {
      if (t > 0.05) t -= 0.02;
      else if (cy != null && Math.abs(y - cy) > 3) y += (cy > y ? 4 : -4);
      else break;
      y = Math.max(TOP + 8, Math.min(H - BOT - 8, y));
      x = W * 0.5 + dir * t * ampW;
      guard++;
    }
    return { x: Math.max(24, Math.min(W - 24, x)), y: y };
  }

  function size() {
    W = creek.clientWidth;
    H = TOP + clusterHalf() + (nC > 1 ? (nC - 1) * CLUSTER_GAP : 0) + clusterHalf() + BOT;
    creek.style.minHeight = H + 'px';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    buildPath();

    // 每个簇：苗/花错落地长在拐弯内侧的凹处（不再挤成一列）
    clusterKeys.forEach(function (k, ci) {
      var arr = clusters[k], n = arr.length, cy = centerOf(ci);
      arr.forEach(function (b, j) {
        var y = cy + (j - (n - 1) / 2) * BUD_GAP;
        y = Math.max(TOP, Math.min(H - BOT, y));
        var tWant = 0.22 + budUnit(j, n) * 0.15 + (rnd(j + 1, ci + 1) - 0.5) * 0.04;
        var p = crookPoint(y, dirs[ci], LABEL_M, tWant - 0.02, tWant + 0.02, rnd(j + 1, ci + 1), cy);
        b.style.left = p.x + 'px';
        b.style.top = p.y + 'px';
        b._y = p.y; b._x = p.x;
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

  /* ---------- 溪畔的词：心理学 / 认知 / 哲学 / 金融，翻到时缓缓降落 ---------- */
  // 词牌是矩形（约 156×126），判定是否压到水线必须量整张卡：
  // 只量中心点会漏——中心离水线 83px 时，卡片下沿照样盖在水上。
  // 卡片真实尺寸（is-live 之前就能量准；别用写死的估算，三行/两行差 20px，避让会差一截）
  var wHalfW = 82, wHalfH = 70;
  function measureWords() {
    var w = 0, h = 0;
    words.forEach(function (el) { w = Math.max(w, el.offsetWidth); h = Math.max(h, el.offsetHeight); });
    if (w) wHalfW = w / 2 + 5;   // +5：卡片带微倾斜，角点会多探出 ~3px
    if (h) wHalfH = h / 2 + 7;
  }
  function wordHalf() { return wHalfW; }
  function wordHalfH() { return wHalfH; }
  function wordMargin() { return wordHalf() + 10; }

  // 溪长按词条数等分成若干「带」，一条带一张卡 —— 撑起整体的均匀感
  var wordYA = 0, wordBand = 1;
  function bandOf(y) { return wordBand ? Math.floor((y - wordYA) / wordBand) : 0; }

  // 沿卡片四边取样，逐个算到水线的真实距离
  function waterClear(x, y, need) {
    var hw = wordHalf(), hh = wordHalfH(), i, t, px, py;
    for (i = 0; i <= 6; i++) {
      t = i / 6; px = x - hw + 2 * hw * t;
      if (nearest(px, y - hh).d < need) return false;
      if (nearest(px, y + hh).d < need) return false;
    }
    for (i = 0; i <= 4; i++) {
      t = i / 4; py = y - hh + 2 * hh * t;
      if (nearest(x - hw, py).d < need) return false;
      if (nearest(x + hw, py).d < need) return false;
    }
    return true;
  }

  // 候选点是否可用。mode：'strict' 全避让 / 'relaxed' 允许贴近小花 / 'loose' 只保证不压水线
  function wordFits(x, y, placed, mode) {
    var i, dx, dy, half = wordHalf(), hh = wordHalfH();
    if (x < half + 12 || x > W - half - 12) return false;
    if (y < hh + 30 || y > H - hh - 30) return false;
    if (!waterClear(x, y, W < 560 ? 9 : 14)) return false;
    // 卡片是矩形：只要横向或纵向让开一个身位就不会叠上，比欧氏距离更可靠
    var bh = (W < 560 ? 50 : 80) + half + 8;   // 与苗/花的横向净距
    var ww = half * 2 + 40;                    // 词牌之间的横向净距
    var vv = hh * 2 + (W < 560 ? 14 : 34);     // 纵向净距 = 一张卡高 + 一点呼吸（窄屏收紧一点）
    var b = bandOf(y);
    for (i = 0; i < placed.length; i++) {
      // 一条带只放一张 → 13 条沿溪均匀铺开，不会某一段挤两条、另一段落空
      if (mode !== 'free' && b === placed[i].b) return false;
      if (Math.abs(y - placed[i].y) < vv && Math.abs(x - placed[i].x) < ww) return false;
    }
    for (i = 0; i < buds.length; i++) {
      if (Math.abs(y - buds[i]._y) < hh + (W < 560 ? 52 : 64) && Math.abs(x - buds[i]._x) < bh) return false;
    }
    if (mode === 'loose' || mode === 'free') return true;   // 兜底时仍不能压苗，只是不再顾及小花/节点
    for (i = 0; i < nodes.length; i++) {
      dx = x - sideX(nodes[i]._ci); dy = y - centerOf(nodes[i]._ci);
      if (dx * dx + dy * dy < 86 * 86) return false;
    }
    if (mode === 'strict') {
      for (i = 0; i < decoFlowers.length; i++) {
        dx = x - decoFlowers[i]._x; dy = y - decoFlowers[i]._y;
        if (dx * dx + dy * dy < 60 * 60) return false;
      }
    }
    return true;
  }

  function layoutWords() {
    if (!words.length) return;
    measureWords();
    var M = wordMargin(), placed = [], i, t, ci, bd, k, dir, cand, yy, got;
    var n = words.length;
    // 把溪长等分成 n 条带，每条带放一张卡 —— 这样不会某一块挤一堆、另一块空着
    var yA = TOP + 30, yB = H - BOT - 30;
    var band = (yB - yA) / n;
    wordYA = yA; wordBand = band;
    var slack = band * 0.30;   // 在自己的带里最多能挪多远（大了就会两条挤进同一带，看着就不均了）
    for (i = 0; i < n; i++) {
      var bTop = yA + i * band, bBot = bTop + band;
      var yMid = (bTop + bBot) / 2;
      var yLo = Math.max(40, bTop + 14 - slack), yHi = Math.min(H - 40, bBot - 14 + slack);
      var clampY = function (v) { return Math.max(yLo, Math.min(yHi, v)); };
      // 离它最近的那一个拐弯：决定它落在「内侧」还是「外侧」
      ci = 0; bd = 1e9;
      for (k = 0; k < nC; k++) { var dd = Math.abs(centerOf(k) - yMid); if (dd < bd) { bd = dd; ci = k; } }
      got = null;
      // 先试外侧（拐弯背面，空得最多），再试内侧；上下挪几格找位子
      var order = [(i % 2 === 0) ? -dirs[ci] : dirs[ci], (i % 2 === 0) ? dirs[ci] : -dirs[ci]];
      for (var s = 0; s < order.length && !got; s++) {
        dir = order[s];
        // 拐弯背面（外侧）空得最多，允许它落到更远的地方，把大片空白用起来
        var hi = (dir === -dirs[ci]) ? 0.80 : 0.62;
        for (t = 0; t < 26 && !got; t++) {
          yy = clampY(yMid + (((t % 2) ? 1 : -1) * Math.ceil(t / 2) * 34) + (rnd(i + 1, t + 1) - 0.5) * 40);
          cand = crookPoint(yy, dir, M, 0.14, hi, rnd(i + 3, t + 7), centerOf(ci));
          cand.y = clampY(cand.y);
          if (wordFits(cand.x, cand.y, placed, 'strict')) got = cand;
        }
      }
      if (!got) {   // 放宽：允许贴近小花
        for (t = 0; t < 22 && !got; t++) {
          yy = clampY(yMid + (rnd(i + 9, t + 1) - 0.5) * band);
          cand = crookPoint(yy, dirs[ci], M, 0.12, 0.60, rnd(i + 11, t + 3), centerOf(ci));
          cand.y = clampY(cand.y);
          if (wordFits(cand.x, cand.y, placed, 'relaxed')) got = cand;
        }
      }
      if (!got) {   // 兜底：只要不压水线就放下
        for (t = 0; t < 70 && !got; t++) {
          yy = clampY(yMid + (rnd(i + 13, t + 1) - 0.5) * band * 1.6);
          cand = crookPoint(yy, (t % 2 ? dirs[ci] : -dirs[ci]), M, 0.10, 0.80, rnd(i + 17, t + 5), centerOf(ci));
          cand.y = clampY(cand.y);
          if (wordFits(cand.x, cand.y, placed, 'loose')) got = cand;
        }
      }
      if (!got) {   // 最后兜底：挣脱自己的带，整幅随机找空位（窄屏也保证 13 条都在，内容不丢）
        // 允许越出自己的带一点，但不能跑远 —— 否则第 13 张会飞到溪首，顺序就乱了。
        // 这里用确定性网格扫描而不是随机撒点：有空位就一定找得到，不会靠运气漏掉某一条
        var halfW = wordHalf(), lo = halfW + 14, span = W - 2 * lo;
        var yTop = Math.max(40, bTop - band * 0.45), yBot = Math.min(H - 40, bBot + band * 0.45);
        var xs = [], ys = [], gx, gy;
        for (gx = 0; gx <= 20; gx++) xs.push(lo + span * gx / 20);
        for (gy = 0; gy <= 16; gy++) ys.push(yTop + (yBot - yTop) * gy / 16);
        var feas = [];
        for (gx = 0; gx < xs.length; gx++) {
          for (gy = 0; gy < ys.length; gy++) {
            if (wordFits(xs[gx], ys[gy], placed, 'free')) feas.push({ x: xs[gx], y: ys[gy] });
          }
        }
        // 从可行点里挑一个再加抖动：否则全落在网格上，一排卡片都贴着同一个 x，更单调
        if (feas.length) {
          var pick = feas[Math.min(feas.length - 1, Math.floor(rnd(i + 51, 7) * feas.length))];
          for (t = 0; t < 12 && !got; t++) {
            var jx = pick.x + (rnd(i + 53, t + 1) - 0.5) * 14;
            var jy = pick.y + (rnd(i + 57, t + 3) - 0.5) * 16;
            if (wordFits(jx, jy, placed, 'free')) got = { x: jx, y: jy };
          }
          if (!got) got = pick;
        }
      }
      if (!got) { words[i].style.display = 'none'; continue; }
      words[i].style.display = '';
      words[i].style.left = got.x + 'px';
      words[i].style.top = got.y + 'px';
      placed.push({ x: got.x, y: got.y, b: bandOf(got.y) });
    }
  }

  // 进入视野 → 缓缓降落（错开一点先后，像叶子依次落定）
  var wio = ('IntersectionObserver' in window)
    ? new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('is-landed'); wio.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -10% 0px' })
    : null;
  // 必须在 layoutWords() 之后调用：否则会在 (0,0) 处先降落一次再被挪走
  function armWords() {
    words.forEach(function (w, i) {
      // 每片一点不同的微倾斜：像被人随手搁在溪畔，而不是排版排出来的
      var tilt = (rnd(i + 31, 7) - 0.5) * 3.4;
      w.style.setProperty('--wtilt', tilt.toFixed(2) + 'deg');
      w.setAttribute('data-s', String((i % 3) + 1));           // 三种卵石形态轮换
      var card = w.querySelector('.word__card');
      if (card) {   // 浮动节奏各不相同，不整齐划一
        card.style.animationDuration = (6.2 + rnd(i + 41, 3) * 3.4).toFixed(2) + 's';
        card.style.animationDelay = (-rnd(i + 43, 5) * 8).toFixed(2) + 's';
      }
      w.style.transitionDelay = ((i % 3) * 160) + 'ms';
      if (wio) wio.observe(w); else w.classList.add('is-landed');
    });
  }

  /* ---------- 装饰层：萤火虫 / 蝴蝶 / 散落小花（均在拐弯内侧，绝不压水线） ---------- */
  function flowerSVG(c1, c2) {
    return '<svg class="deco-flower" viewBox="0 0 24 24" aria-hidden="true">' +
      '<ellipse cx="12" cy="4.6" rx="3.2" ry="4.4" fill="' + c1 + '"/>' +
      '<ellipse cx="12" cy="19.4" rx="3.2" ry="4.4" fill="' + c1 + '"/>' +
      '<ellipse cx="4.6" cy="12" rx="4.4" ry="3.2" fill="' + c1 + '"/>' +
      '<ellipse cx="19.4" cy="12" rx="4.4" ry="3.2" fill="' + c1 + '"/>' +
      '<circle cx="12" cy="12" r="3.4" fill="' + c2 + '"/></svg>';
  }
  // 在拐弯内侧放一朵装饰花：避开苗与节点，放不下则返回 false
  function spawnFlowerAt(p, scale) {
    var x = p.x, y = p.y, i;
    for (i = 0; i < buds.length; i++) {
      var dx = x - buds[i]._x, dy = y - buds[i]._y;
      if (dx * dx + dy * dy < 34 * 34) return false;
    }
    for (i = 0; i < nodes.length; i++) {
      var nx = sideX(nodes[i]._ci), ny = centerOf(nodes[i]._ci);
      var ndx = x - nx, ndy = y - ny;
      if (ndx * ndx + ndy * ndy < 42 * 42) return false;
    }
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
    wrap._x = x; wrap._y = y;
    creek.appendChild(wrap);
    decoFlowers.push(wrap);
    return true;
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
      ffBox = ff;
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
      bfBox = bf;
    }
    // 每个拐弯内侧：苗与苗之间、簇心附近，均匀堆一点花
    clusterKeys.forEach(function (k, ci) {
      var arr = clusters[k], n = arr.length, cy = centerOf(ci);
      for (var m = 0; m < n - 1; m++) {
        var yMid = (arr[m]._y + arr[m + 1]._y) / 2;
        spawnFlowerAt(crookPoint(yMid, dirs[ci], 54, 0.08, 0.42, Math.random(), cy), 0.6 + Math.random() * 0.2);
      }
      for (var f = 0; f < 3; f++) {
        var fy = cy + (Math.random() - 0.5) * 2 * ((Math.max(1, n - 1) * BUD_GAP * 0.55) + 30);
        spawnFlowerAt(crookPoint(fy, dirs[ci], 54, 0.08, 0.44, Math.random(), cy), 0.55 + Math.random() * 0.45);
      }
    });
    // 簇与簇之间的空白：在内侧凹处补几朵，铺满空隙
    for (var ci2 = 0; ci2 < nC - 1; ci2++) {
      var y0 = centerOf(ci2), y1 = centerOf(ci2 + 1);
      for (var g = 0; g < 6; g++) {
        var gy = y0 + (g + 1) * (y1 - y0) / 7;
        spawnFlowerAt(crookPoint(gy, dirs[ci2], 54, 0.08, 0.40, Math.random(), y0), 0.6 + Math.random() * 0.5);
      }
    }
  }
  function layoutDeco() {
    decoFlowers.forEach(function (wrap) {
      wrap.style.left = wrap._x + 'px';
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
  // 换宽度就整块重排：花与词的坐标都是绝对像素，不重建就会错位
  function clearDeco() {
    decoFlowers.forEach(function (w) { if (w.parentNode) w.parentNode.removeChild(w); });
    decoFlowers = [];
    if (ffBox && ffBox.parentNode) ffBox.parentNode.removeChild(ffBox);
    if (bfBox && bfBox.parentNode) bfBox.parentNode.removeChild(bfBox);
    ffBox = bfBox = null;
  }
  function relayout() {
    clearDeco();
    size();                 // 先算出 W / 各定位（苗与节点的位置），再据此布花与词
    buildDeco();            // 用已算好的苗/节点位置撒花、避开
    layoutDeco();           // 给新撒的花定位
    layoutWords();          // 词落在剩下的空白处
    armWords();
  }
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(relayout, 150); });

  function boot() {
    buildNodes();
    size();
    buildDeco();
    layoutDeco();
    layoutWords();
    creek.classList.add('is-live');
    armWords();
    paint();
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot);
  else boot();
})();
