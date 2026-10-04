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

  /* ============================================================ 国家面数据
     粗糙多边形，够在 1024 宽贴图上认出来即可；(lon,lat) 顺序，逆时针闭合 */
  var LAND = {
    /* —— 欧洲（坐标已加密，宽屏放大后能分辨国界） —— */
    FR: [[-1.8,43.4],[-1.2,44.6],[-1.1,45.6],[-2.1,46.8],[-2.5,47.3],[-4.8,48.0],[-3.0,48.9],[-1.6,49.7],
         [0.2,49.7],[1.6,50.2],[2.5,51.1],[4.2,50.0],[5.9,49.5],[7.6,48.6],[7.6,47.6],[7.0,47.5],
         [6.1,46.2],[6.8,45.8],[7.0,45.9],[6.6,45.1],[6.1,44.4],[7.7,43.8],[6.5,43.2],[4.8,43.4],
         [3.0,42.5],[1.7,42.5],[0.7,42.8],[-1.8,43.4]],
    BE: [[2.5,51.1],[3.5,51.4],[4.8,51.5],[5.7,51.4],[6.0,50.8],[6.4,50.3],[5.8,49.5],[5.9,49.8],
         [5.0,49.8],[4.2,50.0],[3.1,50.5],[2.5,51.1]],
    LU: [[5.7,49.5],[6.1,49.5],[6.4,49.9],[6.1,50.2],[5.8,50.1],[5.7,49.5]],
    CH: [[6.1,46.2],[6.8,46.4],[7.6,47.6],[8.5,47.6],[9.6,47.5],[10.5,46.9],[10.0,46.2],[9.0,45.8],
         [8.4,45.9],[7.0,45.9],[6.1,46.2]],
    IT: [[6.6,45.9],[7.0,45.9],[7.7,45.9],[8.4,45.9],[9.7,45.4],[10.5,45.7],[11.2,45.0],[12.4,45.6],
         [13.7,45.5],[13.5,44.8],[12.6,44.4],[13.5,43.6],[14.0,42.9],[14.4,42.0],[15.5,40.0],[16.5,39.5],
         [17.2,40.5],[18.5,40.1],[18.4,39.7],[17.2,39.1],[16.1,38.9],[15.6,38.0],[15.1,37.5],[14.0,37.6],
         [12.4,37.6],[13.0,38.2],[15.5,40.0],[14.4,42.0],[13.5,43.6],[12.6,44.4],[13.5,44.8],[13.7,45.5],
         [12.4,45.6],[11.2,45.0],[10.5,45.7],[9.7,45.4],[8.4,45.9],[7.7,45.9],[7.0,45.9],[6.6,45.9]],
    DE: [[5.9,51.0],[6.0,50.8],[6.4,50.3],[5.8,49.5],[6.4,49.5],[7.5,49.0],[8.2,48.7],[8.6,48.0],
         [9.6,47.5],[10.5,46.9],[11.0,47.4],[12.2,47.7],[13.0,48.3],[13.8,48.8],[13.5,49.5],[12.1,50.3],
         [12.5,50.4],[12.2,51.0],[14.4,51.0],[14.6,52.0],[14.6,53.0],[14.2,53.9],[12.6,54.5],[11.0,54.4],
         [9.5,54.8],[8.6,54.9],[8.5,54.3],[7.0,53.6],[7.0,52.0],[6.6,51.9],[6.2,51.8],[5.9,51.0]],
    /* —— 亚洲 —— */
    CN: [[73.5,39.4],[75.0,40.5],[76.5,41.0],[80.2,42.2],[80.2,45.0],[82.5,45.2],[83.0,47.2],[85.5,48.0],[87.8,49.2],[90.0,47.9],[96.4,42.8],[100.0,42.6],[105.0,41.8],[110.0,42.5],[111.9,43.7],[119.0,45.0],[119.9,46.6],[121.5,49.0],[126.9,49.6],[130.7,48.9],[134.7,48.4],[131.0,45.0],[131.3,42.9],[129.9,42.4],[126.0,41.6],[124.4,40.0],[121.6,39.0],[118.0,39.4],[119.0,37.3],[122.5,37.4],[120.5,35.5],[121.5,32.5],[121.8,30.9],[120.0,28.0],[117.0,24.0],[113.5,22.2],[110.0,21.4],[108.0,21.5],[106.7,21.6],[106.0,22.5],[104.0,22.7],[101.8,21.2],[99.2,22.1],[97.5,23.9],[98.5,26.0],[98.0,28.0],[96.4,29.0],[94.0,29.3],[90.0,28.1],[84.0,28.9],[79.0,32.4],[78.5,35.0],[76.0,37.0],[73.5,39.4]],
    JP: [[130.0,31.5],[131.0,30.8],[131.5,32.0],[133.0,33.5],[135.0,34.3],[136.9,34.6],[137.5,34.7],[140.0,35.6],[141.0,38.0],[141.5,41.3],[140.5,42.5],[139.5,42.0],[138.5,37.5],[136.5,36.5],[135.5,35.6],[134.5,35.7],[133.0,35.5],[131.0,34.0],[130.0,31.5]],
    MY: [[100.1,6.6],[102.0,6.3],[103.6,5.3],[103.5,3.5],[104.3,2.5],[103.4,1.4],[101.4,2.0],[100.3,3.5],[100.1,6.6]],
    MYB: [[109.6,1.6],[110.5,1.0],[113.0,1.5],[115.5,3.0],[117.6,4.2],[119.2,5.5],[117.0,5.9],[115.0,5.0],[112.5,3.2],[109.6,1.6]],
    TH: [[99.2,22.1],[100.1,20.5],[101.0,19.5],[100.5,18.0],[101.5,16.5],[102.5,15.0],[105.5,14.4],[105.6,12.0],[104.8,10.5],[102.5,12.2],[100.9,13.5],[100.0,13.5],[99.5,11.0],[100.3,7.0],[100.1,6.6],[99.0,8.0],[98.5,11.5],[97.5,16.5],[98.5,19.5],[99.2,22.1]],
    AE: [[51.6,24.2],[54.5,24.4],[56.0,25.0],[56.4,25.8],[56.0,26.1],[54.0,24.1],[52.6,23.0],[51.6,24.2]]
  };

  /* 国家主色（夜色友好的低饱和调） */
  var FILL = {
    default: '#2f6f63', visited: '#3f8f74', cn: '#b4553f',
    FR: '#4a6f9e', BE: '#8a5a86', LU: '#6f7f9a', CH: '#a8504a',
    IT: '#57906f', DE: '#7d6ea0', JP: '#a85e7a', MY: '#7d9a5a',
    TH: '#b08a4a', AE: '#a08048'
  };
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
    function poly(pts, fill) {
      g.beginPath();
      for (var i = 0; i < pts.length; i++) {
        var p = px(pts[i][0], pts[i][1]);
        if (i === 0) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]);
      }
      g.closePath(); g.fillStyle = fill; g.fill();
      g.strokeStyle = 'rgba(190,255,232,.42)'; g.lineWidth = 1.1; g.stroke();
    }

    /* 其它大陆：用真实海岸线的简化坐标（约 1°~4° 精度），
       够在 1024 宽的等距圆柱贴图上认出"这是地球"即可。 */
    var NEUTRAL = '#28604f';
    var OTHER = [
      /* 北美（含阿拉斯加、哈德逊湾、佛罗里达、下加利福尼亚） */
      [[-168,66],[-164,70],[-156,71],[-140,70],[-128,70],[-115,69],[-105,68],[-95,68],[-85,66],[-80,63],
       [-78,58],[-79,52],[-83,52],[-88,56],[-95,58],[-92,55],[-85,50],[-79,48],[-70,47],[-64,46],[-60,47],
       [-66,44],[-70,42],[-74,40],[-76,35],[-81,31],[-80,25],[-84,30],[-88,30],[-94,29],[-97,26],[-98,21],
       [-95,16],[-92,15],[-88,16],[-87,13],[-83,9],[-79,9],[-83,13],[-87,17],[-91,19],[-96,20],[-105,21],
       [-110,24],[-114,28],[-115,32],[-118,34],[-122,37],[-124,42],[-124,48],[-130,54],[-135,58],[-145,60],
       [-152,58],[-160,56],[-166,60],[-168,66]],
      /* 南美（含巴西东突、合恩角） */
      [[-81,-4],[-79,2],[-77,8],[-72,12],[-64,11],[-60,8],[-52,5],[-49,0],[-44,-2],[-38,-5],[-35,-8],
       [-39,-14],[-41,-22],[-48,-25],[-54,-34],[-58,-38],[-62,-40],[-65,-45],[-68,-52],[-73,-54],[-75,-51],
       [-74,-44],[-73,-37],[-71,-30],[-70,-20],[-71,-14],[-75,-14],[-78,-8],[-81,-4]],
      /* 非洲（含几内亚湾、索马里角、好望角） */
      [[-17,15],[-17,21],[-13,27],[-10,31],[-6,36],[0,36],[10,37],[11,33],[18,31],[25,32],[32,31],
       [35,28],[37,22],[39,15],[43,12],[51,12],[51,6],[45,3],[42,-1],[40,-8],[40,-16],[35,-24],[32,-29],
       [26,-34],[20,-35],[18,-33],[15,-27],[12,-18],[13,-12],[9,-1],[9,4],[3,6],[-3,5],[-8,4],[-13,9],
       [-17,15]],
      /* 欧洲大陆（伊比利亚、意大利靴、巴尔干、斯堪的纳维亚、波罗的海） */
      [[-9,38],[-9,43],[-2,44],[0,47],[-4,48],[-1,49],[2,51],[4,53],[8,54],[10,54],[8,57],[11,58],
       [13,56],[19,55],[22,57],[24,60],[22,63],[18,66],[21,70],[28,71],[32,70],[40,67],[40,60],[35,60],
       [30,60],[28,56],[24,54],[20,54],[19,50],[24,50],[28,46],[29,45],[28,42],[26,40],[23,38],[24,36],
       [21,37],[19,40],[16,41],[18,41],[14,45],[13,43],[16,42],[12,44],[10,44],[12,46],[8,44],[4,43],
       [3,42],[0,39],[-2,37],[-6,36],[-9,38]],
      /* 印度次大陆 */
      [[68,24],[70,21],[72,20],[73,16],[77,8],[80,10],[80,14],[83,18],[87,21],[89,22],[92,22],[90,25],
       [88,26],[84,27],[80,29],[76,31],[72,29],[68,24]],
      /* 澳大利亚（含卡奔塔利亚湾、大澳洲湾） */
      [[114,-22],[113,-26],[115,-34],[118,-35],[124,-33],[129,-32],[134,-33],[137,-35],[140,-38],[145,-38],
       [147,-43],[150,-37],[153,-28],[153,-25],[149,-21],[146,-19],[143,-14],[142,-11],[136,-12],[132,-12],
       [130,-13],[126,-14],[122,-17],[114,-22]],
      /* 格陵兰 */
      [[-43,60],[-50,62],[-53,66],[-58,70],[-60,76],[-55,82],[-40,83],[-25,80],[-20,74],[-24,70],[-33,66],[-43,60]],
      /* 不列颠 + 爱尔兰 */
      [[-5,50],[0,51],[1,53],[-1,54],[-3,58],[-5,58],[-6,55],[-4,54],[-5,52],[-5,50]],
      [[-10,52],[-6,52],[-6,55],[-10,55],[-10,52]],
      /* 新几内亚、苏门答腊、加里曼丹、菲律宾、日本本州补充 */
      [[131,-1],[140,-3],[147,-6],[151,-10],[147,-9],[141,-9],[137,-8],[132,-5],[131,-1]],
      [[99,6],[103,1],[106,-6],[102,-6],[100,-3],[95,3],[99,6]],
      [[109,2],[114,5],[119,5],[119,0],[116,-4],[110,-3],[109,2]],
      [[120,18],[124,18],[126,10],[122,6],[120,12],[120,18]],
      /* 斯里兰卡、马达加斯加、新西兰、冰岛 */
      [[80,10],[82,7],[80,6],[79,9],[80,10]],
      [[43,-12],[50,-15],[50,-25],[45,-25],[43,-20],[43,-12]],
      [[173,-35],[178,-38],[174,-41],[171,-44],[166,-46],[168,-43],[172,-37],[173,-35]],
      [[-24,66],[-14,66],[-14,64],[-20,63],[-24,66]]
    ];
    for (var i = 0; i < OTHER.length; i++) poly(OTHER[i], NEUTRAL);

    /* 已到访国家高亮 */
    Object.keys(LAND).forEach(function (k) {
      var isVisited = !!DATA[k.toLowerCase()] || k === 'CN';
      poly(LAND[k], isVisited ? (FILL_VISITED[k] || FILL.visited) : (FILL[k] || FILL.default));
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
  window.__globeHome = function () { focusOn(9, 34, 3.15, false); };

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
  focusOn(9, 34, 3.15, false);

  /* 暴露给"重置"按钮 */
  window.__globeReset = function () { closeCard(); window.__globeHome(); };

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
