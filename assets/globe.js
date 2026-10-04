/* globe.js —— 足迹地球仪（three.js + 程序化世界地图，零外部贴图）
   特性：自转 + 拖拽 + 惯性｜按国家主色着色的大陆｜图钉脉冲光环｜点击弹卡片
        中国点击后取景放大，展开 10 座城市子图钉
   降级：无 WebGL / prefers-reduced-motion → 静态停止自转（仍可拖拽点击） */
(function () {
  'use strict';
  var THREE = window.THREE;
  var DATA = window.TRAVEL || {};
  var CNBOX = window.TRAVEL_CN_BOX || { lon0: 96, lon1: 126, lat0: 17, lat1: 45 };
  var mount = document.getElementById('globe');
  if (!mount || !THREE) return;
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* 资源基路径：从自己的 <script src> 反推。
     平铺式页面 → "assets/"；目录式页面（travel/index.html）→ "../assets/"。
     这样图片路径不用为两种部署结构各写一份。 */
  var ASSET_BASE = (function () {
    var s = document.querySelector('script[src*="globe.js"]');
    if (!s) return 'assets/';
    var m = s.getAttribute('src').replace(/globe\.js(\?.*)?$/, '');
    return m || 'assets/';
  })();
  var IMG = ASSET_BASE + 'img/travel/';

  var R = 1;
  var D2R = Math.PI / 180;
  /* 经纬度 → 球面坐标（与等距圆柱贴图对齐） */
  function ll2v(lon, lat, r) {
    var phi = (90 - lat) * D2R, theta = (lon + 180) * D2R;
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  }

  /* ============================================================ 世界地理数据
     真实海岸线，来自 world-geo.js（world-atlas / Natural Earth 110m，
     Douglas-Peucker 简化后按 0.1° 量化）。
     之前手敲的多边形会自交，把欧洲糊到非洲头上；而且缺了俄罗斯、中亚、中东
     那一整块，欧亚是断开的 —— 换真实数据后这些一次性解决。 */
  var GEO = window.WORLDGEO || { land: [], ctry: {} };

  /* 已到访国家配色（夜色友好的低饱和调），按 ISO 3166-1 alpha-2 索引 */
  var FILL_VISITED = {
    FR: '#6b93c4', BE: '#ab79a6', LU: '#8d9cb4', CH: '#c96b62',
    IT: '#6fae8b', DE: '#9a89bb', JP: '#c67b95', MY: '#9ab873',
    TH: '#cfa963', AE: '#bfa05f', CN: '#d97b5e'
  };

  /* ============================================================ 程序化世界贴图 */
  function buildTexture() {
    var W = 1024, H = 512;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d');

    /* 海洋：深墨绿到深海蓝的竖向渐变（与站点夜空同族） */
    var og = g.createLinearGradient(0, 0, 0, H);
    og.addColorStop(0, '#061e26'); og.addColorStop(0.5, '#0a3038'); og.addColorStop(1, '#061e26');
    g.fillStyle = og; g.fillRect(0, 0, W, H);

    /* 经纬网 */
    g.strokeStyle = 'rgba(150,240,205,.10)'; g.lineWidth = 1;
    for (var lon = -180; lon <= 180; lon += 20) {
      var x = (lon + 180) / 360 * W;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
    }
    for (var lat = -80; lat <= 80; lat += 20) {
      var y = (90 - lat) / 180 * H;
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    /* 赤道稍亮 */
    g.strokeStyle = 'rgba(150,240,205,.2)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();

    function px(lon, lat) { return [(lon + 180) / 360 * W, (90 - lat) / 180 * H]; }
    /* flat = [lon, lat, lon, lat, ...]（world-geo.js 的格式） */
    function poly(flat, fill, stroke, lw) {
      var n = flat.length >> 1;
      if (n < 3) return;
      g.beginPath();
      for (var i = 0; i < n; i++) {
        var p = px(flat[i * 2], flat[i * 2 + 1]);
        if (i === 0) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]);
      }
      g.closePath();
      g.fillStyle = fill; g.fill();
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
    }

    /* 中立陆地 */
    var NEUTRAL = '#28604f';
    for (var i = 0; i < GEO.land.length; i++) {
      poly(GEO.land[i], NEUTRAL, 'rgba(190,255,232,.22)', 0.9);
    }

    /* 已到访国家高亮 */
    Object.keys(GEO.ctry).forEach(function (k) {
      var col = FILL_VISITED[k] || '#3f8f74';
      GEO.ctry[k].forEach(function (r) { poly(r, col, 'rgba(214,255,240,.62)', 1.2); });
    });

    /* 极冠柔化 + 边缘雾 */
    var pg = g.createLinearGradient(0, 0, 0, H * 0.13);
    pg.addColorStop(0, 'rgba(6,30,38,.9)'); pg.addColorStop(1, 'rgba(6,30,38,0)');
    g.fillStyle = pg; g.fillRect(0, 0, W, H * 0.13);
    var pg2 = g.createLinearGradient(0, H, 0, H * 0.87);
    pg2.addColorStop(0, 'rgba(6,30,38,.9)'); pg2.addColorStop(1, 'rgba(6,30,38,0)');
    g.fillStyle = pg2; g.fillRect(0, H * 0.87, W, H * 0.13);

    /* 极淡的大气扫光，避免死板 */
    g.globalCompositeOperation = 'lighter';
    var bg = g.createRadialGradient(W * 0.3, H * 0.45, 0, W * 0.3, H * 0.45, W * 0.5);
    bg.addColorStop(0, 'rgba(120,220,190,.10)'); bg.addColorStop(1, 'rgba(120,220,190,0)');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';

    var tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace || undefined;
    tex.anisotropy = 4;
    return tex;
  }

  /* ============================================================ 初始化 */
  var renderer, scene, camera, globe, glow, pinGroup, raf = 0;
  /* auto：是否自转。取景动画结束后会挂起，直到用户空闲 idleMs 才缓慢恢复，
     否则刚聚焦好的国家会被自转带走，卡片与图钉对不上。 */
  var auto = !reduce, idleT = 0, IDLE_MS = 5200;
  var drag = null, vy = 0, vx = 0, rotY = -0.6, rotX = 0.16;
  var focusAnim = null, pins = [], cardOpen = false;

  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) { mount.innerHTML = '<p class="globe__fallback">你的浏览器不支持 WebGL，无法显示地球仪。</p>'; return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  mount.appendChild(renderer.domElement);
  mount.style.touchAction = 'none';

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 3.15);

  globe = new THREE.Mesh(
    new THREE.SphereGeometry(R, 64, 48),
    new THREE.MeshBasicMaterial({ map: buildTexture() })
  );
  scene.add(globe);

  /* 大气辉光：背面渲染的略大球 */
  glow = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.055, 48, 32),
    new THREE.ShaderMaterial({
      transparent: true, side: THREE.BackSide, depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(0x7ef0c4) } },
      vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uColor; varying vec3 vP; void main(){ float i=pow(0.72-dot(vP,vec3(0,0,1.0)),2.6); gl_FragColor=vec4(uColor,clamp(i,0.0,1.0)*0.85); }'
    })
  );
  scene.add(glow);

  pinGroup = new THREE.Group(); scene.add(pinGroup);

  /* ---------------------------------------------------------- 图钉 */
  function pinMesh(color) {
    /* 局部坐标系里：+Y 就是"插在地表上的方向"（圆盘状光环躺在 XZ 平面，
       球头再往上抬一点）。这样只要把 mesh 的 +Y 对齐球面法线即可。 */
    var g = new THREE.Group();
    var head = new THREE.Mesh(
      new THREE.SphereGeometry(0.0135, 14, 14),
      new THREE.MeshBasicMaterial({ color: color })
    );
    head.position.y = 0.017;
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(0.017, 0.0265, 26),
      new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.position.y = 0.0016;
    ring.rotation.x = -Math.PI / 2;      // 环面躺平（法线朝 +Y）
    g.add(head); g.add(ring);
    g.userData.ring = ring; g.userData.head = head;
    return g;
  }

  /* 把 mesh 的 +Y 轴对齐到目标法线 */
  var _up = new THREE.Vector3(0, 1, 0), _n = new THREE.Vector3(), _m = new THREE.Matrix4();
  function alignNormal(mesh, n) {
    _n.copy(n).normalize();
    _m.lookAt(new THREE.Vector3(0, 0, 0), _n, _up);
    mesh.quaternion.setFromRotationMatrix(_m);
  }

  function addPin(lon, lat, color, key, sub, lift) {
    var m = pinMesh(color);
    var n = ll2v(lon, lat, 1).normalize();
    var p = n.clone().multiplyScalar(R * (lift || 1.001));
    m.position.copy(p);
    alignNormal(m, n);
    m.userData.key = key;
    m.userData.sub = sub || 0;
    m.renderOrder = 10;
    pinGroup.add(m);
    pins.push(m);
    return m;
  }

  function buildPins() {
    while (pinGroup.children.length) pinGroup.remove(pinGroup.children[0]);
    pins = [];
    Object.keys(DATA).forEach(function (k) {
      var d = DATA[k];
      if (!d.c) return;
      /* 中国用暖橘、其余用青绿；抬高一点避免与球面共面被 z-fighting 吃掉 */
      addPin(d.c[0], d.c[1], k === 'cn' ? 0xffa06a : 0x9ff0c8, k, 0, 1.012);
    });
  }
  buildPins();

  /* 中国子图钉（放大后才显示） */
  var cnPins = [];
  function buildCnPins() {
    var cn = DATA.cn;
    if (!cn || !cn.cities) return;
    cn.cities.forEach(function (city, i) {
      var m = pinMesh(0xffd98a);
      m.userData.smallPin = true;
      var n = ll2v(city.c[0], city.c[1], 1).normalize();
      m.position.copy(n.clone().multiplyScalar(R * 1.012));
      alignNormal(m, n);
      m.scale.setScalar(0.001);
      m.userData.key = 'cn';
      m.userData.sub = i + 1;
      m.renderOrder = 10;
      m.visible = false;
      pinGroup.add(m);
      pins.push(m);
      cnPins.push(m);
    });
  }
  buildCnPins();

  /* ---------------------------------------------------------- 相机取景 */
  /* 把 (lon,lat) 转到正对相机。three.js Euler 'XYZ' 的合成是 R = Rx·Ry，三处坑：
       1) rx 不能用 asin(y)——只在赤道附近近似，必须 atan2(y, z')；
       2) ry = atan2(x, z) 的两个等价分支（相差 π）都能让该点朝前（z'' 完全相同），
          但配套的 rx 一个是 θ、另一个是 θ±π。必须选 |rx| 较小的那支 ——
          否则 rx 会超出 rotX 的 ±1.15 限制被 clamp，球停在半路，
          目标点落到屏幕外（图钉"看不见、点不到"就是这个原因）。
       3) atan2 的等价角（±2π）要归一到离当前角最近的一支，动画才不绕远路。 */
  function nearestAngle(target, cur) {
    var d = (target - cur) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return cur + d;
  }
  function solveView(v, curRy, curRx) {
    var best = null;
    for (var k = 0; k < 2; k++) {
      var ry = Math.atan2(v.x, v.z) + k * Math.PI;
      var z1 = -v.x * Math.sin(ry) + v.z * Math.cos(ry);
      if (z1 < 1e-6) continue;                       // 该点会转到球背面，废弃
      var rx = Math.atan2(v.y, z1);
      /* rx 归一后取绝对值最小的等价角 */
      var cand = { ry: ry, rx: nearestAngle(rx, 0) };
      if (!best || Math.abs(cand.rx) < Math.abs(best.rx)) best = cand;
    }
    if (!best) { best = { ry: Math.atan2(v.x, v.z), rx: 0 }; }
    return { ry: nearestAngle(best.ry, curRy), rx: Math.max(-1.15, Math.min(1.15, best.rx)) };
  }
  function focusOn(lon, lat, dist, zoom) {
    var s = solveView(ll2v(lon, lat, 1), rotY, rotX);
    focusAnim = {
      ry0: rotY, rx0: rotX, ry1: s.ry, rx1: s.rx,
      z0: camera.position.z, z1: dist, t: 0, dur: reduce ? 1 : 62
    };
    auto = false; idleT = 0;                 // 取景期间与之后一段时间都停自转
    if (zoom) {
      cnPins.forEach(function (m, i) {
        m.visible = true;
        m.userData.grow = { t: 0, delay: i * 4 };
      });
    } else {
      cnPins.forEach(function (m) { m.visible = false; m.scale.setScalar(0.001); m.userData.grow = null; });
    }
  }
  window.__globeHome = function () { focusOn(7, 45, 3.15, false); };

  /* ---------------------------------------------------------- 交互 */
  var el = renderer.domElement;
  var moved = 0;
  el.addEventListener('pointerdown', function (e) {
    drag = { x: e.clientX, y: e.clientY, t: performance.now() };
    vy = vx = 0; moved = 0; auto = false; idleT = 0;
    el.setPointerCapture && el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    moved += Math.abs(dx) + Math.abs(dy);
    rotY += dx * 0.0055;
    rotX = Math.max(-1.15, Math.min(1.15, rotX - dy * 0.0045));
    vy = dx * 0.0055; vx = -dy * 0.0045;
    drag.x = e.clientX; drag.y = e.clientY;
    focusAnim = null;
  });
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  function onUp(e) {
    if (!drag) return;
    var wasDrag = moved > 6;
    drag = null;
    idleT = 0;
    if (!wasDrag) { pick(e); auto = false; }
    else if (!reduce) auto = true;
    else auto = false;
  }
  el.addEventListener('wheel', function (e) {
    e.preventDefault();
    camera.position.z = Math.max(1.85, Math.min(5.0, camera.position.z + e.deltaY * 0.0012));
    fitFov();
    focusAnim = null; auto = false; idleT = 0;
  }, { passive: false });

  /* 拾取：射线与球面最近图钉 */
  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e) {
    var r = el.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    var hitSphere = new THREE.Vector3();
    var ok = ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(), R), hitSphere);
    if (!ok) return;
    var best = null, bd = 0.30;
    pins.forEach(function (m) {
      if (!m.visible) return;
      var wp = new THREE.Vector3(); m.getWorldPosition(wp);
      var d = wp.distanceTo(hitSphere);
      /* 背面剔除：法线与射线同向则跳过 */
      var camDir = camera.position.clone().sub(wp).normalize();
      if (wp.clone().normalize().dot(camDir) < 0.15) return;
      if (d < bd) { bd = d; best = m; }
    });
    if (best) onPinClick(best.userData.key, best.userData.sub);
  }

  /* ---------------------------------------------------------- 卡片 */
  var card = document.getElementById('travelCard');
  function flagHTML(code) {
    return (window.flagSVG ? window.flagSVG(code) : '');
  }
  function photosHTML(d, sub) {
    var list = (d.photos || []).slice();
    if (!list.length) return '';
    var items = list.map(function (f) {
      return '<button class="tcard__ph" type="button" data-src="' + IMG + f + '">' +
        '<img src="' + IMG + f + '" alt="" loading="lazy" /></button>';
    }).join('');
    return '<div class="tcard__gal">' + items + '</div>';
  }
  function cityListHTML(d) {
    if (!d.cities || !d.cities.length) return '';
    var items = d.cities.map(function (c, i) {
      return '<li class="tcard__city"><span class="tcard__citydot"></span>' +
        '<b>' + c.n + '</b>' + (c.yr ? '<i>' + c.yr + '</i>' : '') +
        '<p>' + c.d + '</p></li>';
    }).join('');
    return '<div class="tcard__sec"><h4 class="tcard__h4">📍 去过的地方</h4><ul class="tcard__cities">' + items + '</ul></div>';
  }
  function openCard(key, sub) {
    var d = DATA[key]; if (!d || !card) return;
    var city = (sub && d.cities && d.cities[sub - 1]) ? d.cities[sub - 1] : null;
    var title = city ? city.n : d.name;
    var yr = city && city.yr ? city.yr : d.yr;
    card.innerHTML =
      '<button class="tcard__x" type="button" aria-label="关闭">×</button>' +
      '<div class="tcard__hd">' +
        flagHTML(d.code) +
        '<div><h3 class="tcard__t serif">' + title + '</h3>' +
        '<span class="tcard__yr">' + (yr || '') + (d.name !== title ? ' · ' + d.name : '') + '</span></div>' +
      '</div>' +
      '<p class="tcard__poem serif">“' + (city ? (city.d.split('｜')[1] || d.poem) : d.poem) + '”</p>' +
      '<p class="tcard__note">' + (city ? city.d.split('｜')[0] : d.note) + '</p>' +
      '<div class="tcard__kw">' + (d.kw || []).map(function (k) { return '<span>' + k + '</span>'; }).join('') + '</div>' +
      photosHTML(d, sub) +
      (city ? '' : cityListHTML(d));
    card.classList.add('is-on');
    card.setAttribute('aria-hidden', 'false');
    cardOpen = true;
    var x = card.querySelector('.tcard__x'); if (x) x.focus();
    card.querySelectorAll('.tcard__ph').forEach(function (b) {
      b.addEventListener('click', function () { lightbox(b.getAttribute('data-src')); });
    });
    x.addEventListener('click', closeCard);
  }
  function closeCard() {
    if (!card) return;
    card.classList.remove('is-on'); card.setAttribute('aria-hidden', 'true');
    cardOpen = false;
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeCard(); closeLb(); window.__globeHome(); }
  });

  /* ---------------------------------------------------------- 灯箱 */
  var lb = document.getElementById('travelLightbox');
  function lightbox(src) {
    if (!lb) return;
    lb.querySelector('img').src = src;
    lb.classList.add('is-on'); lb.setAttribute('aria-hidden', 'false');
    var c = lb.querySelector('button'); if (c) c.focus();
  }
  function closeLb() { if (lb) { lb.classList.remove('is-on'); lb.setAttribute('aria-hidden', 'true'); } }
  if (lb) {
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target.tagName === 'BUTTON') closeLb(); });
  }

  /* 点击图钉入口 */
  function onPinClick(key, sub) {
    var d = DATA[key]; if (!d) return;
    if (key === 'cn' && !sub) {
      openCard('cn', 0);
      focusOn((CNBOX.lon0 + CNBOX.lon1) / 2, (CNBOX.lat0 + CNBOX.lat1) / 2, 2.40, true);
      return;
    }
    if (sub) {
      openCard(key, sub);
      var c = d.cities[sub - 1];
      if (c) focusOn(c.c[0], c.c[1], 2.30, true);
      return;
    }
    openCard(key, 0);
    if (d.c) focusOn(d.c[0], d.c[1], 2.60, false);
  }

  /* 侧栏列表：点名字也能看 */
  document.querySelectorAll('[data-goto]').forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-goto');
      var sub = Number(b.getAttribute('data-sub') || 0);
      onPinClick(k, sub);
    });
  });

  /* ---------------------------------------------------------- 尺寸 & 循环 */
  /* 根据当前相机距离与视口比例，推出"球刚好内切"的垂直 fov。
     球半径 1、相机在 z 处，垂直半角 = asin(1/z)；
     水平半角由 aspect 换算。取小的那个，球就永远完整可见且是正圆。 */
  function fitFov() {
    var aV = Math.asin(Math.min(0.99, 1 / camera.position.z)) * 180 / Math.PI;
    var aH = Math.atan(Math.tan(aV * Math.PI / 180) * camera.aspect) * 180 / Math.PI;
    camera.fov = Math.max(26, 2 * Math.min(aV, aH) * 1.10);
    camera.updateProjectionMatrix();
  }

  function resize() {
    var b = mount.getBoundingClientRect();
    var w = Math.max(1, Math.round(b.width)), h = Math.max(1, Math.round(b.height));
    /* updateStyle 必须为 true（或手动写 CSS 尺寸），否则画布的 CSS 尺寸
       与 drawingBuffer 尺寸脱钩。 */
    renderer.setSize(w, h, true);
    renderer.domElement.style.width = w + 'px';
    renderer.domElement.style.height = h + 'px';
    camera.aspect = w / h;
    fitFov();
  }
  window.addEventListener('resize', resize);
  resize();

  var easeOut = function (p) { return 1 - Math.pow(1 - p, 3); };
  function frame(now) {
    var t = now * 0.001;
    if (focusAnim) {
      var f = focusAnim;
      f.t++;
      var p = Math.min(1, f.t / f.dur), e = easeOut(p);
      rotY = f.ry0 + (f.ry1 - f.ry0) * e;
      rotX = f.rx0 + (f.rx1 - f.rx0) * e;
      camera.position.z = f.z0 + (f.z1 - f.z0) * e;
      fitFov();
      if (p >= 1) { focusAnim = null; idleT = 0; }
    } else if (drag) {
      /* 拖拽中，角度已经由 pointermove 更新 */
    } else if (cardOpen) {
      /* 卡片打开时定格，方便对着图钉读内容 */
    } else if (auto) {
      rotY += 0.0016;
    } else {
      /* 惯性衰减 */
      if (Math.abs(vy) > 1e-4 || Math.abs(vx) > 1e-4) {
        rotY += vy; rotX = Math.max(-1.15, Math.min(1.15, rotX + vx));
        vy *= 0.94; vx *= 0.94;
      } else if (!reduce) {
        /* 空闲计时：一段时间没交互才慢慢恢复自转 */
        idleT++;
        if (idleT > IDLE_MS / 16) auto = true;
      }
    }
    globe.rotation.y = rotY;
    globe.rotation.x = rotX;
    pinGroup.rotation.y = rotY;
    pinGroup.rotation.x = rotX;

    /* 图钉脉冲 */
    pins.forEach(function (m) {
      if (!m.visible) return;
      var ring = m.userData.ring;
      if (ring) {
        var k = reduce ? 1 : (0.55 + 0.45 * Math.sin(t * 2.2 + m.position.x * 6));
        ring.scale.setScalar(0.85 + k * 0.5);
        ring.material.opacity = 0.18 + 0.38 * k;
      }
      if (m.userData.grow) {
        var gr = m.userData.grow;
        if (gr.delay > 0) gr.delay--;
        else {
          gr.t = Math.min(1, gr.t + 0.07);
          m.scale.setScalar(easeOut(gr.t));
        }
      }
    });

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  /* 首屏取景：默认落在欧洲（2026 那趟的主舞台），略偏南以便看清图钉 */
  focusOn(7, 45, 3.15, false);

  /* 暴露给"重置"按钮 */
  window.__globeReset = function () { closeCard(); window.__globeHome(); };

  /* 调试探针：取出程序化贴图 canvas（开发期用，不影响渲染） */
  window.__globeTex = function () { return globe.material.map.image; };

  /* 调试探针：量测图钉投影（开发期用，不影响渲染） */
  window.__dbg = function () {
    var box = renderer.domElement.getBoundingClientRect();
    var out = pins.map(function (m) {
      var wp = new THREE.Vector3(); m.getWorldPosition(wp);
      var sp = wp.clone().project(camera);
      var nrm = wp.clone().normalize();
      var camDir = camera.position.clone().sub(wp).normalize();
      return {
        key: m.userData.key, sub: m.userData.sub, vis: m.visible,
        sc: +m.scale.x.toFixed(2),
        wp: [+wp.x.toFixed(3), +wp.y.toFixed(3), +wp.z.toFixed(3)],
        sx: Math.round(box.left + (sp.x * 0.5 + 0.5) * box.width),
        sy: Math.round(box.top + (-sp.y * 0.5 + 0.5) * box.height),
        facing: +nrm.dot(camDir).toFixed(2)
      };
    });
    return {
      rot: [+rotY.toFixed(3), +rotX.toFixed(3)],
      camZ: +camera.position.z.toFixed(2),
      box: [Math.round(box.left), Math.round(box.top), Math.round(box.width), Math.round(box.height)],
      pins: out
    };
  };

  window.addEventListener('pagehide', function () { cancelAnimationFrame(raf); });
})();
