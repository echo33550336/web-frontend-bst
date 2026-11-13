/* matrix/transition.js —— 步骤文字 / 状态变化的轻量转场（不改变任何业务逻辑） */
(function () {
  var targets = document.querySelectorAll("#panel-step, #panel-conclusion, #status");
  for (var i = 0; i < targets.length; i++) {
    (function (el) {
      var scheduled = false;
      var observer = new MutationObserver(function () {
        if (scheduled) {
          return;
        }
        scheduled = true;
        requestAnimationFrame(function () {
          scheduled = false;
          el.classList.remove("is-updating");
          void el.offsetWidth;
          el.classList.add("is-updating");
        });
      });
      observer.observe(el, { childList: true, subtree: true, characterData: true });
    })(targets[i]);
  }
})();
