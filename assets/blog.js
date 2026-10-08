/* 成长日志 · 年轮（Tree Rings）
   —— 一圈年轮 = 一段时光。圆心是最早的那粒种子，最外一圈是此刻；
      每圈按月份落着花，悬停一圈会亮起、圆心浮出那段日子的名字，
      轻点就展开当年的心事（当时的我 ↔ 现在的我，一段气泡流）。
      背景随季节换（春樱 / 夏萤 / 秋叶 / 冬雪），另有飘叶、光点与水纹。
      无 JS 时 .ring 不带 .is-live，退化为竖排卡片。 */
(function () {
  var ring = document.getElementById('ring');
  if (!ring) return;

  var svg      = document.getElementById('ringSvg');
  var gRipples = document.getElementById('ringRipples');
  var gSpokes  = document.getElementById('ringSpokes');
  var gRings   = document.getElementById('ringRings');
  var gNodes   = document.getElementById('ringNodes');
  var skyBox   = document.getElementById('ringSky');
  var dotBox   = document.getElementById('ringDots');
  var leafBox  = document.getElementById('ringLeaves');
  var core     = document.getElementById('ringCore');
  var coreEra  = document.getElementById('coreEra');
  var coreSub  = document.getElementById('coreSub');
  var logs     = Array.prototype.slice.call(ring.querySelectorAll('.log'));
  var words    = Array.prototype.slice.call(ring.querySelectorAll('.word'));
  var reduce   = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS       = 'http://www.w3.org/2000/svg';

  var NB = 200;      // viewBox 半宽，所有坐标归一化到 -200..200
  var R_CORE = 38;   // 圆心留给文字的半径（要明显大于圆心文字块的半径，否则最内圈会贴着字走）
  var R_EDGE = 15;   // 最外圈到边界的余量（给月份标签）
  var SEP = 15;      // 同一圈上相邻两朵花至少隔开的角度
  var SEASON_CN = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };

  var groups = [];   // 一圈一组：[{i, era, season, items:[el...]}]
  var nodes = [];    // 圈上的花（SVG <g>）
  var flora = [];    // 圈与圈之间的装饰小花
  var W = 0, DA = 0, RAD = 0, PT = 0, CY = 0;
  var wHalfW = 82, wHalfH = 70;

  /* ---------- 小工具 ---------- */
  // 同一次加载内稳定的伪随机：刷新不会乱跳
  function rnd(a, b) { var s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); }
  function rad(d) { return d * Math.PI / 180; }
  function monthAngle(m) { return -90 + (m - 1) * 30; }   // 1 月在正上方，顺时针一格一月
  // 圈数、段数、月份都写成中文，跟「高三 · 停课」这样的时代名保持一致
  var CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  function cnNum(n) {
    if (n <= 10) return CN[n];
    if (n < 20) return '十' + CN[n - 10];
    if (n % 10 === 0) return CN[n / 10] + '十';
    return CN[Math.floor(n / 10)] + '十' + CN[n % 10];
  }
  function svgEl(tag, attrs) {
    var e = document.createElementNS(NS, tag), k;
    for (k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    return e;
  }
  function txt(el, sel) { var n = el.querySelector(sel); return n ? n.textContent : ''; }
  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  /* ---------- 一圈一组 ---------- */
  function buildGroups() {
    var by = {}, keys, i;
    logs.forEach(function (el) {
      var gi = +(el.getAttribute('data-ring') || 0);
      (by[gi] = by[gi] || []).push(el);
    });
    keys = Object.keys(by).map(Number).sort(function (a, b) { return a - b; });
    keys.forEach(function (gi) {
      var arr = by[gi].slice().sort(function (a, b) {
        return (+a.getAttribute('data-month')) - (+b.getAttribute('data-month'));
      });
      groups.push({
        i: gi,
        era: arr[0].getAttribute('data-era') || '',
        season: arr[0].getAttribute('data-season') || 'autumn',
        items: arr
      });
    });
  }
  function ringGap() { return (NB - R_EDGE - R_CORE) / Math.max(1, groups.length); }
  // 一圈上第 i 圈的半径（由内而外）
  function ringR(i) { return R_CORE + (i + 1) * ringGap(); }
  function rMax() { return ringR(groups.length - 1); }

  /* ---------- 同月的两朵花会叠在一起：按最小间隔推开，再整体居中回原来的方位 ---------- */
  function spread(list) {
    var i, n = list.length, shift;
    if (n <= 1) return;
    for (i = 1; i < n; i++) if (list[i].a - list[i - 1].a < SEP) list[i].a = list[i - 1].a + SEP;
    shift = (list[0].base + list[n - 1].base) / 2 - (list[0].a + list[n - 1].a) / 2;
    for (i = 0; i < n; i++) list[i].a += shift;
  }

  /* ---------- 画年轮 ---------- */
  function drawSpokes() {
    var rOut = rMax() + 7, rIn = R_CORE * 0.5, m, a, i;
    while (gSpokes.firstChild) gSpokes.removeChild(gSpokes.firstChild);
    for (m = 1; m <= 12; m++) {
      a = rad(monthAngle(m));
      gSpokes.appendChild(svgEl('line', {
        'class': 'ring__spoke' + (m % 3 === 1 ? ' ring__spoke--q' : ''),
        x1: (Math.cos(a) * rIn).toFixed(1), y1: (Math.sin(a) * rIn).toFixed(1),
        x2: (Math.cos(a) * rOut).toFixed(1), y2: (Math.sin(a) * rOut).toFixed(1)
      }));
    }
  }
  function drawRings() {
    var frag = document.createDocumentFragment(), gi, r, rPrev, grainA, grainB, wrap;
    while (gRings.firstChild) gRings.removeChild(gRings.firstChild);
    groups.forEach(function (g, gi) {
      r = ringR(gi);
      // 整圈裹进 .ring__reveal：加载时由内向外逐圈从圆心荡开，像水波一圈圈推出去
      wrap = svgEl('g', { 'class': 'ring__reveal' });
      wrap.style.animationDelay = (gi * 0.13).toFixed(2) + 's';
      // 两圈之间补两条更细更淡的纹理：8 条圈就会读成"年轮"，而不是射击靶
      if (gi > 0) {
        rPrev = ringR(gi - 1);
        grainA = rPrev + (r - rPrev) * 0.34 + (rnd(gi + 91, 1) - 0.5) * 1.6;
        grainB = rPrev + (r - rPrev) * 0.72 + (rnd(gi + 93, 2) - 0.5) * 1.6;
        wrap.appendChild(svgEl('circle', { 'class': 'ring__grain', r: grainA.toFixed(1) }));
        wrap.appendChild(svgEl('circle', { 'class': 'ring__grain ring__grain--b', r: grainB.toFixed(1) }));
      }
      // 命中层在下（细线太难点中），看得见的圈在上且不吃事件
      wrap.appendChild(svgEl('circle', { 'class': 'ring__hit', 'data-g': gi, r: r.toFixed(1) }));
      wrap.appendChild(svgEl('circle', { 'class': 'ring__c', 'data-g': gi, r: r.toFixed(1) }));
      frag.appendChild(wrap);
    });
    gRings.appendChild(frag);
  }
  function drawRipples() {
    var i, r = (rMax() + 4).toFixed(1);
    while (gRipples.firstChild) gRipples.removeChild(gRipples.firstChild);
    if (reduce) return;
    for (i = 0; i < 4; i++) gRipples.appendChild(svgEl('circle', { 'class': 'ring__ripple', r: r }));
  }
  function drawNodes() {
    var frag = document.createDocumentFragment();
    while (gNodes.firstChild) gNodes.removeChild(gNodes.firstChild);
    groups.forEach(function (g, gi) {
      var r = ringR(gi);
      var list = g.items.map(function (el) {
        var m = +el.getAttribute('data-month');
        return { el: el, m: m, base: monthAngle(m), a: monthAngle(m) };
      });
      spread(list);
      list.forEach(function (it, k) {
        var a = rad(it.a);
        var x = Math.cos(a) * r, y = Math.sin(a) * r;
        var idx = logs.indexOf(it.el);
        var kind = it.el.getAttribute('data-kind') || 'bloom';
        var anchor = Math.cos(a) > 0.25 ? 'start' : (Math.cos(a) < -0.25 ? 'end' : 'middle');
        // 标签的径向落点要落在「两圈之间」的空隙里，压在圈线上会被划断；
        // 同一圈上不止一条时，第二条再往外挪一整格，两行字才不会叠
        var off = ringGap() * (0.5 + (k % 2) * 1.05);
        var g = svgEl('g', {
          'class': 'rnode', 'data-log': idx, 'data-g': gi, 'data-kind': kind,
          transform: 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')',
          tabindex: '0', role: 'button', 'aria-label': '展开心事：' + txt(it.el, '.log__title')
        });
        g.appendChild(svgEl('circle', { 'class': 'rnode__halo', r: 11 }));
        var inner = svgEl('g', { 'class': 'rnode__g' });
        // 四片胖花瓣 + 一颗稍大的花心盖住根部 —— 才像花，不然是个十字
        inner.appendChild(svgEl('ellipse', { 'class': 'rnode__petal', cx: 0, cy: -3.5, rx: 2.7, ry: 3.6 }));
        inner.appendChild(svgEl('ellipse', { 'class': 'rnode__petal', cx: 0, cy: 3.5, rx: 2.7, ry: 3.6 }));
        inner.appendChild(svgEl('ellipse', { 'class': 'rnode__petal', cx: -3.5, cy: 0, rx: 3.6, ry: 2.7 }));
        inner.appendChild(svgEl('ellipse', { 'class': 'rnode__petal', cx: 3.5, cy: 0, rx: 3.6, ry: 2.7 }));
        inner.appendChild(svgEl('circle', { 'class': 'rnode__core', r: 2.6 }));
        g.appendChild(inner);
        var t = svgEl('text', {
          'class': 'rnode__txt',
          x: (Math.cos(a) * off).toFixed(1),
          y: (Math.sin(a) * off + 3).toFixed(1),
          'text-anchor': anchor
        });
        t.textContent = cnNum(it.m) + '月';
        g.appendChild(t);
        frag.appendChild(g);
        nodes.push({ el: g, x: x, y: y, a: it.a, gi: gi });
      });
    });
    gNodes.appendChild(frag);
  }

  /* ---------- 圈与圈之间的装饰小花（纯装饰，跟着年轮缩放） ---------- */
  var FLORA_COL = [
    ['rgba(246,184,200,.9)', 'rgba(244,213,141,.95)'],
    ['rgba(159,240,200,.85)', 'rgba(244,213,141,.95)'],
    ['rgba(244,213,141,.9)', 'rgba(255,246,224,.95)']
  ];
  function floretSVG(c1, c2) {
    var g = svgEl('g', { 'class': 'floret' });
    g.appendChild(svgEl('ellipse', { cx: 0, cy: -3.4, rx: 1.9, ry: 2.8, fill: c1 }));
    g.appendChild(svgEl('ellipse', { cx: 0, cy: 3.4, rx: 1.9, ry: 2.8, fill: c1 }));
    g.appendChild(svgEl('ellipse', { cx: -3.2, cy: 0, rx: 2.8, ry: 1.9, fill: c1 }));
    g.appendChild(svgEl('ellipse', { cx: 3.2, cy: 0, rx: 2.8, ry: 1.9, fill: c1 }));
    g.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 1.7, fill: c2 }));
    return g;
  }
  function drawFlora() {
    if (!gFlora) return;
    while (gFlora.firstChild) gFlora.removeChild(gFlora.firstChild);
    flora = [];
    var gap = ringGap();
    // 从第 1 圈起：最内圈的内侧就是圆心文字区，撒在那儿会糊住字
    for (var gi = 1; gi < groups.length; gi++) {
      var rBand = ringR(gi) - gap * 0.5;           // 落在这一圈的内侧一半
      var per = (gi < 2 ? 2 : 3);
      for (var k = 0; k < per; k++) {
        var aDeg = (k + rnd(gi + 3, k + 1)) * (360 / per) + gi * 23;
        var a = rad(aDeg), x = Math.cos(a) * rBand, y = Math.sin(a) * rBand;
        var ok = true, i;
        for (i = 0; i < nodes.length; i++) {
          var dx = x - nodes[i].x, dy = y - nodes[i].y;
          if (dx * dx + dy * dy < 12 * 12) { ok = false; break; }
        }
        if (!ok) continue;
        var col = FLORA_COL[flora.length % FLORA_COL.length];
        var f = floretSVG(col[0], col[1]);
        f.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')');
        if (!reduce) {
          f.style.animationDuration = (5.4 + rnd(gi + 7, k + 2) * 4).toFixed(1) + 's';
          f.style.animationDelay = (-rnd(gi + 9, k + 4) * 6).toFixed(1) + 's';
        }
        gFlora.appendChild(f);
        flora.push({ x: x, y: y });
      }
    }
  }

  /* ---------- 尺寸：年轮直径、舞台高度 ---------- */
  function size() {
    W = ring.clientWidth;
    var narrow = W < 820;
    DA = narrow ? Math.min(W, 400) : Math.min(660, W * 0.64);
    RAD = DA / 2;
    // 词条已撤下，不再为卡片预留上下空地；桌面只留一点边距让圆盘更聚拢
    PT = narrow ? DA : DA + 48;
    CY = PT / 2;
    ring.style.setProperty('--da', DA.toFixed(0) + 'px');
    ring.style.setProperty('--pt', PT.toFixed(0) + 'px');
    // 粒子从 top:-22px 起飘，落点要落在容器底部附近再淡出，飘太远会被裁掉、看着像突然消失
    ring.style.setProperty('--fall', (PT + 30).toFixed(0) + 'px');
  }

  /* ---------- 背景：季节粒子 / 光点 / 飘叶 ---------- */
  function buildSky() {
    if (!skyBox || reduce) return;
    while (skyBox.firstChild) skyBox.removeChild(skyBox.firstChild);
    var n = W < 820 ? 15 : 26, i, s;
    for (i = 0; i < n; i++) {
      s = document.createElement('i');
      s.style.setProperty('--x', (rnd(i + 1, 3) * 100).toFixed(2) + '%');
      s.style.setProperty('--w', (4 + rnd(i + 5, 7) * 5).toFixed(1) + 'px');
      s.style.setProperty('--d1', (11 + rnd(i + 7, 11) * 9).toFixed(1) + 's');
      s.style.setProperty('--dl', (-rnd(i + 9, 13) * 14).toFixed(1) + 's');
      skyBox.appendChild(s);
    }
  }
  function buildDots() {
    if (!dotBox || reduce) return;
    while (dotBox.firstChild) dotBox.removeChild(dotBox.firstChild);
    var n = 12, i, s;
    for (i = 0; i < n; i++) {
      s = document.createElement('i');
      s.style.setProperty('--x', (rnd(i + 21, 3) * 100).toFixed(2) + '%');
      s.style.setProperty('--y', (8 + rnd(i + 23, 5) * 84).toFixed(2) + '%');
      s.style.setProperty('--d1', (13 + rnd(i + 25, 7) * 12).toFixed(1) + 's');
      s.style.setProperty('--d2', (2.6 + rnd(i + 27, 9) * 2.4).toFixed(1) + 's');
      s.style.setProperty('--dl', (-rnd(i + 29, 11) * 16).toFixed(1) + 's');
      dotBox.appendChild(s);
    }
  }
  function buildLeaves() {
    if (!leafBox || reduce) return;
    while (leafBox.firstChild) leafBox.removeChild(leafBox.firstChild);
    var n = 7, i, s;
    for (i = 0; i < n; i++) {
      s = document.createElement('i');
      s.style.setProperty('--x', (rnd(i + 41, 3) * 96).toFixed(2) + '%');
      s.style.setProperty('--d1', (18 + rnd(i + 43, 5) * 12).toFixed(1) + 's');
      s.style.setProperty('--dl', (-rnd(i + 45, 7) * 20).toFixed(1) + 's');
      leafBox.appendChild(s);
    }
  }

  /* ---------- 圆心：当前聚焦的那段日子 ---------- */
  function setCore(era, sub) {
    if (coreEra.textContent === era && coreSub.textContent === sub) return;
    coreEra.textContent = era;
    coreSub.textContent = sub;
    core.classList.remove('is-flip');
    void core.offsetWidth;                 // 重启动画
    core.classList.add('is-flip');
  }
  function defaultCore() {
    // 圆心那块地方窄屏只有八十来像素宽，副标太长会折成两行
    var sub = cnNum(groups.length) + '圈 · ' + cnNum(logs.length) +
      (W < 820 ? '段' : '段心事');
    setCore('成长年轮', sub);
  }

  /* ---------- 季节：跟着聚焦的那一圈走，切换时先淡出再换 ---------- */
  var seasonNow = 'autumn', seasonTimer = null;
  function setSeason(s) {
    if (!s || s === seasonNow) return;
    seasonNow = s;
    if (!skyBox) return;
    skyBox.classList.add('is-swap');
    clearTimeout(seasonTimer);
    seasonTimer = setTimeout(function () {
      skyBox.setAttribute('data-season', s);
      skyBox.classList.remove('is-swap');
    }, 280);
  }

  function focusRing(gi) {
    var g = groups[gi];
    if (!g) return;
    ring.classList.add('is-focus');
    Array.prototype.forEach.call(gRings.querySelectorAll('.ring__c'), function (c) {
      c.classList.toggle('is-hot', +c.getAttribute('data-g') === gi);
    });
    setCore(g.era, SEASON_CN[g.season] + ' · ' + cnNum(g.items.length) + '段心事');
    setSeason(g.season);
  }
  function focusNode(rec) {
    var el = logs[+rec.el.getAttribute('data-log')];
    focusRing(+rec.el.getAttribute('data-g'));
    nodes.forEach(function (n) { n.el.classList.toggle('is-hot', n.el === rec.el); });
    var m = +el.getAttribute('data-month');
    // 窄屏圆心只放得下两行，长标题会撑出去，退成"几月 · 哪一段"
    if (W < 820) setCore(cnNum(m) + '月 · ' + txt(el, '.log__era'), '');
    else setCore(cnNum(m) + '月 · ' + txt(el, '.log__title'), txt(el, '.log__era'));
  }
  function blur() {
    ring.classList.remove('is-focus');
    Array.prototype.forEach.call(gRings.querySelectorAll('.ring__c'), function (c) { c.classList.remove('is-hot'); });
    nodes.forEach(function (n) { n.el.classList.remove('is-hot'); });
    defaultCore();
    setSeason(groups.length ? groups[groups.length - 1].season : 'autumn');
  }

  /* ---------- 轻点处荡开一圈水纹 ---------- */
  function tapRipple(e) {
    if (reduce || !svg) return;
    var b = svg.getBoundingClientRect();
    if (!b.width) return;
    var nx = (e.clientX - b.left) / b.width * (NB * 2) - NB;
    var ny = (e.clientY - b.top) / b.height * (NB * 2) - NB;
    var c = svgEl('circle', { 'class': 'ring__tap', cx: nx.toFixed(1), cy: ny.toFixed(1), r: rMax() + 6 });
    svg.appendChild(c);
    setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 950);
  }

  /* ---------- 点开：一段气泡流（当时的我 ↔ 现在的我） ---------- */
  var petal = document.getElementById('petal');
  var petalCard = petal ? petal.querySelector('.petal__card') : null;
  var pEra = document.getElementById('petalEra');
  var pTitle = document.getElementById('petalTitle');
  var chat = document.getElementById('chat');

  function div(cls) { var d = document.createElement('div'); d.className = cls; return d; }
  function bubble(cls, html) {
    var b = div('chat__bub'); b.className = 'chat__bub ' + cls;
    if (html) b.innerHTML = html;
    return b;
  }
  function row(side, who, bub) {
    var r = div('chat__row chat__row--' + side);
    var w = document.createElement('span'); w.className = 'chat__who'; w.textContent = who;
    r.appendChild(w); r.appendChild(bub);
    return r;
  }
  function paras(el) {
    var out = '', ps = el.querySelectorAll('.log__body p');
    Array.prototype.forEach.call(ps, function (p) { out += '<p>' + esc(p.textContent) + '</p>'; });
    return out;
  }
  function fill(era, title, items, multi) {
    pEra.textContent = era;
    pTitle.textContent = title;
    chat.innerHTML = '';
    items.forEach(function (el) {
      if (multi) {
        var d = div('chat__day');
        d.textContent = el.getAttribute('data-when') || '';
        chat.appendChild(d);
      }
      var body = paras(el);
      if (multi) body = '<span class="chat__ttl">' + esc(txt(el, '.log__title')) + '</span>' + body;
      chat.appendChild(row('past', '当时的我', bubble('', body)));
      var q = txt(el, '.log__quote');
      if (q) chat.appendChild(row('now', '现在的我', bubble('', esc(q))));
    });
    petal.classList.add('is-open');
    petal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (petalCard) petalCard.scrollTop = 0;
    armChat();
  }
  function openLog(idx) {
    var el = logs[idx]; if (!el) return;
    fill(el.getAttribute('data-era') || '', txt(el, '.log__title'), [el], false);
  }
  function openRing(gi) {
    var g = groups[gi]; if (!g) return;
    fill(g.era, g.era, g.items, true);
  }
  function closePetal() {
    if (!petal) return;
    petal.classList.remove('is-open');
    petal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // 滚动到才弹出来：气泡从下方浮起
  var cio = ('IntersectionObserver' in window && petalCard)
    ? new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('is-in'); cio.unobserve(e.target); }
        });
      }, { root: petalCard, rootMargin: '0px 0px -6% 0px' })
    : null;
  function armChat() {
    var bubs = chat.querySelectorAll('.chat__bub');
    Array.prototype.forEach.call(bubs, function (b, i) {
      if (cio) { b.style.transitionDelay = Math.min(i, 4) * 70 + 'ms'; cio.observe(b); }
      else b.classList.add('is-in');
    });
  }

  /* ---------- 年轮之外的词：散落在四周，翻到时缓缓降落 ---------- */
  // 卡片尺寸必须实测（两行/三行差 20px，避让会差一截）；
  // 但降级规则不能写 width:100%，否则 is-live 之前量到的是撑满宽度
  function measureWords() {
    var w = 0, h = 0;
    words.forEach(function (el) { w = Math.max(w, el.offsetWidth); h = Math.max(h, el.offsetHeight); });
    if (w) wHalfW = w / 2 + 5;
    if (h) wHalfH = h / 2 + 7;
  }
  // 矩形卡片到圆心的真实最近距离（矩形 vs 圆，不是中心点距离）
  function clearOfWheel(x, y, need) {
    var dx = Math.max(0, Math.abs(x - W / 2) - wHalfW);
    var dy = Math.max(0, Math.abs(y - CY) - wHalfH);
    return Math.sqrt(dx * dx + dy * dy) > RAD + need;
  }
  // clearNeed：矩形到年轮的最小净空；vv / ww：两张卡之间横竖至少要离开的身位
  // 矩形卡片：横向或纵向让开一个身位就不会叠上，比欧氏距离可靠
  function wordFits(x, y, placed, clearNeed, vv, ww) {
    var i, hw = wHalfW, hh = wHalfH;
    if (x < hw + 10 || x > W - hw - 10) return false;
    if (y < hh + 8 || y > PT - hh - 8) return false;
    if (!clearOfWheel(x, y, clearNeed)) return false;
    for (i = 0; i < placed.length; i++) {
      if (Math.abs(y - placed[i].y) < vv && Math.abs(x - placed[i].x) < ww) return false;
    }
    return true;
  }
  // 逐轮收紧：先按舒服的间距铺；铺不下就一级级贴近，宁可挨紧一点，也绝不丢内容
  function gapTries() {
    var hw = wHalfW, hh = wHalfH, wide = W >= 820;
    return [
      { clear: 16, vv: hh * 2 + (wide ? 34 : 14), ww: hw * 2 + (wide ? 40 : 26) },
      { clear: 14, vv: hh * 2 + 18, ww: hw * 2 + 24 },
      { clear: 10, vv: hh * 2 + 8, ww: hw * 2 + 10 },
      { clear: 6, vv: hh * 2 + 2, ww: hw * 2 + 2 }
    ];
  }
  // 一圈均匀铺开。先用「最远点采样」在可行网格里挑 13 个彼此最散的点 ——
  // 比"每张按方位角找位子"靠得住：方位法在上下空间窄的时候会全挤到左右两侧
  function layoutWords() {
    words.forEach(function (w) { w.style.left = ''; w.style.top = ''; w.style.display = ''; });
    if (!words.length) return;
    if (W < 820) return;                 // 窄屏：CSS 已把它们排成流式，不需要坐标
    // 环带是细长的，"最远点采样"只会挑散点、填不满它（实测只能落下 12 张）。
    // 改成货架式：按行横切，每一行里扫出连续可行的区段，段内按卡宽均分。
    // 行距 = 卡高 + 呼吸，所以行与行天然不撞，只需管行内。
    function shelfPack(clearNeed, vv, ww) {
      var hw = wHalfW, hh = wHalfH, slots = [], r, x, s, k;
      var yTop = hh + 8, yBot = PT - hh - 8;
      var rowsN = Math.max(1, Math.floor((yBot - yTop) / vv) + 1);
      var gapY = rowsN > 1 ? (yBot - yTop) / (rowsN - 1) : 0;
      var xLo = hw + 10, xHi = W - hw - 10;
      for (r = 0; r < rowsN; r++) {
        var y = yTop + gapY * r, segs = [], segStart = null;
        for (x = xLo; x <= xHi; x += 8) {
          var ok = clearOfWheel(x, y, clearNeed);
          if (ok && segStart === null) segStart = x;
          else if (!ok && segStart !== null) { segs.push([segStart, x - 8]); segStart = null; }
        }
        if (segStart !== null) segs.push([segStart, xHi]);
        for (s = 0; s < segs.length; s++) {
          var len = segs[s][1] - segs[s][0];
          if (len < 0) continue;
          var cnt = Math.floor(len / ww) + 1;
          for (k = 0; k < cnt; k++) {
            slots.push({
              x: cnt === 1 ? (segs[s][0] + segs[s][1]) / 2 : segs[s][0] + len * k / (cnt - 1),
              y: y
            });
          }
        }
      }
      return slots;
    }
    var n = words.length, picked = [];
    var plans = gapTries(), t;
    for (t = 0; t < plans.length && picked.length < n; t++) {
      picked = shelfPack(plans[t].clear, plans[t].vv, plans[t].ww);
    }
    // 按行分桶。行内改成「两端→中间」的顺序，再逐行轮转着取够 13 张 ——
    // 这样少取几张时是左右对称地空出来，而不是从右边一路缺过去
    picked.sort(function (a, b) { return (a.y - b.y) || (a.x - b.x); });
    var buckets = [];
    picked.forEach(function (p) {
      var b = buckets[buckets.length - 1];
      if (!b || Math.abs(b.y - p.y) > 1) { b = { y: p.y, arr: [] }; buckets.push(b); }
      b.arr.push(p);
    });
    var ordered = [], idx = 0, more = true, r, a, c;
    for (r = 0; r < buckets.length; r++) {
      a = buckets[r].arr; c = a.length;
      var s = [], i;
      for (i = 0; i < c; i++) s.push((i % 2) ? a[c - 1 - (i >> 1)] : a[i >> 1]);
      buckets[r].arr = s;
    }
    while (more) {
      more = false;
      for (r = 0; r < buckets.length; r++) {
        if (buckets[r].arr[idx]) { ordered.push(buckets[r].arr[idx]); more = true; }
      }
      idx++;
    }
    picked = ordered.slice(0, n);
    ring.setAttribute('data-words', picked.length + '/' + n);
    // 落位。整排钉在同一 y 上太像排版摆的，纵向给一点随机；同行横向已留足身位，不必再抖
    var op0 = plans[0];
    words.forEach(function (w, i2) {
      if (!picked[i2]) { w.style.display = 'none'; return; }
      var p = picked[i2], k, jx = p.x, jy = p.y;
      for (k = 0; k < 14; k++) {
        var ty2 = p.y + (rnd(i2 + 83, k + 3) - 0.5) * 26;
        if (ty2 < wHalfH + 8 || ty2 > PT - wHalfH - 8) continue;
        jy = ty2; break;
      }
      for (k = 0; k < 10; k++) {
        var tx2 = p.x + (rnd(i2 + 81, k + 1) - 0.5) * 16;
        if (tx2 > wHalfW + 10 && tx2 < W - wHalfW - 10) { jx = tx2; break; }
      }
      w.style.left = jx.toFixed(1) + 'px';
      w.style.top = jy.toFixed(1) + 'px';
    });
  }
  var wio = ('IntersectionObserver' in window)
    ? new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('is-landed'); wio.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -10% 0px' })
    : null;
  function armWords() {
    words.forEach(function (w, i) {
      w.style.setProperty('--wtilt', ((rnd(i + 71, 7) - 0.5) * 3.4).toFixed(2) + 'deg');
      w.setAttribute('data-s', String((i % 3) + 1));
      var card = w.querySelector('.word__card');
      if (card) {
        card.style.animationDuration = (6.2 + rnd(i + 73, 3) * 3.4).toFixed(2) + 's';
        card.style.animationDelay = (-rnd(i + 75, 5) * 8).toFixed(2) + 's';
      }
      w.style.transitionDelay = ((i % 3) * 160) + 'ms';
      if (wio) wio.observe(w); else w.classList.add('is-landed');
    });
  }

  /* ---------- 事件 ---------- */
  // 悬停统一挂在 svg 上：SVG 的 <g> 自身不吃事件，只有子元素吃，
  // 所以 mouseleave 挂在 g 上并不可靠，得用 mouseout 看指针去哪了
  function onOver(e) {
    var n = e.target.closest ? e.target.closest('.rnode') : null;
    if (n) {
      var rec = null;
      nodes.forEach(function (x) { if (x.el === n) rec = x; });
      if (rec) { focusNode(rec); return; }
    }
    var hit = e.target.closest ? e.target.closest('.ring__hit') : null;
    if (hit) focusRing(+hit.getAttribute('data-g'));
  }
  function onOut(e) {
    var to = e.relatedTarget;
    if (to && svg.contains(to) && to.closest && (to.closest('.rnode') || to.closest('.ring__hit'))) return;
    blur();
  }
  function bind() {
    svg.addEventListener('mouseover', onOver);
    svg.addEventListener('mouseout', onOut);
    svg.addEventListener('click', function (e) {
      var n = e.target.closest ? e.target.closest('.rnode') : null;
      if (n) { tapRipple(e); openLog(+n.getAttribute('data-log')); return; }
      var hit = e.target.closest ? e.target.closest('.ring__hit') : null;
      if (hit) { tapRipple(e); openRing(+hit.getAttribute('data-g')); }
    });
    gNodes.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var n = e.target.closest ? e.target.closest('.rnode') : null;
      if (!n) return;
      e.preventDefault();
      openLog(+n.getAttribute('data-log'));
    });

    if (document.getElementById('petalClose')) {
      document.getElementById('petalClose').addEventListener('click', closePetal);
    }
    if (document.getElementById('petalBackdrop')) {
      document.getElementById('petalBackdrop').addEventListener('click', closePetal);
    }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePetal(); });
  }

  /* ---------- 换宽度就整块重排：花的坐标是绝对像素，不重建会错位 ---------- */
  var rt;
  function relayout() {
    measureWords();
    size();
    layoutWords();
    buildSky();
  }
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(relayout, 160); });

  var gFlora = svgEl('g', { 'class': 'ring__flora' });

  function boot() {
    buildGroups();
    if (!groups.length) return;
    drawSpokes();
    drawRings();
    drawRipples();
    nodes = [];
    drawNodes();
    svg.insertBefore(gFlora, gNodes);   // 装饰小花压在心事的花下面
    drawFlora();
    measureWords();      // 卡片尺寸要实测，且必须在 is-live 之前量
    size();
    layoutWords();
    buildSky();
    buildDots();
    buildLeaves();
    bind();
    ring.classList.add('is-live');
    defaultCore();
    seasonNow = groups[groups.length - 1].season;
    if (skyBox) skyBox.setAttribute('data-season', seasonNow);
    armWords();
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot);
  else boot();
})();
