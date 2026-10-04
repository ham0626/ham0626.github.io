/* space.js — 轻量 "space voyage" 动效引擎（纯 Canvas，零依赖、零图片）
   能力：三层景深星场 + 鼠标视差 + 闪烁 + 亮星十字光晕 + 上升尘埃 + 偶发流星
   模式：
     .hero__space   → voyage：星场在湖面镜像倒影（视差方向相反，物理正确）
     .subhero__space→ field ：普通星场（子页头部）
   自动降级：prefers-reduced-motion 时静态渲染一帧。 */
(function () {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvases = Array.from(document.querySelectorAll('.hero__space, .subhero__space, .stage__space'));
  if (!canvases.length) return;

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (cx, cy) => {
    mouse.tx = (cx / window.innerWidth - 0.5) * 2;
    mouse.ty = (cy / window.innerHeight - 0.5) * 2;
  };
  window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY), { passive: true });
  window.addEventListener('mouseleave', () => { mouse.tx = 0; mouse.ty = 0; });
  window.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  function init(canvas) {
    // subhero__space 为普通星场；hero / stage 为 voyage（星场在湖面镜像倒影）
    const voyage = !canvas.classList.contains('subhero__space');
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, mid = 0, stars = [], dust = [], shooting = null, t = 0;

    function resize() {
      const box = canvas.parentElement.getBoundingClientRect();
      W = Math.max(1, box.width); H = Math.max(1, box.height); mid = H * 0.5;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    function build() {
      // 星场：三层景深；天空区（上半）更密
      stars = [];
      const density = voyage ? 3600 : 5200;
      const n = Math.min(760, Math.round((W * H) / density));
      for (let i = 0; i < n; i++) {
        const depth = Math.random();               // 0 远 → 1 近
        const yMax = voyage ? H * 0.60 : H * 0.92;
        stars.push({
          x: Math.random() * W,
          y: Math.random() * yMax,
          r: 0.28 + depth * 1.5,
          base: 0.22 + depth * 0.55,
          tw: Math.random() * Math.PI * 2,
          tws: 0.5 + Math.random() * 1.7,
          vx: (depth - 0.35) * 0.05,
          depth,
          flare: depth > 0.86 && Math.random() < 0.55
        });
      }
      // 上升尘埃：营造"航行"感
      dust = [];
      const dn = Math.min(140, Math.round((W * H) / 24000));
      for (let i = 0; i < dn; i++) {
        dust.push({
          x: Math.random() * W,
          y: Math.random() * (voyage ? H * 0.62 : H),
          r: 0.4 + Math.random() * 1.5,
          vy: -(0.07 + Math.random() * 0.24),
          vx: (Math.random() - 0.5) * 0.12,
          a: 0.08 + Math.random() * 0.3
        });
      }
    }

    function spawnShooting() {
      const fromLeft = Math.random() > 0.5;
      shooting = {
        x: fromLeft ? -50 : W + 50,
        y: Math.random() * mid * 0.8 + 16,
        vx: (fromLeft ? 1 : -1) * (5.5 + Math.random() * 4.5),
        vy: 1.4 + Math.random() * 1.5,
        life: 0, max: 40 + Math.random() * 22
      };
    }

    function px(s) { return s.x + mouse.x * (7 + s.depth * 30); }
    function py(s) { return s.y + mouse.y * (5 + s.depth * 20); }

    function drawStar(x, y, r, a, flare) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832);
      ctx.fillStyle = 'rgba(236,245,255,' + a.toFixed(3) + ')'; ctx.fill();
      if (flare) {
        const len = r * 7, w = Math.max(0.5, r * 0.42);
        ctx.save();
        ctx.globalAlpha = a * 0.5;
        ctx.strokeStyle = 'rgba(200,240,255,1)'; ctx.lineWidth = w; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - len, y); ctx.lineTo(x + len, y);
        ctx.moveTo(x, y - len); ctx.lineTo(x, y + len);
        ctx.stroke();
        ctx.restore();
      }
    }

    function frame() {
      t += 0.016;
      mouse.x += (mouse.tx - mouse.x) * 0.045;
      mouse.y += (mouse.ty - mouse.y) * 0.045;
      ctx.clearRect(0, 0, W, H);

      // 星点（含湖面倒影）
      for (const s of stars) {
        s.x += s.vx; if (s.x > W + 2) s.x = -2; if (s.x < -2) s.x = W + 2;
        const a = reduce ? s.base : s.base * (0.58 + 0.42 * Math.sin(t * s.tws + s.tw));
        const x = px(s), y = py(s);
        drawStar(x, y, s.r, a, s.flare);
        if (voyage) {
          const ry = H - s.y - mouse.y * (5 + s.depth * 20);
          drawStar(x, ry, s.r * 0.85, a * 0.32 * (1 - s.y / (H * 0.6) * 0.5), false);
        }
      }

      // 尘埃
      for (const d of dust) {
        d.y += d.vy; d.x += d.vx;
        const yTop = voyage ? H * 0.62 : H;
        if (d.y < -4) { d.y = yTop + 4; d.x = Math.random() * W; }
        if (d.x < -4) d.x = W + 4; if (d.x > W + 4) d.x = -4;
        ctx.beginPath();
        ctx.arc(d.x + mouse.x * 16, d.y + mouse.y * 11, d.r, 0, 6.2832);
        ctx.fillStyle = 'rgba(178,226,206,' + d.a.toFixed(3) + ')'; ctx.fill();
      }

      // 流星（带倒影）
      if (shooting) {
        shooting.x += shooting.vx; shooting.y += shooting.vy; shooting.life++;
        const sx = shooting.x + mouse.x * 22, sy = shooting.y + mouse.y * 15;
        const ex = sx - shooting.vx * 6.5, ey = sy - shooting.vy * 6.5;
        const grad = ctx.createLinearGradient(sx, sy, ex, ey);
        grad.addColorStop(0, 'rgba(255,255,255,.92)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = grad; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        if (voyage) {
          const ry = H - sy, rey = H - ey;
          ctx.save(); ctx.globalAlpha = 0.26;
          ctx.beginPath(); ctx.moveTo(sx, ry); ctx.lineTo(ex, rey); ctx.stroke(); ctx.restore();
        }
        if (shooting.life > shooting.max) shooting = null;
      } else if (!reduce && Math.random() < 0.0022) spawnShooting();

      if (!reduce) requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    if (reduce) {
      frame();  // requestAnimationFrame 未启动 → 只画一帧
    } else {
      requestAnimationFrame(frame);
    }
  }

  canvases.forEach(init);
})();
