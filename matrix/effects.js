/* 参考站微交互：顶部阅读进度 + 画布跟随光斑（装饰，不阻断交互） */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 阅读进度：固定 2px 渐变条 */
  var bar = document.createElement("div");
  bar.className = "scroll-progress";
  bar.setAttribute("aria-hidden", "true");
  document.body.appendChild(bar);

  var ticking = false;
  function updateScroll() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    document.documentElement.style.setProperty("--scroll", ratio.toFixed(4));
    document.documentElement.style.setProperty("--scroll-y", Math.round(window.scrollY) + "px");
    ticking = false;
  }
  function onScroll() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(updateScroll);
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  updateScroll();

  /* 光斑跟随鼠标：只在桌面且未开启减少动态时启用 */
  if (reduceMotion || !window.matchMedia("(pointer: fine)").matches) {
    return;
  }
  var stage = document.querySelector(".stage");
  if (!stage) {
    return;
  }
  var frame = 0;
  var lastX = 50;
  var lastY = 38;
  stage.addEventListener(
    "pointermove",
    function (event) {
      var rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }
      lastX = ((event.clientX - rect.left) / rect.width) * 100;
      lastY = ((event.clientY - rect.top) / rect.height) * 100;
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(function () {
        frame = 0;
        stage.style.setProperty("--mx", lastX.toFixed(2) + "%");
        stage.style.setProperty("--my", lastY.toFixed(2) + "%");
      });
    },
    { passive: true }
  );
  stage.addEventListener("pointerleave", function () {
    stage.style.setProperty("--mx", "50%");
    stage.style.setProperty("--my", "38%");
  });
})();


/* 页面金色描边与外框角饰 */
(function () {
  if (document.querySelector(".gold-frame")) return;
  var frame = document.createElement("div");
  frame.className = "gold-frame";
  frame.setAttribute("aria-hidden", "true");
  frame.innerHTML =
    '<i class="gold-corner tl"></i>' +
    '<i class="gold-corner tr"></i>' +
    '<i class="gold-corner bl"></i>' +
    '<i class="gold-corner br"></i>' +
    '<i class="gold-center top"></i>' +
    '<i class="gold-center bottom"></i>';
  document.body.appendChild(frame);
})();

/* 页面收束：三页走完后的结束段落（统一注入，避免四份 HTML 重复） */
(function () {
  if (document.querySelector(".ending")) return;
  var main = document.querySelector("main");
  if (!main) return;
  var section = document.createElement("section");
  section.className = "ending";
  section.setAttribute("aria-labelledby", "ending-title");
  section.innerHTML =
    '<div class="ending-inner">' +
      '<p class="ending-kicker">END · 结语</p>' +
      '<h2 id="ending-title">规则没有变，<br>树长成了不同的样子。</h2>' +
      '<p class="ending-copy">位置由比较路径决定，结构由删除维护，代价由插入顺序决定。三个难点走完，回到最开始那条规则：左边全小、右边全大。</p>' +
      '<div class="ending-actions">' +
        '<a class="ending-primary" href="index.html">回到首页 →</a>' +
        '<a href="../docs/演示脚本.md">演示脚本</a>' +
        '<a href="../docs/期末报告.md">期末报告</a>' +
        '<a href="README.md">README</a>' +
        '<a href="https://echo33550336.github.io/web-frontend-bst/" target="_blank" rel="noopener">在线访问 ↗</a>' +
      '</div>' +
      '<p class="ending-meta"><span>Web 前端开发课程项目 · 张格颖</span><span>纯静态页面 · 无第三方运行时依赖</span></p>' +
    '</div>' +
    '<span class="ending-mark" aria-hidden="true">✦</span>';
  var footer = document.querySelector(".site-footer");
  if (footer && footer.parentNode) {
    footer.parentNode.insertBefore(section, footer);
  } else {
    main.appendChild(section);
  }
})();

