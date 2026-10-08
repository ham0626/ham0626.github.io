/* globe.js —— 足迹地球仪（three.js + 程序化世界地图，零外部贴图）
   特性：自转 + 拖拽 + 惯性｜按国家主色着色的大陆｜图钉脉冲光环｜点击弹卡片
        中国点击后取景放大，展开 10 座城市子图钉｜地表浮着几朵慢慢东移的云
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
  /* 色相体系照着 FILL 的上色（见 buildTexture），只把明度和饱和抬一档 ——
     否则测出来三个国家凑到同一个色上去，谁是谁就分不出来了：
       FR 蓝 212° / BE 紫 288° / LU 215°（淡化版）/ CH 偏红 4° / IT 绿 155°
       DE 紫 260° / JP 玫红 337° / MY 黄绿 96° / TH 橙 32° / AE 金 41° / CN 橘红 15° */
  var FILL_VISITED = {
    FR: '#7aa9d8', BE: '#b478ad', LU: '#a8bdd0', CH: '#d97a6c',
    IT: '#7cc9a2', DE: '#a795d1', JP: '#dc85a2', MY: '#aecb78',
    TH: '#dcb46b', AE: '#d4b060', CN: '#e07b52'
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

  /* ---------------------------------------------------------- 云
     几朵云贴在球面外一小圈（与地球同心），跟着地球一起转，
     自己再慢慢往东飘。
     做法：程序化"云图"贴在与地球同心的球冠上 —— 三排相互叠压的圆丘（每丘过渡只占
     外侧 14%）叠出实白芯 + 丘状轮廓，底边压灰、切平。过渡给长了就是一坨雾。
     几何是"球冠"（曲面）而不是平板 —— 平板往内侧延伸时会捅进球体里，在球的
     轮廓附近被球切开，看着像插进了地球；球冠上每一个点都落在与地球同心、
     半径 CLOUD_R 的球面上，所以怎么转都严丝合缝地贴着球面。 */
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function cloudTexture(seed) {
    var S = 256, cv = document.createElement('canvas');
    cv.width = cv.height = S;
    var g = cv.getContext('2d'), rnd = mulberry(seed);
    /* 一朵"云"= 一堆相互叠压的圆丘。每个丘自己的过渡很短（外侧 14% 才淡出），
       叠起来中心就饱和成实白、外轮廓留下一个个丘 —— 过渡给太长就成一团雾了。 */
    function puff(x, y, r, a) {
      var cx = x * S, cy = y * S, rr = r * S;
      var rg = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
      rg.addColorStop(0, 'rgba(255,255,255,' + a.toFixed(3) + ')');
      rg.addColorStop(0.55, 'rgba(255,255,255,' + (a * 0.92).toFixed(3) + ')');
      rg.addColorStop(0.86, 'rgba(250,255,253,' + (a * 0.34).toFixed(3) + ')');
      rg.addColorStop(1, 'rgba(246,254,251,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.fill();
    }
    var row = function (y, xs, r0, a) {
      var jy = (rnd() - 0.5) * 0.035;
      xs.forEach(function (x) {
        if (rnd() < 0.14) return;                       // 随机少一丘，免得八朵云一个模子
        puff(x + (rnd() - 0.5) * 0.07, y + jy + (rnd() - 0.5) * 0.03, r0 + rnd() * 0.06, a);
      });
    };
    row(0.40, [0.33, 0.45, 0.57, 0.68], 0.105, 0.48);   // 顶上的小丘
    row(0.49, [0.26, 0.38, 0.50, 0.62, 0.74], 0.145, 0.50);
    row(0.57, [0.20, 0.32, 0.44, 0.56, 0.68, 0.80], 0.170, 0.50);  // 底盘
    puff(0.33 + rnd() * 0.10, 0.345, 0.062 + rnd() * 0.03, 0.45);
    puff(0.52 + rnd() * 0.12, 0.355, 0.058 + rnd() * 0.03, 0.45);
    /* 底边压一点灰：云是上面受光、底下背光，全白会显得是块贴纸 */
    g.globalCompositeOperation = 'source-atop';
    var sg = g.createLinearGradient(0, S * 0.40, 0, S * 0.66);
    sg.addColorStop(0, 'rgba(148,176,170,0)');
    sg.addColorStop(1, 'rgba(148,176,170,.34)');
    g.fillStyle = sg; g.fillRect(0, S * 0.40, S, S * 0.26);
    /* 底边切平：底下扫一条 destination-out 渐变，云才有"底"，不是个椭圆 */
    g.globalCompositeOperation = 'destination-out';
    var bg = g.createLinearGradient(0, S * 0.60, 0, S * 0.75);
    bg.addColorStop(0, 'rgba(0,0,0,0)');
    bg.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = bg; g.fillRect(0, S * 0.60, S, S * 0.40);
    g.globalCompositeOperation = 'source-over';
    var tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace || undefined;
    return tex;
  }

  /* 云冠几何：正方形贴图 → 与地球同心的球面片。
     局部坐标里中心轴 = +Z，顶点 = (x, y, √(CLOUD_R² − x² − y²))，
     平面投影正好是 sx × sy 的方形，uv 线性对应，云图不变形。
     所有顶点都落在半径 CLOUD_R 的球面上 —— 只要把 +Z 转到地表法线，
     云就严丝合缝贴在球面上，怎么转都不会切进球体。
     sx < sy：球面本身会纵向压缩，加上云图里的云是横躺的，几何就得反过来
     纵向给足，云在屏幕上才不是一根扁扁的棉花棒。 */
  var CLOUD_R = 1.048;
  function cloudPatchGeometry(sx, sy, seg) {
    var N = seg || 22;
    var n = (N + 1) * (N + 1);
    var pos = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    var idx = [], r2 = CLOUD_R * CLOUD_R;
    for (var iy = 0; iy <= N; iy++) {
      for (var ix = 0; ix <= N; ix++) {
        var u = ix / N, v = iy / N, k = iy * (N + 1) + ix;
        var x = (u - 0.5) * sx, y = (v - 0.5) * sy;
        pos[k * 3] = x; pos[k * 3 + 1] = y;
        pos[k * 3 + 2] = Math.sqrt(Math.max(r2 * 0.04, r2 - x * x - y * y));
        uv[k * 2] = u; uv[k * 2 + 1] = v;
      }
    }
    for (var jy = 0; jy < N; jy++) {
      for (var jx = 0; jx < N; jx++) {
        var a = jy * (N + 1) + jx, b = a + 1, c = a + N + 1, d = c + 1;
        idx.push(a, b, c, b, d, c);       /* 逆时针 = 正面朝外（+Z 一侧） */
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }

  /* [经度, 纬度, 大小, 自转角, 东移速度(度/帧)]
     自转角给得很小：真实的云基本是横躺的，转过 10° 以上就成了斜条。 */
  var CLOUD_PLAN = [
    [-16, 46, 0.72, 0.06, 0.013],    // 北大西洋
    [26, 24, 0.46, -0.11, 0.011],    // 北非 · 地中海
    [78, 54, 0.58, 0.04, 0.012],     // 西伯利亚
    [128, 4, 0.42, -0.07, 0.010],    // 西太平洋
    [168, -24, 0.54, 0.09, 0.009],   // 澳大利亚以东
    [214, 40, 0.64, -0.04, 0.012],   // 北美
    [292, 6, 0.48, 0.10, 0.010],     // 赤道大西洋
    [330, 60, 0.40, -0.08, 0.011]    // 北大西洋高纬
  ];
  var AXIS_Z = new THREE.Vector3(0, 0, 1);
  /* 云冠在球面上的铺开尺寸 = CLOUD_PLAN 的 size × 这两个系数。
     这组数是照着实拍截图调的：横向 0.46 时云宽约占球径一成二，正好"一朵"；
     纵向再给到 1.7 倍，抵掉球面的纵向压缩。 */
  var PATCH_W = 0.46, PATCH_H = 0.78;
  var clouds = [];
  CLOUD_PLAN.forEach(function (c, i) {
    var mat = new THREE.MeshBasicMaterial({
      map: cloudTexture(1013 + i * 7919),
      transparent: true, opacity: 0.72, depthWrite: false,
      color: 0xfbfefd
    });
    var m = new THREE.Mesh(cloudPatchGeometry(c[2] * PATCH_W, c[2] * PATCH_H), mat);
    m.renderOrder = 6;
    scene.add(m);
    clouds.push({
      mesh: m, mat: mat, lon: c[0], lat: c[1], size: c[2], spd: c[4], rot0: c[3],
      base: 0.68 + (i % 3) * 0.06, ph: i * 1.7
    });
  });

  /* 云冠不挂在旋转过的父节点上 —— 那样拿不到世界法线。
     所以每帧手动把球面坐标按当前 rotY/rotX 转出来（与 globe 的 Euler 合成
     一致：先绕 Y，再绕 X），再把云冠的 +Z 轴对齐到这条法线。
     网格自己不动位置（球心在原点，云冠也以原点为心）。 */
  var AXIS_Y = new THREE.Vector3(0, 1, 0), AXIS_X = new THREE.Vector3(1, 0, 0);
  var _rollQ = new THREE.Quaternion();
  function placeClouds(t) {
    clouds.forEach(function (c) {
      if (!reduce) c.lon += c.spd;
      /* 纬度上轻轻摆一下 —— 云不转，是风在推 */
      var lat = c.lat + (reduce ? 0 : Math.sin(t * 0.045 + c.ph) * 1.6);
      var n = ll2v(c.lon, lat, 1).normalize();
      n.applyAxisAngle(AXIS_Y, rotY).applyAxisAngle(AXIS_X, rotX);

      /* 法线对齐 + 自身的横躺角（后乘 = 绕本地 Z 轴转） */
      _rollQ.setFromAxisAngle(AXIS_Z, c.rot0 + (reduce ? 0 : Math.sin(t * 0.03 + c.ph) * 0.04));
      c.mesh.quaternion.setFromUnitVectors(AXIS_Z, n).multiply(_rollQ);

      /* 相机在 +Z 轴上，"云中心朝向相机的程度"就是 n.z。
         转到球的侧后方就淡出；中间过程云被地平线自然地切一半，不用提前抹掉。 */
      var k = Math.max(0, Math.min(1, (n.z - 0.02) / 0.26));
      c.mesh.visible = k > 0.02;
      c.mat.opacity = c.base * k;
    });
  }

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
    placeClouds(t);

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
      pins: out,
      clouds: clouds.map(function (c) {
        var p = ll2v(c.lon, c.lat, 1).applyAxisAngle(AXIS_Y, rotY).applyAxisAngle(AXIS_X, rotX);
        var sp = p.clone().project(camera);
        return {
          lon: +c.lon.toFixed(1),
          sx: Math.round(box.left + (sp.x * 0.5 + 0.5) * box.width),
          sy: Math.round(box.top + (-sp.y * 0.5 + 0.5) * box.height),
          onScreen: p.z > 0.06,
          op: +c.mat.opacity.toFixed(3)
        };
      }),
      /* 穿模体检：所有云冠顶点在各自当前朝向下到球心的最小距离。
         球半径是 1，这个值恒 > 1 才说明云一个点都没落进球体里。 */
      cloudMinR: (function () {
        var v = new THREE.Vector3(), min = 9;
        clouds.forEach(function (c) {
          var pos = c.mesh.geometry.attributes.position;
          for (var i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyQuaternion(c.mesh.quaternion);
            var r = v.length(); if (r < min) min = r;
          }
        });
        return +min.toFixed(4);
      })()
    };
  };

  window.addEventListener('pagehide', function () { cancelAnimationFrame(raf); });
})();
