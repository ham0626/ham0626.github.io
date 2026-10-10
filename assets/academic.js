/* academic.js — 学术之路 · 学术星河
   一块画布讲两件事：上半是星河（每桩事一颗星），下缘垂下来两条链 —— 读与写的双螺旋，
   中间的碱基对就是「来路」的结点（文字是静态 DOM，绝不随画布晃动）。
   零依赖 · reduced-motion 安全。
   数据入口：window.ACADEMIC_STARS（星）/ window.ACADEMIC_MILE（来路结点）。 */
(function () {
  'use strict';

  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // —— 已确认的里程碑（只放用户确认过的事，别自己编）——
  const STARS = window.ACADEMIC_STARS || [
    { t: '信竞起步 · 洛谷注册', y: 2023, m: 12, type: 'code' },
    { t: '图论 · SPFA 与 Dijkstra', y: 2024, m: 6, type: 'code' },
    { t: '搜索突破', y: 2026, m: 9, type: 'code' },
    { t: '背包从入门到入土', y: 2026, m: 10, type: 'code' }
  ];

  // —— 来路结点（双螺旋上的碱基对）——
  const MILE = window.ACADEMIC_MILE || [
    { n: '01', yr: '2023 · 冬', t: '在洛谷注册，信竞起步', s: '从最基础的题开始刷' },
    { n: '02', yr: '高中 · 机房', t: '刷题为日常', s: '三年通过 187 题、提交 206 次' },
    { n: '03', yr: '2026 · 夏', t: '参加洛谷月赛', s: '等级分定格 816' },
    { n: '04', yr: '2026 · 秋', t: '上大学，开 Codeforces', s: '新开 Valuri，认真打竞赛' },
    { n: '05', yr: '现在', t: '两条线并行', s: '信竞的修养，慢慢磨出来' }
  ];

  const TYPE = {
    code:  { rgb: '159,240,200', label: '代码', shape: 'spark' },
    group: { rgb: '244,213,141', label: '小组作业', shape: 'disc' },
    paper: { rgb: '244,238,205', label: '论文', shape: 'ring' }
  };
  const C_READ = '63,174,126';    // 读：绿
  const C_WRITE = '244,213,141';  // 写：金

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const cv = document.querySelector('.acad__cv');
  if (!cv) return;

  const ctx = cv.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rnd = mulberry32(20261009);
  const TWO_PI = Math.PI * 2;
  const ARMS = 3, TILT = 0.42, TURNS = 2.5;
  const RUNG_AT = [0.10, 0.30, 0.50, 0.70, 0.90];   // 碱基对落在螺旋高度的这几个位置

  let W = 0, H = 0, cx = 0, galY = 0, maxR = 0, helTop = 0, helH = 0, helA = 0;
  let narrow = false, rot = 0, targetRot = 0, t0 = 0, frameStars = [], hover = null, raf = 0;
  let milNodes = [];

  /* ---------- 星（学术星河） ---------- */
  const valOf = s => s.y + (s.m - 1) / 12;
  const vals = STARS.map(valOf);
  const minV = Math.min.apply(null, vals), maxV = Math.max.apply(null, vals);
  const stars = STARS.map(function (s, i) {
    const v = valOf(s);
    const k = maxV > minV ? (v - minV) / (maxV - minV) : 0.5;      // 0 旧 → 1 新
    const radius = 0.20 + k * 0.80;                                 // 新事靠外圈
    const arm = i % ARMS;
    const angle0 = arm * (TWO_PI / ARMS) + radius * TWO_PI * 1.15 + (rnd() - 0.5) * 0.55;
    return {
      s: s, radius: radius, angle0: angle0,
      angJit: (rnd() - 0.5) * 0.22,
      size: 1.0 + (s.type === 'paper' ? 1.5 : s.type === 'group' ? 1.1 : 0.85) + rnd() * 0.6
    };
  });

  /* ---------- 星尘：铺满整块画布，星河与双螺旋共处同一片天 ---------- */
  const dust = [];
  for (let i = 0; i < 170; i++) {
    dust.push({ u: rnd(), v: rnd(), a: 0.10 + rnd() * 0.30, sz: 0.5 + rnd() * 1.1, ph: rnd() * TWO_PI });
  }

  /* ---------- 自星河下缘汇入螺旋的一串流光（把两件事缝起来） ---------- */
  const flow = [];
  for (let i = 0; i < 42; i++) {
    flow.push({
      p: rnd(), sp: 0.0016 + rnd() * 0.0034, r: 0.7 + rnd() * 1.4,
      off: (rnd() - 0.5) * 1.6, gold: i % 2 === 1
    });
  }

  /* ---------- 星云边缘：闪烁的星 + 飞出渐淡的涟漪（像水波） ---------- */
  const edgeStars = [];
  for (let i = 0; i < 26; i++) {
    const pick = rnd();
    edgeStars.push({
      a: rnd() * TWO_PI,
      ph: rnd() * TWO_PI,
      sp: 0.7 + rnd() * 2.0,
      sz: 0.7 + rnd() * 1.7,
      tint: pick < 0.5 ? '207,240,224' : (pick < 0.78 ? '159,240,200' : '244,213,141')
    });
  }
  const ripples = [];
  const RIPPLE_MAX = 16;
  let rippleTimer = 0;
  function spawnRipple() {
    if (ripples.length >= RIPPLE_MAX) return;
    ripples.push({ a: rnd() * TWO_PI, t: 0, max: 70 + rnd() * 60, sz: 0.8 + rnd() * 1.6 });
  }

  /* ---------- 来路结点：静态 DOM 文字 ---------- */
  const listEl = document.querySelector('.mil__list');
  if (listEl) {
    MILE.forEach(function (m, i) {
      const d = document.createElement('div');
      d.className = 'mil ' + (i % 2 ? 'is-r' : 'is-l');
      d.innerHTML = '<span class="n">' + m.n + '</span><b>' + m.t + '</b>'
        + '<span class="s">' + m.yr + ' · ' + m.s + '</span>';
      listEl.appendChild(d);
      milNodes.push(d);
    });
  }

  /* ---------- 几何 ---------- */
  function rungY(i) { return helTop + RUNG_AT[i % RUNG_AT.length] * helH; }
  function theta(y) { return (y - helTop) / helH * TURNS * TWO_PI; }

  // 把"星云本地坐标 (R, 角度 a)"投影到屏幕，与 drawGalaxy 的旋转/倾斜一致
  let phi = 0;
  function projEdge(a, R) {
    const lx = Math.cos(a) * R, ly = Math.sin(a) * R;
    const c = Math.cos(phi), s = Math.sin(phi);
    const X = lx * c - ly * s, Y = lx * s + ly * c;
    return { x: cx + X, y: galY + Y * TILT };
  }

  function resize() {
    const box = cv.getBoundingClientRect();
    W = Math.max(1, box.width); H = Math.max(1, box.height);
    narrow = W < 760;
    cx = W / 2;
    galY = H * (narrow ? 0.30 : 0.28);
    helTop = H * (narrow ? 0.60 : 0.60);
    helH = Math.max(80, H - 26 - helTop);
    helA = Math.min(W * (narrow ? 0.075 : 0.046), 48);
    // 垂直方向留足余量：星徽与辉光都不许被画布边缘切掉
    maxR = Math.min(
      W * 0.42,
      (galY - 46) / TILT,
      (helTop - 64 - galY) / TILT
    );
    if (!(maxR > 30)) maxR = 30;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    placeLabels();
    if (reduce) draw();
  }

  function placeLabels() {
    if (narrow) { milNodes.forEach(d => { d.style.top = ''; }); return; }
    milNodes.forEach(function (d, i) { d.style.top = rungY(i).toFixed(1) + 'px'; });
  }

  /* ---------- 画：小工具 ---------- */
  function spark(x, y, r) {           // 四角星
    const k = r * 0.34;
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + k, y - k);
    ctx.lineTo(x + r, y); ctx.lineTo(x + k, y + k);
    ctx.lineTo(x, y + r); ctx.lineTo(x - k, y + k);
    ctx.lineTo(x - r, y); ctx.lineTo(x - k, y - k);
    ctx.closePath(); ctx.fill();
  }

  function drawStar(x, y, r, rgb, a, shape) {
    ctx.fillStyle = 'rgba(' + rgb + ',' + (a * 0.18).toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, TWO_PI); ctx.fill();
    if (shape === 'disc') {
      ctx.fillStyle = 'rgba(' + rgb + ',' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x, y, r, 0, TWO_PI); ctx.fill();
    } else if (shape === 'ring') {
      ctx.fillStyle = 'rgba(' + rgb + ',' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0, TWO_PI); ctx.fill();
      ctx.strokeStyle = 'rgba(' + rgb + ',' + Math.min(1, a + 0.12).toFixed(3) + ')';
      ctx.lineWidth = Math.max(1, r * 0.42);
      ctx.beginPath(); ctx.arc(x, y, r * 1.55, 0, TWO_PI); ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(' + rgb + ',' + a.toFixed(3) + ')';
      spark(x, y, r);
    }
  }

  /* ---------- 画：星尘 ---------- */
  function drawDust() {
    for (let i = 0; i < dust.length; i++) {
      const d = dust[i];
      const ang = d.ph + rot * 0.42 + t0 * 0.0008;
      const x = d.u * W + Math.cos(ang) * 6;
      const y = d.v * H + Math.sin(ang * 0.8) * 5;
      const tw = 0.62 + 0.38 * Math.sin(t0 * 0.02 + d.ph);
      ctx.fillStyle = 'rgba(207,240,224,' + (d.a * tw).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x, y, d.sz, 0, TWO_PI); ctx.fill();
    }
  }

  /* ---------- 画：星河 ---------- */
  function drawGalaxy() {
    const g = ctx.createRadialGradient(cx, galY, 0, cx, galY, maxR * 0.46);
    g.addColorStop(0, 'rgba(244,213,141,0.22)');
    g.addColorStop(0.35, 'rgba(63,174,126,0.10)');
    g.addColorStop(1, 'rgba(63,174,126,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, galY, maxR * 0.46, 0, TWO_PI); ctx.fill();

    ctx.save(); ctx.translate(cx, galY); ctx.scale(1, TILT); ctx.rotate(rot * 0.6);
    for (let k = 0; k < 2; k++) {
      ctx.beginPath(); ctx.arc(0, 0, maxR * (0.5 + k * 0.22), 0, TWO_PI);
      ctx.strokeStyle = 'rgba(63,174,126,0.045)'; ctx.lineWidth = maxR * 0.16; ctx.stroke();
    }
    ctx.restore();

    const list = stars.map(function (s) {
      const ang = s.angle0 + s.angJit + rot;
      const r = s.radius * maxR;
      return {
        s: s, ang: ang,
        x: cx + Math.cos(ang) * r,
        y: galY + Math.sin(ang) * r * TILT,
        depth: Math.sin(ang)
      };
    }).sort((a, b) => a.depth - b.depth);
    frameStars = list;

    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      const front = (o.depth + 1) / 2;
      // 只有四颗星，前后景都得不吃亏：改用弱对比保留一点纵深
      const a = 0.62 + front * 0.36;
      const r = o.s.size * (1.55 + front * 0.75);
      const cfg = TYPE[o.s.s.type] || TYPE.code;
      drawStar(o.x, o.y, r, cfg.rgb, a, cfg.shape);
    }
  }

  /* ---------- 画：星河 → 螺旋 的流光 ---------- */
  function drawFlow() {
    const y0 = galY + maxR * TILT * 0.80;
    const y1 = helTop + 8;
    if (y1 <= y0) return;
    for (let i = 0; i < flow.length; i++) {
      const f = flow[i];
      if (!reduce) { f.p += f.sp; if (f.p > 1) f.p -= 1; }
      const p = f.p;
      const y = y0 + (y1 - y0) * p;
      const x = cx + f.off * Math.sin(p * Math.PI) * 13;
      const a = Math.sin(p * Math.PI);
      ctx.fillStyle = 'rgba(' + (f.gold ? '244,232,196' : '206,242,222') + ',' + (a * 0.78).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x, y, f.r * (0.6 + p * 0.9), 0, TWO_PI); ctx.fill();
    }
  }

  /* ---------- 画：来路双螺旋（两条链 + 五枚碱基对） ---------- */
  function drawHelix() {
    if (helH < 40) return;
    const step = 6, nSeg = Math.max(1, Math.round(helH / step));

    for (let sgn = -1; sgn <= 1; sgn += 2) {
      const col = sgn < 0 ? C_READ : C_WRITE;
      // 极淡的脊线：让链的走向读得出来
      ctx.beginPath();
      for (let y = helTop; y <= helTop + helH; y += 4) {
        const x = cx + sgn * helA * Math.sin(theta(y));
        if (y === helTop) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      const lg = ctx.createLinearGradient(0, helTop, 0, helTop + helH);
      lg.addColorStop(0, 'rgba(' + col + ',0)');
      lg.addColorStop(0.10, 'rgba(' + col + ',0.30)');
      lg.addColorStop(0.90, 'rgba(' + col + ',0.30)');
      lg.addColorStop(1, 'rgba(' + col + ',0)');
      ctx.strokeStyle = lg; ctx.lineWidth = 1.2; ctx.stroke();

      // 链上的星：亮度波沿链下行 = 它在流（几何不动，字也不动）
      for (let k = 0; k <= nSeg; k++) {
        const y = helTop + k * step;
        const x = cx + sgn * helA * Math.sin(theta(y));
        const w = 0.30 + 0.70 * Math.max(0, Math.sin(k / nSeg * 6 * Math.PI - (reduce ? 0 : t0 * 0.030)));
        ctx.fillStyle = 'rgba(' + col + ',' + (0.20 + w * 0.64).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(x, y, 0.7 + w * 1.1, 0, TWO_PI); ctx.fill();
        if (k % 6 === 3) {
          ctx.fillStyle = 'rgba(236,252,244,' + (0.12 + w * 0.52).toFixed(3) + ')';
          spark(x, y, 1.5 + w * 1.5);
        }
      }
    }

    // 碱基对 = 来路结点（|sin|=1 → 每一枚都满宽）
    for (let i = 0; i < MILE.length; i++) {
      const y = rungY(i);
      const sA = Math.sin(theta(y));
      const xRead = cx - helA * sA, xWrite = cx + helA * sA;
      const grad = ctx.createLinearGradient(xRead, 0, xWrite, 0);
      grad.addColorStop(0, 'rgba(' + C_READ + ',0.62)');
      grad.addColorStop(1, 'rgba(' + C_WRITE + ',0.62)');
      ctx.strokeStyle = grad; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(xRead, y); ctx.lineTo(xWrite, y); ctx.stroke();

      ctx.fillStyle = 'rgba(159,240,200,0.14)';
      ctx.beginPath(); ctx.arc(cx, y, 12, 0, TWO_PI); ctx.fill();
      ctx.fillStyle = 'rgba(243,246,244,0.95)';
      spark(cx, y, 3.1);
    }
  }

  /* ---------- 画：星云边缘的闪烁星 + 飞出渐淡的涟漪 ---------- */
  function drawEdge() {
    phi = rot * 0.6;
    // 1) 边缘闪烁星：贴着星云盘的边缘，亮度随时间呼吸
    for (let i = 0; i < edgeStars.length; i++) {
      const e = edgeStars[i];
      const p = projEdge(e.a, maxR * 0.97);
      const tw = reduce ? 0.72 : 0.32 + 0.68 * Math.pow(0.5 + 0.5 * Math.sin(t0 * e.sp * 0.05 + e.ph), 2);
      ctx.fillStyle = 'rgba(' + e.tint + ',' + tw.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, e.sz, 0, TWO_PI); ctx.fill();
      if (e.sz > 1.1) {                              // 亮一点儿的带十字微光
        const len = e.sz * 3.4;
        ctx.strokeStyle = 'rgba(' + e.tint + ',' + (tw * 0.5).toFixed(3) + ')';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(p.x - len, p.y); ctx.lineTo(p.x + len, p.y);
        ctx.moveTo(p.x, p.y - len); ctx.lineTo(p.x, p.y + len);
        ctx.stroke();
      }
    }
    // 2) 飞出渐淡的涟漪粒子：像水波从星云边缘漾开
    if (!reduce) {
      rippleTimer++;
      if (rippleTimer > 16 && ripples.length < RIPPLE_MAX) { rippleTimer = 0; spawnRipple(); }
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      if (!reduce) rp.t++;
      const k = rp.t / rp.max;
      if (k >= 1) { ripples.splice(i, 1); continue; }
      const R = maxR * (0.86 + k * 0.34);
      const p = projEdge(rp.a, R);
      const a = (1 - k) * (1 - k) * 0.85;
      const r = rp.sz * (0.7 + k * 2.0);
      ctx.fillStyle = 'rgba(207,240,224,' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TWO_PI); ctx.fill();
    }
  }

  function drawHover(o) {
    ctx.strokeStyle = 'rgba(244,213,141,0.85)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(o.x, o.y, o.s.size * 4 + 6, 0, TWO_PI); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(o.x - 10, o.y); ctx.lineTo(o.x + 10, o.y);
    ctx.moveTo(o.x, o.y - 10); ctx.lineTo(o.x, o.y + 10); ctx.stroke();
  }

  function draw() {
    if (!reduce) t0 += 1;
    rot += (targetRot - rot) * 0.08 + (reduce ? 0 : 0.0010);
    ctx.clearRect(0, 0, W, H);
    drawDust();
    drawGalaxy();
    drawEdge();
    drawFlow();
    drawHelix();
    if (hover) drawHover(hover);
    if (!reduce) raf = requestAnimationFrame(draw);
  }

  /* ---------- 悬停：星会说话 ---------- */
  const tip = document.querySelector('.acad__tip');
  function onMove(e) {
    if (!tip) return;
    const rect = cv.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let best = null, bd = 18 * 18;
    for (let i = 0; i < frameStars.length; i++) {
      const o = frameStars[i];
      const dx = o.x - mx, dy = o.y - my, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = o; }
    }
    if (best) {
      hover = best;
      const p = best.s.s, cfg = TYPE[p.type] || TYPE.code;
      tip.innerHTML = '<b>' + p.t + '</b><br><span class="y">' + p.y + '.' + (p.m < 10 ? '0' + p.m : p.m) + '</span> · ' + cfg.label;
      tip.style.left = best.x + 'px'; tip.style.top = best.y + 'px';
      tip.hidden = false;
      cv.style.cursor = 'pointer';
    } else {
      hover = null; tip.hidden = true; cv.style.cursor = 'default';
    }
  }
  cv.addEventListener('mousemove', onMove);
  cv.addEventListener('mouseleave', function () { hover = null; if (tip) tip.hidden = true; });

  /* 自检探针：星是否被画布边缘切掉、结点文字是否落在碱基对上 */
  window.__acad = function () {
    let top = Infinity, bot = -Infinity;
    frameStars.forEach(function (o) {
      const r = o.s.size * (0.9 + ((o.depth + 1) / 2) * 1.4) * 3.2;   // 含辉光
      top = Math.min(top, o.y - r); bot = Math.max(bot, o.y + r);
    });
    return {
      W: +W.toFixed(1), H: +H.toFixed(1), maxR: +maxR.toFixed(1),
      galY: +galY.toFixed(1), helTop: +helTop.toFixed(1), helH: +helH.toFixed(1), helA: +helA.toFixed(1),
      starTop: isFinite(top) ? +top.toFixed(1) : null,
      starBottom: isFinite(bot) ? +bot.toFixed(1) : null,
      clipped: !(top > 0 && bot < H),
      rungs: RUNG_AT.map(function (_, i) { return +rungY(i).toFixed(1); }),
      labelTops: milNodes.map(function (d) { return d.style.top || '(flow)'; }),
      stars: frameStars.length, dust: dust.length, mil: milNodes.length, narrow: narrow,
      edge: edgeStars.length, ripples: ripples.length,
      edgeTop: +(galY - maxR * 1.20 * TILT).toFixed(1), edgeClip: (galY - maxR * 1.20 * TILT) < 0
    };
  };

  let ticking = false;
  window.addEventListener('scroll', function () {
    if (reduce || ticking) return;
    ticking = true;
    requestAnimationFrame(function () { targetRot = window.scrollY * 0.0016; ticking = false; });
  }, { passive: true });
  window.addEventListener('resize', resize);

  resize();
  if (reduce) draw(); else raf = requestAnimationFrame(draw);
})();
