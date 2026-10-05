/* garden.js —— 花园引擎（纯 Canvas 2D，零依赖、零贴图）
   装配：.hero__flora / .hero__meadow  首页
     · 远岸花海 + 湖面倒影与涟漪 + 中景小花
     · 居中坐在花海里画油画的背影（正对上方那颗大星球，脚下被花海盖住）
     · 飘落花瓣 / 上升花粉 / 焦外光斑
   天空（星云 / 极光 / 轨道环 / 大星球 / 丘陵 / 湖面倒影）由 index.html 的 SVG 负责。
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
  /* 花头：tone 0 远 → 1 近（空气透视：越远越暗越灰） */
  function head(ctx, kind, s, r, tone) {
    const L1 = (0.42 + tone * 0.20) * 100, L2 = (0.62 + tone * 0.16) * 100, L3 = (0.86 + tone * 0.08) * 100;
    const S1 = (0.45 + tone * 0.30) * 100, S2 = (0.60 + tone * 0.28) * 100, S3 = (0.74 + tone * 0.22) * 100;
    if (kind === 'daisy') {
      const n = 13 + ((r() * 4) | 0), h = pick(r, [46, 40, 350]);
      for (let i = 0; i < n; i++) {
        ctx.save(); ctx.rotate(i * TAU / n + (r() - 0.5) * 0.2);
        const l = s * (0.85 + r() * 0.3), w = s * 0.105;
        const g = ctx.createLinearGradient(0, 0, 0, -l);
        g.addColorStop(0, hsl(h, 20, L1 * 0.92)); g.addColorStop(1, hsl(h, 12, Math.min(97, L3 + 3)));
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
      const h = pick(r, [6, 350, 24, 340]), n = 4 + ((r() * 2) | 0);
      for (let i = 0; i < n; i++) {
        ctx.save(); ctx.rotate(i * TAU / n + (r() - 0.5) * 0.3);
        const l = s * (0.9 + r() * 0.25), w = s * 0.62;
        const g = ctx.createLinearGradient(0, 0, 0, -l);
        g.addColorStop(0, hsl(h, S1 + 10, L1 * 0.82));
        g.addColorStop(0.45, hsl(h, S2 + 8, L2)); g.addColorStop(1, hsl(h + 6, S3, L3));
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
          g.addColorStop(0, hsl(h, S1, (L1 / 100 + k * 0.05) * 92));
          g.addColorStop(0.6, hsl(h + 2, S2, (L2 / 100 + k * 0.055) * 100));
          g.addColorStop(1, hsl(h + 4, S3, Math.min(96, L3 + k * 4)));
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
    /* Space Voyage 的"电影感"：预渲染一张模糊 + 提亮的光晕副本。
       每帧只是多一次 drawImage，不做实时 blur —— 运行时零开销。
       配色完全沿用花海本身的色相，只是把光"散"开来。 */
    let glow = null;
    if (o.glow) {
      const px = o.glowBlur || 7;
      const b = document.createElement('canvas');
      b.width = cv.width; b.height = cv.height;
      const bx = b.getContext('2d');
      bx.filter = 'blur(' + px + 'px)';
      bx.drawImage(cv, 0, 0);
      bx.filter = 'none';
      const gc = document.createElement('canvas');
      gc.width = cv.width; gc.height = cv.height;
      const g2 = gc.getContext('2d');
      g2.drawImage(b, 0, 0);
      g2.globalCompositeOperation = 'lighter';   // 自叠加把亮度顶上去
      g2.globalAlpha = 0.9;
      g2.drawImage(b, 0, 0);
      glow = gc;
    }
    return { cv: cv, glow: glow, glowA: o.glow == null ? 0 : o.glow,
             w: cv.width, h: h, pad: pad, baseY: baseY,
             dstY: o.baseScreenY - baseY, base: o.baseScreenY };
  }
  function drawLayer(ctx, L, dx, rot, soft) {
    ctx.save();
    ctx.translate(L.w / 2 + dx, L.dstY + L.baseY);
    ctx.rotate(rot);
    ctx.translate(-L.w / 2, -(L.dstY + L.baseY));
    const ox = -L.pad, oy = L.dstY;
    /* 先铺一层柔光（lighter），再压清晰层 —— 花就有"发光"的质感 */
    if (L.glow) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = L.glowA;
      ctx.drawImage(L.glow, ox, oy);
      ctx.restore();
    }
    if (soft) {
      /* 注意：渐变必须建在临时画布 c2 的坐标系里（从 y=0 起）。
         若沿用目标画布的 oy（几百 px），渐变整体落在画布之外，
         destination-in 会把整层抹成全透明 —— 花海"看不见"就是这么来的。 */
      const fe = Math.round(L.h * 0.22);
      const c = tmp(Math.max(1, L.w), Math.max(1, L.h)), c2 = c.getContext('2d');
      c2.setTransform(1, 0, 0, 1, 0, 0);
      c2.clearRect(0, 0, c.width, c.height);
      c2.drawImage(L.cv, 0, 0);
      const grd = c2.createLinearGradient(0, 0, 0, fe);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(0.55, 'rgba(0,0,0,.72)');
      grd.addColorStop(1, 'rgba(0,0,0,1)');
      c2.globalCompositeOperation = 'destination-in';
      c2.fillStyle = grd; c2.fillRect(0, 0, L.w, L.h);
      c2.globalCompositeOperation = 'source-over';
      ctx.drawImage(c, ox, oy);
    } else {
      ctx.drawImage(L.cv, ox, oy);
    }
    ctx.restore();
  }

  /* ---------------------------------------------------------------- 水面 */
  function rippleSet() {
    const list = [];
    return {
      spawn(x, y, r0, vr, a, life) { if (list.length < 70) list.push({ x, y, r: r0, vr, a, life: 0, max: life }); },
      step(dt) { for (let i = list.length - 1; i >= 0; i--) { const p = list[i]; p.life += dt; p.r += p.vr * dt; if (p.life > p.max) list.splice(i, 1); } },
      draw(ctx, k) {
        for (const p of list) {
          const t = p.life / p.max, a = p.a * (1 - t) * (1 - t);
          if (a <= 0.004) continue;
          const lw = Math.max(0.6, 1.5 * (1 - t) + 0.35);
          ctx.save();
          ctx.lineWidth = lw;
          /* 深色描边打底 + 亮色叠画 → 无论水底明暗都能读出涟漪 */
          for (let pass = 0; pass < 2; pass++) {
            ctx.globalAlpha = pass ? a : a * 0.42;
            ctx.strokeStyle = pass ? 'rgba(216,255,242,1)' : 'rgba(4,26,22,1)';
            ctx.lineWidth = pass ? lw : lw + 1.1;
            ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * k, 0, 0, TAU); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * 0.58, p.r * 0.58 * k, 0, 0, TAU); ctx.stroke();
          }
          ctx.restore();
        }
      }
    };
  }
  function shimmer(ctx, W, yTop, yBot, t, n) {
    const r = mk(9173);
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const p = r(), y = yTop + p * (yBot - yTop), len = W * (0.04 + r() * 0.16), x = r() * W;
      const ph = t * (0.5 + r() * 0.9) + i;
      ctx.globalAlpha = (0.05 + 0.14 * (0.5 + 0.5 * Math.sin(ph))) * (1 - p * 0.5);
      ctx.strokeStyle = 'rgba(198,248,224,1)';
      ctx.lineWidth = 0.7 + r() * 0.9;
      const off = Math.sin(ph * 0.7) * W * 0.02;
      ctx.beginPath(); ctx.moveTo(x + off, y); ctx.lineTo(x + off + len, y); ctx.stroke();
    }
    ctx.restore();
  }
  /* 镜像倒影：逐行切片 + 波动 + 渐隐 */
  function mirror(ctx, src, dx, dy, dw, dh, alpha, t, amp, fade) {
    const sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight;
    const rows = Math.max(10, Math.round(dh / 3)), rh = dh / rows;
    for (let i = 0; i < rows; i++) {
      const p = i / rows;
      const off = reduce ? 0 : Math.sin(t * 1.5 + p * 8.5) * amp * (0.35 + p * 0.9);
      let a = alpha * (fade ? 1 - p * 0.92 : 1);
      if (!reduce && p > 0.02) a *= 0.55 + 0.45 * Math.sin(t * 2.2 + p * 22);
      if (a <= 0.008) continue;
      ctx.globalAlpha = a;
      ctx.drawImage(src, 0, sh * (1 - (i + 1) / rows), sw, sh / rows, dx + off, dy + i * rh, dw, rh + 0.7);
    }
  }

  /* ---------------------------------------------------------------- 场景 */
  const canvases = [].slice.call(document.querySelectorAll('.hero__meadow, .hero__flora'));
  if (!canvases.length) return;
  const ptr = { x: -1, y: -1 };
  window.addEventListener('mousemove', function (e) { ptr.x = e.clientX; ptr.y = e.clientY; }, { passive: true });

  function init(canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, hor = 0, t = 0;
    let far = null, midA = null, midB = null, midC = null;
    let bokeh = [], motes = [], petals = [];
    /* 就一个人物：坐在花海里画画的背影，居中、正对上方那颗大星球 */
    let figA = null, okA = false;
    const FA = { cx: 0, feet: 0, ph: 0, fw: 0 };
    const rip = rippleSet();

    figA = new Image();
    figA.onload = function () { okA = true; };
    figA.src = 'assets/img/ham-painter.png';          // 1268×1020 → 宽高比 1.243

    function resize() {
      const box = canvas.parentElement.getBoundingClientRect();
      W = Math.max(1, Math.round(box.width)); H = Math.max(1, Math.round(box.height));
      hor = H * 0.5;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    function build() {
      const seed = 20261004;
      /* 人物：坐在花海中画油画的背影 —— 居中、正对上方那颗大星球、尽量往下放。
         头顶压在地平线附近，与上方文案(已上收至 10u)错开 */
      /* 人物：居中，头顶压在地平线附近，与上方文案错开 */
      const narrow = W < 860;
      FA.ph = H * (narrow ? 0.34 : 0.44);
      FA.fw = FA.ph * 1.243;                         // ham-painter.png 1268×1020
      FA.cx = W * 0.5;
      FA.feet = H * 0.945;

      /* 花海调成 Space Voyage 的调子：花朵变少、变大，每一层都带一层柔光（glow）。
         越靠近镜头 glow 越散（glowBlur 更大）= 景深，颜色一律沿用原来的色相。 */

      /* 远岸花海：贴着地平线的一道矮花边，逆光剪影 */
      far = buildLayer({
        W: W, baseScreenY: hor - H * 0.008, maxH: H * 0.05, bottomPad: 10,
        count: Math.max(110, Math.round(W * 0.40)),
        mix: ['cosmos', 'daisy', 'spike', 'gyp', 'grass', 'grass'],
        sizeMin: 4.2, sizeMax: 8.2, hMin: 0.35, hMax: 1,
        tone: 0.18, dark: 0.4, rim: true,
        glow: 0.30, glowBlur: 6
      }, seed);
      /* 中景：全部是小花（前景大株不再画） */
      midA = buildLayer({
        W: W, baseScreenY: H * 0.74, maxH: H * 0.065, bottomPad: H * 0.04,
        count: Math.max(110, Math.round(W * 0.28)),
        mix: ['cosmos', 'daisy', 'spike', 'gyp', 'grass', 'grass'],
        sizeMin: 4.8, sizeMax: 9.0, hMin: 0.24, hMax: 0.7,
        tone: 0.42, dark: 0.26, rim: true,
        glow: 0.42, glowBlur: 8
      }, seed + 11);
      /* 脚边那一层：漫过她脚踝，把身下的土地全部吃掉。
         baseScreenY + bottomPad = H → 图层底边正好压到页面最底，下方不留空地 */
      midB = buildLayer({
        W: W, baseScreenY: H * 0.90, maxH: H * 0.14, bottomPad: H * 0.10,
        count: Math.max(120, Math.round(W * 0.34)),
        mix: ['cosmos', 'cosmos', 'daisy', 'poppy', 'rose', 'gyp', 'grass'],
        sizeMin: 7.5, sizeMax: 14, hMin: 0.30, hMax: 1.0,
        tone: 0.82, dark: 0.05, rim: true,
        glow: 0.50, glowBlur: 10
      }, seed + 23);
      /* 最贴近镜头的一层矮花毯：基线压到页面底边之外，
         把 850px 以下（她脚边、画面最底）彻底铺满，不给土地留缝 */
      midC = buildLayer({
        W: W, baseScreenY: H * 1.01, maxH: H * 0.115, bottomPad: H * 0.075,
        count: Math.max(110, Math.round(W * 0.32)),
        mix: ['cosmos', 'daisy', 'poppy', 'rose', 'gyp', 'grass'],
        sizeMin: 8, sizeMax: 15, hMin: 0.34, hMax: 1.0,
        tone: 0.88, dark: 0.02, rim: true,
        glow: 0.58, glowBlur: 13
      }, seed + 41);

      const r = mk(seed + 37);
      bokeh = [];
      for (let i = 0; i < 34; i++) {
        bokeh.push({ x: r() * W, y: H * (0.52 + r() * 0.36), rr: 7 + r() * 27, a: 0.05 + r() * 0.13, ph: r() * TAU, warm: r() > 0.5 });
      }
      motes = [];
      for (let i = 0; i < 72; i++) {
        motes.push({ x: r() * W, y: H * (0.3 + r() * 0.7), rr: 0.7 + r() * 2.1, vy: -(0.05 + r() * 0.2), vx: (r() - 0.5) * 0.16, a: 0.16 + r() * 0.46, ph: r() * TAU });
      }
      petals = [];
      for (let i = 0; i < 18; i++) {
        petals.push({ x: r() * W, y: H * (0.4 + r() * 0.6), vy: 0.06 + r() * 0.24, vx: (r() - 0.5) * 0.34, rot: r() * TAU, vr: (r() - 0.5) * 0.03, s: 2.4 + r() * 3.4, h: pick(r, [340, 352, 300, 42]) });
      }
      /* 预置一批涟漪，错开生成时间避免同相位 */
      for (let i = 0; i < 18; i++) {
        rip.spawn(r() * W, hor + 9 + r() * (H * 0.20), 3, 6 + r() * 10, 0.2 + r() * 0.14, 3 + r() * 3);
      }
    }

    /* dir: +1 原向 / -1 水平镜像；phase 让两人的呼吸错开，镜像感靠 dir 反向摇摆保证 */
    function drawOne(img, F, dir, phase) {
      const fw = F.fw, ph = F.ph, cx = F.cx, feet = F.feet, fy = feet - ph;
      const bob = reduce ? 0 : Math.sin(t * 0.5 + phase) * H * 0.0032;
      const sway = reduce ? 0 : Math.sin(t * 0.32 + phase) * 0.0035 * dir;

      /* 落在花丛里的接触阴影 */
      ctx.save();
      const sg = ctx.createRadialGradient(cx, feet, 0, cx, feet, fw * 0.5);
      sg.addColorStop(0, 'rgba(3,18,14,.5)');
      sg.addColorStop(0.6, 'rgba(3,18,14,.18)');
      sg.addColorStop(1, 'rgba(3,18,14,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.ellipse(cx, feet + ph * 0.012, fw * 0.46, ph * 0.04, 0, 0, TAU); ctx.fill();
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

      /* 三层极淡描边，柔化边缘 */
      ctx.save();
      for (let k = 0; k < 3; k++) {
        const sp = 1 + (k + 1) * 0.020;
        ctx.globalAlpha = 0.13 - k * 0.038;
        ctx.drawImage(img, cx - fw * sp / 2, fy + ph / 2 + bob - ph * sp / 2, fw * sp, ph * sp);
      }
      ctx.restore();

      ctx.save();
      ctx.translate(cx, fy + ph / 2 + bob);
      ctx.rotate(sway);
      ctx.scale(dir, 1);                    // ← 镜像就靠这一行
      ctx.drawImage(img, -fw / 2, -ph / 2, fw, ph);
      ctx.restore();
    }

    function drawFigure() {
      if (okA) drawOne(figA, FA, +1, 0);
      /* 开发期量测用：读人物的实际落位 */
      window.__figs = function () {
        return { A: { cx: FA.cx, feet: FA.feet, ph: FA.ph, fw: FA.fw, ok: okA }, W: W, H: H };
      };
    }

    function frame() {
      t += 0.016;
      ctx.clearRect(0, 0, W, H);

      /* 花海摆动：只做极小幅平移 + 亚像素级旋转。
         整层旋转在宽屏下端点位移过大 = 视觉"抽搐"，这里全部压住。 */
      const br = reduce ? 0 : Math.sin(t * 0.10);
      const s1 = reduce ? 0 : Math.sin(t * 0.12);
      const s2 = reduce ? 0 : Math.sin(t * 0.09 + 1.2);

      /* 远岸花海 + 水中倒影 */
      drawLayer(ctx, far, br * 0.6, br * 0.00015, 1);

      /* 地平线大气：一条贴着 hor 的柔光带，让远景"退"进去 —— 电影景深靠这层。
         色相沿用站点青绿，只加光不加别的颜色。 */
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const hz = ctx.createLinearGradient(0, hor - H * 0.12, 0, hor + H * 0.12);
      hz.addColorStop(0, 'rgba(90,220,180,0)');
      hz.addColorStop(0.42, 'rgba(120,235,195,.085)');
      hz.addColorStop(0.5, 'rgba(158,244,214,.12)');
      hz.addColorStop(0.58, 'rgba(120,235,195,.085)');
      hz.addColorStop(1, 'rgba(90,220,180,0)');
      ctx.fillStyle = hz;
      ctx.fillRect(0, hor - H * 0.12, W, H * 0.24);
      ctx.restore();
      ctx.save();
      ctx.beginPath(); ctx.rect(0, hor, W, H * 0.5); ctx.clip();
      ctx.globalAlpha = 1;
      mirror(ctx, far.cv, -far.pad, hor + 2, W + 2 * far.pad, H * 0.085, 0.3, t, 4.5, true);
      ctx.restore();

      /* 水面：先垫一层薄暗，亮色涟漪环才有对比可读 */
      const wg = ctx.createLinearGradient(0, hor, 0, hor + H * 0.28);
      wg.addColorStop(0, 'rgba(3,14,18,.42)');
      wg.addColorStop(0.55, 'rgba(3,14,18,.26)');
      wg.addColorStop(1, 'rgba(3,14,18,0)');
      ctx.fillStyle = wg; ctx.fillRect(0, hor, W, H * 0.28);

      shimmer(ctx, W, hor + 8, hor + H * 0.26, t, Math.round(W / 22));
      rip.draw(ctx, 0.28);
      if (!reduce) {
        rip.step(1);
        if (Math.random() < 0.09) {
          const r = mk((t * 1000) | 0);
          rip.spawn(r() * W, hor + 9 + r() * H * 0.20, 2, 7 + r() * 11, 0.18 + r() * 0.14, 3.2 + r() * 3);
        }
      }

      /* 焦外光斑 */
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const b of bokeh) {
        const y = b.y + (reduce ? 0 : Math.sin(t * 0.35 + b.ph) * 4);
        const a = b.a * (0.62 + 0.38 * Math.sin(t * 0.55 + b.ph));
        const g = ctx.createRadialGradient(b.x, y, 0, b.x, y, b.rr);
        g.addColorStop(0, b.warm ? 'rgba(255,226,186,' + a.toFixed(3) + ')' : 'rgba(255,214,232,' + a.toFixed(3) + ')');
        g.addColorStop(0.7, b.warm ? 'rgba(255,206,150,' + (a * 0.4).toFixed(3) + ')' : 'rgba(255,190,220,' + (a * 0.4).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(255,200,220,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, y, b.rr, 0, TAU); ctx.fill();
      }
      ctx.restore();

      /* 中景小花 */
      drawLayer(ctx, midA, s1 * 1.2, s1 * 0.00025, 1);

      /* 背影：坐在花海中画油画（居中，大星球正下方） */
      drawFigure();

      /* 花床底色：先把人物身下那块"不搭配的土地"换成暗绿花甸，再压上花海 */
      const bd = ctx.createLinearGradient(0, H * 0.78, 0, H);
      bd.addColorStop(0, 'rgba(7,28,20,0)');
      bd.addColorStop(0.42, 'rgba(7,28,20,.62)');
      bd.addColorStop(1, 'rgba(5,20,16,.88)');
      ctx.fillStyle = bd; ctx.fillRect(0, H * 0.78, W, H * 0.22);

      /* 脚边花海：漫过她脚踝，把身下的土地全部盖住 */
      drawLayer(ctx, midB, s2 * 1.8, s2 * 0.00035, 1);
      drawLayer(ctx, midC, s2 * 2.4, s2 * 0.00040, 1);

      /* 飘落花瓣 */
      for (const p of petals) {
        p.y += p.vy; p.x += p.vx + (reduce ? 0 : Math.sin(t * 0.6 + p.rot) * 0.24); p.rot += p.vr;
        if (p.y > H + 8) { p.y = H * 0.30; p.x = Math.random() * W; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = hsl(p.h, 62, 84, 0.7);
        ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }

      /* 上升花粉 */
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

    window.addEventListener('mousemove', function () {
      const b = canvas.getBoundingClientRect();
      if (b.bottom < 0 || b.top > window.innerHeight) return;
      const y = ptr.y - b.top, x = ptr.x - b.left;
      if (y > hor && y < b.height && x > 0 && x < b.width && Math.random() < 0.3) {
        rip.spawn(x, y, 2, 7, 0.18, 3);
      }
    }, { passive: true });

    resize();
    window.addEventListener('resize', resize);
    frame();
  }

  canvases.forEach(init);
})();
