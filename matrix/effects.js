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
