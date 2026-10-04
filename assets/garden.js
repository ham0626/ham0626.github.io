/* garden.js —— 油画草甸引擎（纯 Canvas 2D，零依赖、零贴图）
   装配（按 class 自动识别）：
     .hero__meadow  首页：夜色油画草甸（厚涂笔触 + 色点小花） + 两层小花 + 坐在花海中画油画的背影
   天空（云 / 雪山 / 闪耀星球）由 index.html 的 SVG 负责，本引擎只画地平线以下。
   降级：prefers-reduced-motion → 只渲染一帧静态画面 */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------------------------------------------------------------- 工具 */
  function mk(seed) {
    let a = seed >>> 0;
    return function () {
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const pick = (r, arr) => arr[(r() * arr.length) | 0];
  function hsl(h, s, l, a) {
    return 'hsla(' + (((h % 360) + 360) % 360).toFixed(0) + ',' + Math.max(0, Math.min(100, s)).toFixed(0) + '%,' +
      Math.max(0, Math.min(100, l)).toFixed(0) + '%,' + (a == null ? 1 : a) + ')';
  }
  const _pool = []; let _pi = 0;
  function tmp(w, h) {
    let c = _pool[_pi++ % 4];
    if (!c) { c = document.createElement('canvas'); _pool.push(c); }
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return c;
  }

  /* ------------------------------------------------------------ 花瓣与花头 */
  function petalPath(ctx, L, W, tipX) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-W, -L * 0.34, -W * 0.92 + tipX * 0.4, -L * 0.78, tipX, -L);
    ctx.bezierCurveTo(W * 0.92 + tipX * 0.4, -L * 0.78, W, -L * 0.34, 0, 0);
    ctx.closePath();
  }
  /* 花头：tone 0 远 → 1 近；夜色调色板（受星光照亮的冷粉 / 奶白 / 淡金 / 淡紫） */
  function head(ctx, kind, s, r, tone) {
    const L1 = (0.42 + tone * 0.20) * 100, L2 = (0.62 + tone * 0.16) * 100, L3 = (0.86 + tone * 0.08) * 100;
    const S1 = (0.45 + tone * 0.30) * 100, S2 = (0.60 + tone * 0.28) * 100, S3 = (0.74 + tone * 0.22) * 100;
    if (kind === 'daisy') {
      const n = 13 + ((r() * 4) | 0), h = pick(r, [46, 40, 350]);
      for (let i = 0; i < n; i++) {
        ctx.save(); ctx.rotate(i * TAU / n + (r() - 0.5) * 0.2);
        const l = s * (0.85 + r() * 0.3), w = s * 0.105;
        const g = ctx.createLinearGradient(0, 0, 0, -l);
        g.addColorStop(0, hsl(h, 22, L1 * 0.94)); g.addColorStop(1, hsl(h, 16, Math.min(98, L3)));
        ctx.fillStyle = g; petalPath(ctx, l, w, (r() - 0.5) * l * 0.16); ctx.fill();
        ctx.restore();
      }
      const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.3);
      cg.addColorStop(0, hsl(45, 92, 62 + tone * 10)); cg.addColorStop(1, hsl(38, 74, 42 + tone * 10));
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, s * 0.28, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(120,72,20,.45)'; ctx.lineWidth = Math.max(0.3, s * 0.03);
      for (let i = 0; i < 8; i++) {
        ctx.beginPath(); ctx.arc((r() - 0.5) * s * 0.3, (r() - 0.5) * s * 0.3, s * 0.045, 0, TAU); ctx.stroke();
      }
      return;
    }
    if (kind === 'poppy') {
      const h = pick(r, [6, 352, 24, 340]), n = 4 + ((r() * 2) | 0);
      for (let i = 0; i < n; i++) {
        ctx.save(); ctx.rotate(i * TAU / n + (r() - 0.5) * 0.3);
        const l = s * (0.9 + r() * 0.25), w = s * 0.62;
        const g = ctx.createLinearGradient(0, 0, 0, -l);
        g.addColorStop(0, hsl(h, S1 + 8, L1 * 0.84));
        g.addColorStop(0.45, hsl(h, S2 + 6, L2)); g.addColorStop(1, hsl(h + 6, S3, L3));
        ctx.fillStyle = g; petalPath(ctx, l, w, (r() - 0.5) * l * 0.1); ctx.fill();
        ctx.restore();
      }
      const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.34);
      cg.addColorStop(0, 'rgba(22,14,20,.9)'); cg.addColorStop(1, 'rgba(30,18,26,0)');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, s * 0.34, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(250,224,150,.7)'; ctx.lineWidth = Math.max(0.3, s * 0.028);
      for (let i = 0; i < 11; i++) {
        const a = r() * TAU, rr = s * (0.16 + r() * 0.14);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); ctx.stroke();
      }
      return;
    }
    if (kind === 'rose') {
      const h = pick(r, [340, 332, 350, 18]);
      const rings = [[7, 0.95, 0.42], [6, 0.64, 0.34], [5, 0.38, 0.24]];
      for (let k = 0; k < rings.length; k++) {
        const cnt = rings[k][0], L = s * rings[k][1], W = s * rings[k][2];
        for (let i = 0; i < cnt; i++) {
          ctx.save(); ctx.rotate(i * TAU / cnt + k * 0.42 + (r() - 0.5) * 0.16);
          const g = ctx.createLinearGradient(0, 0, 0, -L);
          g.addColorStop(0, hsl(h, S1, (L1 / 100 + k * 0.035) * 96));
          g.addColorStop(0.6, hsl(h + 2, S2, (L2 / 100 + k * 0.04) * 100));
          g.addColorStop(1, hsl(h + 4, S3, Math.min(97, L3 + k * 3)));
          ctx.fillStyle = g; petalPath(ctx, L, W, (r() - 0.5) * L * 0.2); ctx.fill();
          ctx.restore();
        }
      }
      return;
    }
    if (kind === 'spike') {
      const h = pick(r, [276, 288, 336, 264]), n = 9 + ((r() * 6) | 0);
      for (let i = 0; i < n; i++) {
        const p = i / n, y = -p * s * 2.1, sp = s * (0.55 - p * 0.3);
        for (let k = -1; k <= 1; k += 2) {
          ctx.save(); ctx.translate(k * sp * 0.42, y); ctx.rotate(k * 0.5);
          const g = ctx.createLinearGradient(0, 0, 0, -sp);
          g.addColorStop(0, hsl(h, 62, 40 + p * 16 + tone * 8));
          g.addColorStop(1, hsl(h + 6, 74, 62 + p * 14 + tone * 8));
          ctx.fillStyle = g; petalPath(ctx, sp, sp * 0.4, 0); ctx.fill();
          ctx.restore();
        }
      }
      return;
    }
    if (kind === 'gyp') {
      const n = 16 + ((r() * 12) | 0);
      for (let i = 0; i < n; i++) {
        const a = r() * TAU, d = s * (0.25 + r() * 0.95);
        const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.72 - s * 0.4, rr = s * (0.09 + r() * 0.07);
        ctx.fillStyle = hsl(pick(r, [40, 350, 300]), 22, 82 + tone * 10, 0.92);
        ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.beginPath(); ctx.arc(x - rr * 0.25, y - rr * 0.25, rr * 0.4, 0, TAU); ctx.fill();
      }
      return;
    }
    /* cosmos（波斯菊，默认） */
    const h = pick(r, [338, 348, 328, 8, 300]), n = 8;
    for (let i = 0; i < n; i++) {
      ctx.save(); ctx.rotate(i * TAU / n + (r() - 0.5) * 0.14);
      const l = s * (0.92 + r() * 0.22), w = s * 0.23, tx = (i % 2 ? 1 : -1) * l * 0.11;
      const g = ctx.createLinearGradient(0, 0, tx, -l);
      g.addColorStop(0, hsl(h, S1, L1)); g.addColorStop(0.5, hsl(h, S2, L2)); g.addColorStop(1, hsl(h, S3, L3));
      ctx.fillStyle = g; petalPath(ctx, l, w, tx); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.10 + tone * 0.16).toFixed(2) + ')';
      ctx.lineWidth = Math.max(0.3, s * 0.02);
      ctx.beginPath(); ctx.moveTo(0, -l * 0.2); ctx.lineTo(tx * 0.5, -l * 0.88); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = hsl(42, 78, 58 + tone * 12); ctx.beginPath(); ctx.arc(0, 0, s * 0.14, 0, TAU); ctx.fill();
    ctx.fillStyle = hsl(36, 70, 40 + tone * 8); ctx.beginPath(); ctx.arc(0, 0, s * 0.07, 0, TAU); ctx.fill();
  }

  /* ------------------------------------------------------------- 一株植物 */
  function plant(ctx, x, baseY, h, kind, s, r0, tone) {
    const r = (typeof r0 === 'function') ? r0 : mk(77001 + ((s * 977) | 0));
    ctx.save();
    ctx.translate(x, baseY); ctx.rotate((r() - 0.5) * 0.34);
    const stemL = h * 0.94;
    if (kind === 'grass') {
      for (let i = 0; i < 5 + ((r() * 4) | 0); i++) {
        const a = (i / 6 - 0.5) * 1.5 + (r() - 0.5) * 0.3, bl = h * (0.6 + r() * 0.5);
        const gg = ctx.createLinearGradient(0, 0, 0, -bl);
        gg.addColorStop(0, hsl(145, 44, 7 + tone * 7)); gg.addColorStop(1, hsl(120, 40, 16 + tone * 16));
        ctx.strokeStyle = gg; ctx.lineWidth = Math.max(0.6, bl * 0.022);
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(Math.sin(a) * bl * 0.3, -bl * 0.6, Math.sin(a) * bl * 0.62, -bl);
        ctx.stroke();
      }
      ctx.restore(); return;
    }
    const sg = ctx.createLinearGradient(0, 0, 0, -stemL);
    sg.addColorStop(0, hsl(140, 42, 8 + tone * 8)); sg.addColorStop(1, hsl(132, 40, 14 + tone * 14));
    ctx.strokeStyle = sg; ctx.lineWidth = Math.max(0.5, s * 0.075); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(stemL * 0.12, -stemL * 0.55, (r() - 0.5) * stemL * 0.16, -stemL); ctx.stroke();
    const tipX = (r() - 0.5) * stemL * 0.16, tipY = -stemL;
    for (let i = 0; i < 1 + ((r() * 2) | 0); i++) {
      const p = 0.28 + r() * 0.4, side = i % 2 ? 1 : -1, ly = -stemL * p, lx = stemL * 0.09 * p;
      ctx.save(); ctx.translate(lx, ly); ctx.rotate(side * (0.75 + r() * 0.55));
      const ll = s * (0.85 + r() * 0.5), lw = ll * 0.3;
      const lg = ctx.createLinearGradient(0, 0, 0, -ll);
      lg.addColorStop(0, hsl(142, 46, 9 + tone * 9)); lg.addColorStop(1, hsl(128, 44, 17 + tone * 15));
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(lw, -ll * 0.45, 0, -ll); ctx.quadraticCurveTo(-lw, -ll * 0.45, 0, 0);
      ctx.fill(); ctx.restore();
    }
    ctx.save(); ctx.translate(tipX, tipY); head(ctx, kind, s, r, tone); ctx.restore();
    ctx.restore();
  }

  /* -------------------------------------------------------- 花海图层（预渲染）*/
  const MIX = ['cosmos', 'cosmos', 'cosmos', 'daisy', 'poppy', 'rose', 'spike', 'gyp', 'grass', 'grass'];
  function buildLayer(o, seed) {
    const r = mk(seed);
    const pad = Math.max(80, o.W * 0.08);
    const h = Math.ceil(o.maxH * 1.5 + o.bottomPad);
    const baseY = h - o.bottomPad;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(o.W + pad * 2); cv.height = h;
    const g = cv.getContext('2d');
    const items = [];
    for (let i = 0; i < o.count; i++) {
      items.push({
        x: pad + r() * o.W,
        by: baseY + (r() - 0.5) * Math.min(o.bottomPad, o.maxH * 0.35),
        hh: o.maxH * (o.hMin + r() * (o.hMax - o.hMin)),
        kind: pick(r, o.mix || MIX),
        s: o.sizeMin + r() * (o.sizeMax - o.sizeMin),
        rng: r
      });
    }
    items.sort((a, b) => a.by - b.by || a.hh - b.hh);
    for (const it of items) plant(g, it.x, it.by, it.hh, it.kind, it.s, it.rng, o.tone);
    if (o.dark) {
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(5,24,20,' + o.dark + ')'; g.fillRect(0, 0, cv.width, h);
      g.globalCompositeOperation = 'source-over';
    }
    if (o.rim) {
      g.globalCompositeOperation = 'source-atop';
      const rg = g.createLinearGradient(0, 0, 0, h);
      rg.addColorStop(0, 'rgba(196,255,228,.30)');
      rg.addColorStop(0.6, 'rgba(150,240,205,.05)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(0, 0, cv.width, h);
      g.globalCompositeOperation = 'source-over';
    }
    return { cv: cv, w: cv.width, h: h, pad: pad, baseY: baseY, dstY: o.baseScreenY - baseY, base: o.baseScreenY, tone: o.tone };
  }
  function drawLayer(ctx, L, dx, rot, soft) {
    ctx.save();
    ctx.translate(L.w / 2 + dx, L.dstY + L.baseY);
    ctx.rotate(rot);
    ctx.translate(-L.w / 2, -(L.dstY + L.baseY));
    const ox = -L.pad, oy = L.dstY;
    if (soft) {
      const fe = Math.round(L.h * 0.22);
      const grd = ctx.createLinearGradient(0, oy, 0, oy + fe);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(0.55, 'rgba(0,0,0,.72)');
      grd.addColorStop(1, 'rgba(0,0,0,1)');
      const c = tmp(Math.max(1, L.w), Math.max(1, L.h)), c2 = c.getContext('2d');
      c2.setTransform(1, 0, 0, 1, 0, 0);
      c2.clearRect(0, 0, c.width, c.height);
      c2.drawImage(L.cv, 0, 0);
      c2.globalCompositeOperation = 'destination-in';
      c2.fillStyle = grd; c2.fillRect(0, 0, L.w, L.h);
      c2.globalCompositeOperation = 'source-over';
      ctx.drawImage(c, ox, oy);
    } else {
      ctx.drawImage(L.cv, ox, oy);
    }
    ctx.restore();
  }

  /* ------------------------------------------------- 油画草甸（静态预渲染）*/
  /* 底色渐变 + 厚涂笔触 + 色点花（远处只是色点，近处才成形） + 空气透视雾 */
  function buildMeadow(W, top, H, seed) {
    const r = mk(seed);
    const h = Math.max(40, Math.ceil(H - top));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(W)); cv.height = h;
    const g = cv.getContext('2d');
    const w = cv.width;

    /* 上边界起伏（草甸与山脚的接缝不能是直线） */
    g.save();
    g.beginPath(); g.moveTo(0, h); g.lineTo(0, 12);
    const n = 48;
    for (let i = 0; i <= n; i++) {
      const p = i / n;
      const y = 9 + Math.sin(p * 5.7 + 0.6) * 5.0 + Math.sin(p * 13.9 + 2.4) * 2.6 + Math.sin(p * 29.3 + 1.1) * 1.2;
      g.lineTo(p * w, y);
    }
    g.lineTo(w, h); g.closePath(); g.clip();

    /* 底色：远处被地平线微光擦亮（冷青），近处沉入夜色（墨松绿） */
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#2a6b58');
    bg.addColorStop(0.10, '#22604e');
    bg.addColorStop(0.30, '#1a5040');
    bg.addColorStop(0.55, '#14402f');
    bg.addColorStop(0.80, '#0e3226');
    bg.addColorStop(1, '#08201a');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);

    /* 厚涂笔触 */
    const strokes = Math.round(w * h / 320);
    g.lineCap = 'round';
    for (let i = 0; i < strokes; i++) {
      const p = Math.pow(r(), 0.68);
      const y = 6 + p * (h - 6), x = r() * w;
      const len = (5 + r() * 17) * (0.45 + p * 1.55);
      const ang = -0.66 + r() * 1.32;
      const hue = 152 + (r() - 0.5) * 22;
      const sat = 26 + r() * 32;
      const li = 9 + (1 - p) * 14 + r() * 13;
      g.strokeStyle = hsl(hue, sat, li, 0.42 + r() * 0.34);
      g.lineWidth = 1 + r() * 2.7;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len * 0.55);
      g.stroke();
      if (r() < 0.48) {
        g.strokeStyle = hsl(hue + 7, sat * 0.7, li + 15, 0.28);
        g.lineWidth = 0.8 + r() * 1.4;
        g.beginPath();
        g.moveTo(x + 1.6, y - 1.3);
        g.lineTo(x + Math.cos(ang) * len + 1.6, y + Math.sin(ang) * len * 0.55 - 1.3);
        g.stroke();
      }
    }

    /* 色点小花：远处的花海只是色点，夜色里像被星光照亮的碎光。
       指数 1.25 把色点往远处压，近处留白，画面才不糊 */
    const dots = Math.round(w * h / 205);
    for (let i = 0; i < dots; i++) {
      const p = Math.pow(r(), 1.25);
      const y = 6 + p * (h - 6), x = r() * w;
      const sz = (0.7 + r() * 1.5) * (0.45 + p * 2.4);
      const hue = pick(r, [340, 352, 8, 42, 48, 300, 286, 202, 30]);
      const sat = 22 + p * 46 + r() * 16;
      const li = 50 + p * 16 + r() * 16;
      g.fillStyle = hsl(hue, sat, li, 0.40 + p * 0.40);
      g.beginPath(); g.ellipse(x, y, sz, sz * 0.74, r() * TAU, 0, TAU); g.fill();
    }

    /* 空气透视：远处融进地平线的青绿微光里 */
    const fog = g.createLinearGradient(0, 0, 0, h * 0.34);
    fog.addColorStop(0, 'rgba(126,240,196,.26)');
    fog.addColorStop(0.45, 'rgba(110,225,180,.10)');
    fog.addColorStop(1, 'rgba(110,225,180,0)');
    g.fillStyle = fog; g.fillRect(0, 0, w, h * 0.34);

    /* 底部压暗，衔接页脚 */
    const vg = g.createLinearGradient(0, h * 0.62, 0, h);
    vg.addColorStop(0, 'rgba(2,14,12,0)');
    vg.addColorStop(1, 'rgba(2,14,12,.5)');
    g.fillStyle = vg; g.fillRect(0, h * 0.62, w, h * 0.38);

    g.restore();
    return { cv: cv, w: w, h: h, top: top };
  }

  /* ---------------------------------------------------------------- 场景 */
  const canvases = [].slice.call(document.querySelectorAll('.hero__meadow, .hero__flora'));
  if (!canvases.length) return;

  function init(canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, hor = 0, t = 0;
    let meadow = null, far = null, midA = null, midB = null;
    let bokeh = [], motes = [], petals = [];
    let fig = null, figOk = false;
    const FIG = { cx: 0, feet: 0, ph: 0, fw: 0 };

    fig = new Image();
    fig.onload = function () { figOk = true; };
    fig.src = 'assets/img/ham-painter.png';

    function resize() {
      const box = canvas.parentElement.getBoundingClientRect();
      W = Math.max(1, Math.round(box.width)); H = Math.max(1, Math.round(box.height));
      hor = H * 0.50;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    function build() {
      const seed = 20261005;
      /* 人物：坐在花海中画油画的背影 —— 居中，落在标题正下方的草甸里。
         头顶压在地平线上，文案(上收至 10u)与她在竖直方向错开。 */
      const narrow = W < 860;
      FIG.ph = H * (narrow ? 0.35 : 0.50);
      FIG.fw = FIG.ph * 1.243;                       // ham-painter.png 1268×1020
      FIG.cx = W * 0.5;
      FIG.feet = H * 0.945;

      meadow = buildMeadow(W, hor, H, seed);

      /* 远岸花带：贴着地平线，一道矮矮的花边 */
      far = buildLayer({
        W: W, baseScreenY: hor + H * 0.035, maxH: H * 0.048, bottomPad: 8,
        count: Math.max(150, Math.round(W * 0.62)),
        mix: ['cosmos', 'daisy', 'spike', 'gyp', 'grass', 'grass'],
        sizeMin: 3, sizeMax: 6.6, hMin: 0.35, hMax: 1,
        tone: 0.16, dark: 0.34, rim: true
      }, seed);
      /* 中景两层：全部压成小花（用户要"只留下小花"，前景大株不再画） */
      midA = buildLayer({
        W: W, baseScreenY: H * 0.66, maxH: H * 0.062, bottomPad: H * 0.03,
        count: Math.max(150, Math.round(W * 0.46)),
        mix: ['cosmos', 'daisy', 'spike', 'gyp', 'grass', 'grass'],
        sizeMin: 3.4, sizeMax: 6.4, hMin: 0.24, hMax: 0.7,
        tone: 0.40, dark: 0.28, rim: true
      }, seed + 11);
      midB = buildLayer({
        W: W, baseScreenY: H * 0.94, maxH: H * 0.085, bottomPad: H * 0.05,
        count: Math.max(110, Math.round(W * 0.30)),
        mix: ['cosmos', 'daisy', 'poppy', 'rose', 'gyp', 'grass'],
        sizeMin: 5, sizeMax: 9, hMin: 0.26, hMax: 0.85,
        tone: 0.70, dark: 0.10, rim: true
      }, seed + 23);

      const r = mk(seed + 37);

      /* 焦外光斑（青绿 / 暖粉） */
      bokeh = [];
      for (let i = 0; i < 24; i++) {
        bokeh.push({
          x: r() * W, y: H * (0.44 + r() * 0.44), rr: 5 + r() * 22,
          a: 0.04 + r() * 0.10, ph: r() * TAU, warm: r() > 0.5
        });
      }
      /* 上升的花粉 / 微尘 */
      motes = [];
      for (let i = 0; i < 42; i++) {
        motes.push({
          x: r() * W, y: H * (0.34 + r() * 0.66), rr: 0.6 + r() * 1.7,
          vy: -(0.05 + r() * 0.20), vx: (r() - 0.5) * 0.16,
          a: 0.14 + r() * 0.36, ph: r() * TAU
        });
      }
      /* 飘落花瓣 */
      petals = [];
      for (let i = 0; i < 16; i++) {
        petals.push({
          x: r() * W, y: H * (0.36 + r() * 0.64), vy: 0.06 + r() * 0.22, vx: (r() - 0.5) * 0.34,
          rot: r() * TAU, vr: (r() - 0.5) * 0.03, s: 2.4 + r() * 3.2,
          h: pick(r, [340, 352, 300, 44])
        });
      }
    }

    function drawFigure() {
      if (!figOk) return;
      const fw = FIG.fw, ph = FIG.ph, cx = FIG.cx, feet = FIG.feet, fy = feet - ph;
      const bob = reduce ? 0 : Math.sin(t * 0.5) * H * 0.0032;
      const sway = reduce ? 0 : Math.sin(t * 0.32) * 0.0035;

      /* 落在草甸上的接触阴影 */
      ctx.save();
      const sg = ctx.createRadialGradient(cx, feet, 0, cx, feet, fw * 0.52);
      sg.addColorStop(0, 'rgba(58,40,28,.42)');
      sg.addColorStop(0.6, 'rgba(58,40,28,.16)');
      sg.addColorStop(1, 'rgba(58,40,28,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.ellipse(cx, feet + ph * 0.015, fw * 0.48, ph * 0.042, 0, 0, TAU); ctx.fill();
      ctx.restore();

      /* 星球清辉包裹（青绿 + 玫瑰），弱化抠图边界 */
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const hg = ctx.createRadialGradient(cx, fy + ph * 0.42, 0, cx, fy + ph * 0.42, fw * 1.02);
      hg.addColorStop(0, 'rgba(160,250,220,.18)');
      hg.addColorStop(0.45, 'rgba(246,184,200,.08)');
      hg.addColorStop(1, 'rgba(246,184,200,0)');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.ellipse(cx, fy + ph * 0.42, fw * 1.02, ph * 0.70, 0, 0, TAU); ctx.fill();
      ctx.restore();

      ctx.save();
      for (let k = 0; k < 3; k++) {
        const sp = 1 + (k + 1) * 0.020;
        ctx.globalAlpha = 0.13 - k * 0.038;
        ctx.drawImage(fig, cx - fw * sp / 2, fy + ph / 2 + bob - ph * sp / 2, fw * sp, ph * sp);
      }
      ctx.restore();

      ctx.save();
      ctx.translate(cx, fy + ph / 2 + bob);
      ctx.rotate(sway);
      ctx.drawImage(fig, -fw / 2, -ph / 2, fw, ph);
      ctx.restore();
    }

    function frame() {
      t += 0.016;
      ctx.clearRect(0, 0, W, H);

      /* 草甸（静态预渲染，整层一次贴出） */
      if (meadow) ctx.drawImage(meadow.cv, 0, meadow.top);

      /* 花海：摆动只做极小幅平移 + 极轻微旋转。
         整层旋转在宽屏下端点位移过大 = 视觉"抽搐"，这里全部压到亚像素级。 */
      const br = reduce ? 0 : Math.sin(t * 0.10);
      const s1 = reduce ? 0 : Math.sin(t * 0.12);
      const s2 = reduce ? 0 : Math.sin(t * 0.09 + 1.2);

      drawLayer(ctx, far, br * 0.6, br * 0.00015, 1);
      drawLayer(ctx, midA, s1 * 1.2, s1 * 0.00025, 0);

      /* 背影：坐在花海中画油画（居中，标题正下方） */
      drawFigure();

      /* 脚边那一圈小花压在她身前 —— "坐在花海里"的包裹感 */
      drawLayer(ctx, midB, s2 * 1.8, s2 * 0.00035, 1);

      /* 焦外光斑 */
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const b of bokeh) {
        const y = b.y + (reduce ? 0 : Math.sin(t * 0.34 + b.ph) * 4);
        const a = b.a * (0.62 + 0.38 * Math.sin(t * 0.55 + b.ph));
        const g = ctx.createRadialGradient(b.x, y, 0, b.x, y, b.rr);
        g.addColorStop(0, b.warm ? 'rgba(255,226,186,' + a.toFixed(3) + ')' : 'rgba(255,214,232,' + a.toFixed(3) + ')');
        g.addColorStop(0.7, b.warm ? 'rgba(255,206,150,' + (a * 0.4).toFixed(3) + ')' : 'rgba(255,190,220,' + (a * 0.4).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(255,200,220,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, y, b.rr, 0, TAU); ctx.fill();
      }
      ctx.restore();

      /* 飘落花瓣 */
      for (const p of petals) {
        p.y += p.vy; p.x += p.vx + (reduce ? 0 : Math.sin(t * 0.6 + p.rot) * 0.24); p.rot += p.vr;
        if (p.y > H + 8) { p.y = H * 0.30; p.x = Math.random() * W; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = hsl(p.h, 62, 84, 0.7);
        ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }

      /* 上升花粉 / 微尘 */
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const m of motes) {
        m.y += m.vy; m.x += m.vx + (reduce ? 0 : Math.sin(t * 0.55 + m.ph) * 0.16);
        if (m.y < -10) { m.y = H * 0.98; m.x = Math.random() * W; }
        ctx.globalAlpha = m.a * (0.55 + 0.45 * Math.sin(t * 1.0 + m.ph));
        ctx.fillStyle = 'rgba(255,238,206,1)';
        ctx.beginPath(); ctx.arc(m.x, m.y, m.rr, 0, TAU); ctx.fill();
      }
      ctx.restore();

      if (!reduce) requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    frame();
  }

  canvases.forEach(init);
})();
