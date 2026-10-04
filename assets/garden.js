/* garden.js —— 花园引擎（纯 Canvas 2D，零依赖、零贴图）
   装配（按 class 自动识别）：
     .hero__flora   首页：远岸花海 + 湖面倒影涟漪 + 近景花海 + 焦外光斑
     .stage__scene  形象舞台：程序化星球（流光/星芒/脉冲）+ 花海 + 湖面 + 人物与水中倒影
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
  /* 花头：tone 0 远 → 1 近，控制明度/饱和，制造空气透视 */
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

  /* 一株植物：茎 → 叶 → 花头 */
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
  /* 花海图层（预渲染成离屏 canvas，动画时整层便宜地绘制）
     o: {W, baseScreenY, maxH, bottomPad, count, sizeMin/Max, hMin/hMax, tone, dark, rim, mix} */
  function buildLayer(o, seed) {
    const r = mk(seed);
    const pad = Math.max(80, o.W * 0.08);
    const h = Math.ceil(o.maxH * 1.5 + o.bottomPad);   // 顶部留 50% 高度余量，最大株的顶也不被裁
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
    return { cv: cv, w: cv.width, h: h, pad: pad, baseY: baseY, dstY: o.baseScreenY - baseY, base: o.baseScreenY, blur: o.blur, tone: o.tone };
  }
  /* 绘制一层：dstY 定基线，dx/rot 做整层微风摆动，soft 从 0 淡入顶边避免硬切 */
  function drawLayer(ctx, L, dx, rot, soft) {
    ctx.save();
    ctx.translate(L.w / 2 + dx, L.dstY + L.baseY);
    ctx.rotate(rot);
    ctx.translate(-L.w / 2, -(L.dstY + L.baseY));
    const ox = -L.pad, oy = L.dstY;
    if (soft) {
      /* 沿竖直方向做遮罩：顶部 22% 渐隐，消除图层顶边直线 */
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

  /* ------------------------------------------------- 程序化星球（舞台）*/
  function star4(ctx, x, y, s, a) {
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.quadraticCurveTo(s * 0.14, -s * 0.14, s, 0);
    ctx.quadraticCurveTo(s * 0.14, s * 0.14, 0, s);
    ctx.quadraticCurveTo(-s * 0.14, s * 0.14, -s, 0);
    ctx.quadraticCurveTo(-s * 0.14, -s * 0.14, 0, -s);
    ctx.fillStyle = 'rgba(255,255,255,1)'; ctx.fill();
    ctx.globalAlpha = a * 0.35;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.36, 0, TAU);
    ctx.fillStyle = 'rgba(210,255,236,1)'; ctx.fill();
    ctx.restore();
  }
  function drawPlanet(ctx, cx, cy, R, t) {
    const r = mk(4242);
    /* 脉冲光环（闪耀） */
    for (let k = 0; k < 3; k++) {
      const p = reduce ? k / 3 : ((t * 0.14 + k / 3) % 1);
      const rr = R * (1.05 + p * 0.62), a = 0.34 * (1 - p) * (1 - p);
      const g = ctx.createRadialGradient(cx, cy, rr * 0.9, cx, cy, rr);
      g.addColorStop(0, 'rgba(126,240,196,0)');
      g.addColorStop(0.55, 'rgba(126,240,196,' + a.toFixed(3) + ')');
      g.addColorStop(1, 'rgba(246,184,200,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.fill();
    }
    /* 后环 */
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.22); ctx.scale(1, 0.27);
    ctx.beginPath(); ctx.arc(0, 0, R * 1.78, 0, TAU);
    ctx.strokeStyle = 'rgba(190,250,224,.16)'; ctx.lineWidth = R * 0.10; ctx.stroke();
    ctx.restore();
    /* 大气辉光 */
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gg = ctx.createRadialGradient(cx, cy, R * 0.88, cx, cy, R * 1.55);
    gg.addColorStop(0, 'rgba(140,250,208,.42)');
    gg.addColorStop(0.42, 'rgba(90,200,170,.13)');
    gg.addColorStop(1, 'rgba(90,200,170,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(cx, cy, R * 1.55, 0, TAU); ctx.fill();
    ctx.restore();
    /* 星球本体 */
    const pg = ctx.createRadialGradient(cx - R * 0.34, cy - R * 0.36, R * 0.06, cx, cy, R * 1.06);
    pg.addColorStop(0, '#9df3cd'); pg.addColorStop(0.3, '#3fc094');
    pg.addColorStop(0.66, '#16634c'); pg.addColorStop(1, '#05170f');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    /* 陆块纹理 */
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    for (let i = 0; i < 5; i++) {
      const a = r() * TAU, d = r() * R * 0.7;
      ctx.globalAlpha = 0.10 + r() * 0.16;
      ctx.fillStyle = i % 2 ? '#7fe8bd' : '#0c4636';
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * (0.18 + r() * 0.3), R * (0.09 + r() * 0.16), r() * TAU, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.restore();
    /* 明暗界线（右下压暗） */
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    const tg = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    tg.addColorStop(0, 'rgba(2,8,14,0)'); tg.addColorStop(0.46, 'rgba(2,8,14,.16)'); tg.addColorStop(1, 'rgba(2,8,14,.9)');
    ctx.fillStyle = tg; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.restore();
    /* 镜面高光 */
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const sp = ctx.createRadialGradient(cx - R * 0.42, cy - R * 0.48, 0, cx - R * 0.42, cy - R * 0.48, R * 0.5);
    const sa = reduce ? 0.26 : 0.20 + 0.12 * Math.sin(t * 1.1);
    sp.addColorStop(0, 'rgba(255,255,255,' + sa.toFixed(3) + ')');
    sp.addColorStop(0.5, 'rgba(210,255,238,.10)');
    sp.addColorStop(1, 'rgba(210,255,238,0)');
    ctx.fillStyle = sp; ctx.beginPath(); ctx.arc(cx - R * 0.42, cy - R * 0.48, R * 0.5, 0, TAU); ctx.fill();
    ctx.restore();
    /* 边缘光 */
    ctx.strokeStyle = 'rgba(196,255,228,.55)'; ctx.lineWidth = Math.max(1, R * 0.012);
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.998, 0, TAU); ctx.stroke();
    /* 前环（遮挡关系正确） */
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.22); ctx.scale(1, 0.27);
    ctx.beginPath(); ctx.arc(0, 0, R * 1.78, 0, Math.PI);
    ctx.strokeStyle = 'rgba(200,255,232,.30)'; ctx.lineWidth = R * 0.10; ctx.stroke();
    ctx.restore();
    /* 流光丝带（Creative Matter） */
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    for (let k = 0; k < 2; k++) {
      const ph = reduce ? 0 : t * (0.5 + k * 0.32);
      const rg = ctx.createLinearGradient(cx - R, cy, cx + R, cy);
      rg.addColorStop(0, 'rgba(255,214,232,0)');
      rg.addColorStop(0.35, k ? 'rgba(160,250,214,.5)' : 'rgba(255,196,220,.55)');
      rg.addColorStop(0.7, k ? 'rgba(255,214,236,.35)' : 'rgba(180,255,226,.42)');
      rg.addColorStop(1, 'rgba(255,214,232,0)');
      ctx.strokeStyle = rg; ctx.lineWidth = R * (0.1 - k * 0.03);
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const u = i / 40, a = u * Math.PI * 2 + ph;
        const rr = R * (0.42 + 0.5 * Math.abs(Math.sin(u * Math.PI * 1.5 + k)));
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.72;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
    /* 星芒闪烁 */
    for (let i = 0; i < 7; i++) {
      const a = r() * TAU, d = R * (0.55 + r() * 0.75);
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.85;
      const tw = reduce ? 0.6 : 0.5 + 0.5 * Math.sin(t * (1.1 + r() * 1.6) + i * 2.1);
      star4(ctx, x, y, R * (0.05 + r() * 0.07) * (0.6 + tw * 0.7), 0.35 + tw * 0.5);
    }
  }

  /* ---------------------------------------------------------------- 场景 */
  const canvases = [].slice.call(document.querySelectorAll('.hero__flora, .stage__scene'));
  if (!canvases.length) return;
  const ptr = { x: -1, y: -1 };
  window.addEventListener('mousemove', function (e) { ptr.x = e.clientX; ptr.y = e.clientY; }, { passive: true });

  function init(canvas) {
    const isStage = canvas.classList.contains('stage__scene');
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, hor = 0, t = 0;
    let far = null, midA = null, midB = null, nearP = [], motes = [], bokeh = [], petals = [], fig = null, figOk = false;
    const rip = rippleSet();

    if (isStage) {
      fig = new Image();
      fig.onload = function () { figOk = true; };
      fig.src = 'assets/img/ham-fairy.png';
    }

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
      /* 远岸花海：基线略高于地平线，逆光剪影 */
      far = buildLayer({
        W: W, baseScreenY: hor - H * 0.008, maxH: H * 0.05, bottomPad: 10,
        count: Math.max(140, Math.round(W * 0.62)),
        mix: ['cosmos', 'daisy', 'spike', 'gyp', 'grass', 'grass'],
        sizeMin: 3, sizeMax: 6.4, hMin: 0.35, hMax: 1,
        tone: 0.18, dark: 0.4, rim: true, blur: 1
      }, seed);
      /* 近景花海：两个预渲染层（中景 + 最外一层） */
      midA = buildLayer({
        W: W, baseScreenY: H * 0.76, maxH: H * 0.16, bottomPad: H * 0.05,
        count: Math.max(130, Math.round(W * 0.4)),
        mix: ['cosmos', 'daisy', 'spike', 'poppy', 'gyp', 'grass'],
        sizeMin: 4.5, sizeMax: 10, hMin: 0.22, hMax: 0.62,
        tone: 0.48, dark: 0.26, rim: true, blur: 1
      }, seed + 11);
      midB = buildLayer({
        W: W, baseScreenY: H * 0.88, maxH: H * 0.26, bottomPad: H * 0.06,
        count: Math.max(110, Math.round(W * 0.32)),
        mix: ['cosmos', 'cosmos', 'daisy', 'poppy', 'rose', 'gyp', 'grass'],
        sizeMin: 8, sizeMax: 17, hMin: 0.26, hMax: 1,
        tone: 0.76, dark: 0.1, rim: true, blur: 0
      }, seed + 23);
      /* 最近层：逐株独立摆动，逐帧绘制（虚焦/清晰两组） */
      const r = mk(seed + 37);
      const blurList = [], sharpList = [];
      const nNear = Math.max(24, Math.round(W * 0.062));
      for (let i = 0; i < nNear; i++) {
        const p = {
          x: r() * W, by: H * (0.96 + r() * 0.16), hh: H * (0.26 + r() * 0.30),
          kind: pick(r, ['cosmos', 'cosmos', 'daisy', 'poppy', 'rose', 'rose', 'gyp', 'grass']),
          s: 13 + r() * 19, ph: r() * TAU, sp: 0.55 + r() * 0.7, r: r(), rng: r
        };
        (r() < 0.32 ? blurList : sharpList).push(p);
      }
      nearP = { blurList: blurList, sharpList: sharpList, blurCount: blurList.length };
      bokeh = [];
      for (let i = 0; i < 26; i++) {
        bokeh.push({ x: r() * W, y: H * (0.56 + r() * 0.34), rr: 5 + r() * 22, a: 0.04 + r() * 0.11, ph: r() * TAU, warm: r() > 0.5 });
      }
      motes = [];
      for (let i = 0; i < 46; i++) {
        motes.push({ x: r() * W, y: H * (0.3 + r() * 0.7), rr: 0.6 + r() * 1.8, vy: -(0.08 + r() * 0.3), vx: (r() - 0.5) * 0.2, a: 0.14 + r() * 0.42, ph: r() * TAU });
      }
      petals = [];
      for (let i = 0; i < 18; i++) {
        petals.push({ x: r() * W, y: H * (0.4 + r() * 0.6), vy: 0.1 + r() * 0.35, vx: (r() - 0.5) * 0.5, rot: r() * TAU, vr: (r() - 0.5) * 0.05, s: 2.4 + r() * 3.4, h: pick(r, [340, 352, 300, 42]) });
      }
      for (let i = 0; i < 18; i++) {
        /* 全部落在真正的水面带（地平线以下 ~8px 起），错开生成时间避免同相位 */
        rip.spawn(r() * W, hor + 9 + r() * (H * 0.22), 3, 6 + r() * 10, 0.2 + r() * 0.14, 3 + r() * 3);
      }
    }

    function drawFigure() {
      if (!figOk) return;
      const fh = H * 0.5, fw = fh * (fig.naturalWidth / fig.naturalHeight);
      const fx = W * 0.5 - fw / 2 + W * 0.2, feet = H * 0.6, fy = feet - fh;
      const cx = W * 0.5 + W * 0.2;
      const bob = reduce ? 0 : Math.sin(t * 0.8) * 4;
      const sway = reduce ? 0 : Math.sin(t * 0.5) * 0.006;

      /* 光柱 + 柔光（全部用径向渐变，避免矩形硬边） */
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const beamH = feet - fy + H * 0.3;
      const col = ctx.createRadialGradient(cx, feet + H * 0.02, 0, cx, feet + H * 0.02, Math.max(fw * 0.9, beamH * 0.5));
      col.addColorStop(0, 'rgba(170,250,220,.18)');
      col.addColorStop(0.42, 'rgba(120,220,190,.07)');
      col.addColorStop(1, 'rgba(120,220,190,0)');
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(cx, feet + H * 0.02, fw * 0.92, beamH * 0.55, 0, 0, TAU);
      ctx.fill();
      const haloG = ctx.createRadialGradient(cx, fy + fh * 0.42, 0, cx, fy + fh * 0.42, fw * 1.5);
      haloG.addColorStop(0, 'rgba(255,196,214,.16)');
      haloG.addColorStop(0.5, 'rgba(160,240,210,.06)');
      haloG.addColorStop(1, 'rgba(160,240,210,0)');
      ctx.fillStyle = haloG;
      ctx.beginPath();
      ctx.ellipse(cx, fy + fh * 0.42, fw * 1.5, fh * 0.95, 0, 0, TAU);
      ctx.fill();
      ctx.restore();

      /* 边缘辉光：让她像被光包裹，弱化抠图边界 */
      ctx.save();
      ctx.globalAlpha = 0.5;
      for (let k = 0; k < 3; k++) {
        const sp = 1 + (k + 1) * 0.022;
        ctx.globalAlpha = 0.16 - k * 0.045;
        ctx.drawImage(fig, cx - fw * sp / 2, fy + fh / 2 + bob - fh * sp / 2, fw * sp, fh * sp);
      }
      ctx.restore();

      /* 水中倒影（先于本体绘制，且只在水面带内） */
      ctx.save();
      ctx.beginPath(); ctx.rect(0, hor, W, feet + fh * 0.6 - hor); ctx.clip();
      mirror(ctx, fig, fx, feet, fw, fh * 0.5, 0.4, t, 5, true);
      const dg = ctx.createLinearGradient(0, feet, 0, feet + fh * 0.5);
      dg.addColorStop(0, 'rgba(3,20,18,.12)'); dg.addColorStop(1, 'rgba(3,20,18,.9)');
      ctx.globalAlpha = 0.55; ctx.fillStyle = dg;
      ctx.fillRect(fx - 8, feet, fw + 16, fh * 0.5);
      ctx.restore();

      /* 本体 */
      ctx.save();
      ctx.translate(cx, fy + fh / 2 + bob);
      ctx.rotate(sway);
      ctx.drawImage(fig, -fw / 2, -fh / 2, fw, fh);
      ctx.restore();

      if (!reduce && Math.random() < 0.035) {
        rip.spawn(cx + (Math.random() - 0.5) * fw * 0.5, feet + 2, 4, 9 + Math.random() * 8, 0.2, 3.4);
      }
    }

    function frame() {
      t += 0.016;
      ctx.clearRect(0, 0, W, H);
      const br = reduce ? 0 : Math.sin(t * 0.42);

      if (isStage) drawPlanet(ctx, W * 0.5 + W * 0.2, H * 0.19, H * 0.12, t);
      if (isStage) drawFigure();

      /* 远岸花海 + 水中倒影 */
      drawLayer(ctx, far, br * 1.5, br * 0.0009, 1);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, hor, W, H * 0.5); ctx.clip();
      ctx.globalAlpha = 1;
      mirror(ctx, far.cv, -far.pad, hor + 2, W + 2 * far.pad, H * 0.085, 0.3, t, 4.5, true);
      ctx.restore();

      /* 波光 + 涟漪（水面区域；涟漪用交替换色的做法保证在亮/暗背景上都可见） */
      /* 先给水面垫一层薄暗，让亮色涟漪环有对比可读 */
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
          rip.spawn(r() * W, hor + 9 + r() * H * 0.24, 2, 7 + r() * 11, 0.18 + r() * 0.14, 3.2 + r() * 3);
        }
      }

      /* 焦外光斑 */
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const b of bokeh) {
        const y = b.y + (reduce ? 0 : Math.sin(t * 0.5 + b.ph) * 6);
        const a = b.a * (0.6 + 0.4 * Math.sin(t * 0.9 + b.ph));
        const g = ctx.createRadialGradient(b.x, y, 0, b.x, y, b.rr);
        g.addColorStop(0, b.warm ? 'rgba(255,226,186,' + a.toFixed(3) + ')' : 'rgba(255,214,232,' + a.toFixed(3) + ')');
        g.addColorStop(0.7, b.warm ? 'rgba(255,206,150,' + (a * 0.4).toFixed(3) + ')' : 'rgba(255,190,220,' + (a * 0.4).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(255,200,220,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, y, b.rr, 0, TAU); ctx.fill();
      }
      ctx.restore();

      /* 近景花海：中景层保持清晰；最外一层顶边淡出，避免视线被一堵花墙挡住 */
      drawLayer(ctx, midA, reduce ? 0 : Math.sin(t * 0.5) * 3.4, reduce ? 0 : Math.sin(t * 0.5) * 0.0026, 0);
      drawLayer(ctx, midB, reduce ? 0 : Math.sin(t * 0.44 + 1.2) * 5.2, reduce ? 0 : Math.sin(t * 0.44 + 1.2) * 0.0038, 1);
      /* 最近层：虚焦组一次性降到 0.35 倍再放大（省算力），清晰组逐株绘制 */
      if (nearP.blurCount) {
        const bw = Math.max(1, (W * 0.35) | 0), bh = Math.max(1, (H * 0.35) | 0);
        const c = tmp(bw, bh), c2 = c.getContext('2d');
        c2.setTransform(1, 0, 0, 1, 0, 0);
        c2.clearRect(0, 0, bw, bh);
        c2.save(); c2.scale(0.35, 0.35);
        for (const p of nearP.blurList) {
          const sw = reduce ? 0 : Math.sin(t * p.sp + p.ph) * 0.022;
          c2.save();
          c2.translate(p.x, 0); c2.rotate(sw);
          plant(c2, 0, p.by, p.hh, p.kind, p.s, p.rng, 1);
          c2.restore();
        }
        c2.restore();
        ctx.drawImage(c, 0, 0, bw, bh, 0, 0, W, H);
      }
      for (const p of nearP.sharpList) {
        const sw = reduce ? 0 : Math.sin(t * p.sp + p.ph) * 0.022;
        ctx.save();
        ctx.translate(p.x + (reduce ? 0 : Math.sin(t * p.sp * 0.7 + p.ph) * 3), 0);
        ctx.rotate(sw);
        plant(ctx, 0, p.by, p.hh, p.kind, p.s, p.rng, 1);
        ctx.restore();
      }

      /* 飘落花瓣 + 花粉 */
      for (const p of petals) {
        p.y += p.vy; p.x += p.vx + (reduce ? 0 : Math.sin(t * 1.4 + p.rot) * 0.35); p.rot += p.vr;
        if (p.y > H + 8) { p.y = H * 0.34; p.x = Math.random() * W; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = hsl(p.h, 62, 84, 0.7);
        ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const m of motes) {
        m.y += m.vy; m.x += m.vx + (reduce ? 0 : Math.sin(t * 0.9 + m.ph) * 0.2);
        if (m.y < -10) { m.y = H * 0.98; m.x = Math.random() * W; }
        ctx.globalAlpha = m.a * (0.55 + 0.45 * Math.sin(t * 2 + m.ph));
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
