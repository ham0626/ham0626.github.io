/* 仓库链接体检：给 <a data-repo="owner/name"> 的链接探一下 GitHub。
   仓库还没建 / 是私有的（两者都返回 404）→ 标灰并改文案，避免访客点到死链。
   建好之后刷新页面就会自动恢复正常，不用改代码。
   网络不通或撞上限流 → 什么都不做，链接保持原样。

   暴露 window.HAM_REPO_CHECK(root)：详情弹层这类"事后插入 DOM"的场景，
   插入完成后手动调一次即可，不用重新扫全站。 */
(function () {
  'use strict';

  function check(root) {
    if (!window.fetch) return;
    var els = (root || document).querySelectorAll('a[data-repo]');
    if (!els.length) return;

    function setText(a, t) {
      var n = a.firstChild;
      if (n && n.nodeType === 3) n.nodeValue = t;
    }

    Array.prototype.forEach.call(els, function (a) {
      var repo = a.getAttribute('data-repo');
      if (!repo || a.dataset.repoChecked === '1') return;   // 已经查过的不重复请求
      a.dataset.repoChecked = '1';
      fetch('https://api.github.com/repos/' + repo, { cache: 'no-store' })
        .then(function (r) {
          if (r.status === 404) {
            a.classList.add('dim');
            a.setAttribute('title', 'github.com/' + repo + ' 还没建好，或者是私有仓库');
            setText(a, '仓库还没公开');
          } else if (r.ok) {
            return r.json().then(function (j) {
              a.classList.remove('dim');
              var bits = [];
              if (j.language) bits.push(j.language);
              if (j.stargazers_count) bits.push('★ ' + j.stargazers_count);
              a.setAttribute('title', bits.length ? bits.join(' · ')
                : 'github.com/' + repo);
            });
          }
        })
        .catch(function () { /* 网络不通 / 限流：保持原样，链接照样能点 */ });
    });
  }

  window.HAM_REPO_CHECK = check;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { check(document); });
  } else {
    check(document);
  }
})();
