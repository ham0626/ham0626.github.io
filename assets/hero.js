/* 首页 hero：逐字模糊渐入（BlurText 的原生实现）+ 副标题/按钮组延迟渐入 + 可选背景视频
   —— 不依赖 React / Framer Motion，纯 DOM + CSS 动画。 */
(function () {
  'use strict';

  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. 逐字模糊渐入 ---------- */
  function splitChars(el) {
    var out = [];
    var nodes = Array.prototype.slice.call(el.childNodes);
    var frag = document.createDocumentFragment();
    nodes.forEach(function (n) {
      if (n.nodeType === 3) {
        var t = n.nodeValue;
        for (var i = 0; i < t.length; i++) {
          var c = t[i];
          if (c === '\n' || c === '\t' || c === '\r') continue;
          var s = document.createElement('span');
          s.className = 'bw';
          s.textContent = (c === ' ') ? '\u00A0' : c;
          frag.appendChild(s);
          out.push(s);
        }
      } else if (n.nodeName === 'BR') {
        frag.appendChild(document.createElement('br'));
      } else {
        frag.appendChild(n.cloneNode(true));
      }
    });
    el.textContent = '';
    el.appendChild(frag);
    return out;
  }

  function runBlurText() {
    var els = document.querySelectorAll('[data-blur]');
    Array.prototype.forEach.call(els, function (el) {
      var chars = splitChars(el);
      if (REDUCED) { el.classList.add('bt-go'); return; }
      var start = Number(el.getAttribute('data-blur-delay') || 240);
      var step = Number(el.getAttribute('data-blur-step') || 45);
      chars.forEach(function (s, i) {
        s.style.animationDelay = (start + i * step) + 'ms';
      });
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { el.classList.add('bt-go'); });
      });
    });
  }

  /* ---------- 2. 副标题 / 按钮组：延迟渐入 ---------- */
  function runFadeBlur() {
    var els = document.querySelectorAll('.fade-blur');
    Array.prototype.forEach.call(els, function (el, i) {
      if (REDUCED) { el.classList.add('in'); return; }
      var d = Number(el.getAttribute('data-delay') || (900 + i * 250));
      el.style.transitionDelay = d + 'ms';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { el.classList.add('in'); });
      });
    });
  }

  /* ---------- 3. 可选的背景视频 ----------
     用法：给 <header class="hero"> 加 data-hero-video="assets/img/xxx.mp4"，
           再加 data-hero-poster="assets/img/xxx.jpg"（可选）。
     没设置就不创建任何 video 元素 —— 不会有多余请求，也不会 404。 */
  function mountVideo() {
    var hero = document.querySelector('.hero[data-hero-video]');
    if (!hero) return;
    var src = hero.getAttribute('data-hero-video');
    var poster = hero.getAttribute('data-hero-poster') || '';
    var v = document.createElement('video');
    v.className = 'hero__video';
    v.autoplay = true; v.loop = true; v.muted = true;
    v.playsInline = true; v.preload = 'auto';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    if (poster) v.poster = poster;
    v.src = src;
    hero.insertBefore(v, hero.firstChild);
    var p = v.play();
    if (p && p.catch) p.catch(function () { /* 自动播放被拦：静音视频一般不会被拦，兜底忽略 */ });
  }

  function boot() {
    try { mountVideo(); } catch (e) { }
    try { runBlurText(); } catch (e) { }
    try { runFadeBlur(); } catch (e) { }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();
})();
