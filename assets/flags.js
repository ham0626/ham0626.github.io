/* flags.js —— 内联 SVG 国旗（零依赖、跨平台一致）
   为什么不用 emoji：Windows 默认字体链缺彩色 emoji 字体，
   "🇫🇷" 会被回退渲染成 "FR" 两个字母。
   用法：flagSVG('FR') → 返回 <span class="flag">…svg…</span> */
(function () {
  'use strict';
  /* 每个国旗用 4:3 视窗 24×18 简化绘制，识别度优先于精确比例 */
  var F = {
    FR: '<rect width="24" height="18" fill="#fff"/><rect width="8" height="18" fill="#0055A4"/><rect x="16" width="8" height="18" fill="#EF4135"/>',
    BE: '<rect width="24" height="18" fill="#FDDA24"/><rect width="8" height="18" fill="#000"/><rect x="16" width="8" height="18" fill="#EF3340"/>',
    CH: '<rect width="24" height="18" fill="#DA291C"/><rect x="10.5" y="3.5" width="3" height="11" fill="#fff"/><rect x="6.5" y="7.5" width="11" height="3" fill="#fff"/>',
    IT: '<rect width="24" height="18" fill="#fff"/><rect width="8" height="18" fill="#009246"/><rect x="16" width="8" height="18" fill="#CE2B37"/>',
    DE: '<rect width="24" height="6" fill="#000"/><rect y="6" width="24" height="6" fill="#DD0000"/><rect y="12" width="24" height="6" fill="#FFCE00"/>',
    LU: '<rect width="24" height="6" fill="#ED2939"/><rect y="6" width="24" height="6" fill="#fff"/><rect y="12" width="24" height="6" fill="#00A1DE"/>',
    AE: '<rect width="24" height="6" fill="#00843D"/><rect y="6" width="24" height="6" fill="#fff"/><rect y="12" width="24" height="6" fill="#000"/><rect width="6" height="18" fill="#FF0000"/>',
    JP: '<rect width="24" height="18" fill="#fff"/><circle cx="12" cy="9" r="5.2" fill="#BC002D"/>',
    MY: '<rect width="24" height="18" fill="#fff"/>' +
        '<rect width="24" height="2" y="0" fill="#CC0001"/><rect width="24" height="2" y="2" fill="#fff"/>' +
        '<rect width="24" height="2" y="4" fill="#CC0001"/><rect width="24" height="2" y="6" fill="#fff"/>' +
        '<rect width="24" height="2" y="8" fill="#CC0001"/><rect width="24" height="2" y="10" fill="#fff"/>' +
        '<rect width="24" height="2" y="12" fill="#CC0001"/><rect width="24" height="2" y="14" fill="#fff"/>' +
        '<rect width="24" height="2" y="16" fill="#CC0001"/><rect width="24" height="2" y="18" fill="#fff"/>' +
        '<rect width="12" height="10" fill="#010066"/>' +
        '<circle cx="6" cy="5" r="3.1" fill="#FFCC00"/><circle cx="7.4" cy="5" r="2.6" fill="#010066"/>',
    TH: '<rect width="24" height="18" fill="#A51931"/><rect y="3" width="24" height="12" fill="#F4F5F8"/><rect y="6" width="24" height="6" fill="#2D2A4A"/>',
    CN: '<rect width="24" height="18" fill="#EE1C25"/>' +
        '<path d="M4.2 3.2 5.05 5.7 7.6 5.7 5.55 7.2 6.3 9.7 4.2 8.2 2.1 9.7 2.85 7.2 0.8 5.7 3.35 5.7Z" fill="#FFDE00"/>' +
        '<circle cx="8.6" cy="2.7" r="0.85" fill="#FFDE00"/><circle cx="10.3" cy="4.3" r="0.85" fill="#FFDE00"/>' +
        '<circle cx="10.3" cy="6.6" r="0.85" fill="#FFDE00"/><circle cx="8.6" cy="8.2" r="0.85" fill="#FFDE00"/>'
  };

  function flagSVG(code, cls) {
    var body = F[code] || '<rect width="24" height="18" fill="#2f6f63"/>';
    return '<span class="flag ' + (cls || '') + '" role="img" aria-label="' + code + '">' +
      '<svg viewBox="0 0 24 18" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">' +
      body + '</svg></span>';
  }
  window.flagSVG = flagSVG;

  /* 自动填充所有 <span data-flag="FR"></span> */
  window.fillFlags = function (root) {
    (root || document).querySelectorAll('[data-flag]').forEach(function (el) {
      var c = el.getAttribute('data-flag');
      el.innerHTML = flagSVG(c).replace(/^<span class="flag [^"]*"[^>]*>|<\/span>$/g, '');
    });
  };
})();
