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

/* 第三幕结尾：固定层结束页，不占页面高度 */
(function () {
  var act = location.pathname.split("/").pop() || "";
  if (act !== "d3.html") return;
  if (document.querySelector(".ending-screen")) return;

  var overlay = document.createElement("div");
  overlay.className = "ending-screen";
  overlay.innerHTML =
    '<div class="ending" role="dialog" aria-modal="true" aria-labelledby="ending-title">' +
      '<button class="ending-close" type="button" aria-label="关闭结语">×</button>' +
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
        '<p class="ending-meta"><span>Web 前端开发课程项目 · 张格靓</span><span>纯静态页面 · 无第三方运行时依赖</span></p>' +
      '</div>' +
      '<span class="ending-mark" aria-hidden="true">✦</span>' +
    '</div>';
  document.body.appendChild(overlay);

  var openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "ending-open";
  openBtn.textContent = "结语";
  var nav = document.querySelector(".page-nav");
  if (nav) {
    nav.appendChild(openBtn);
  }

  function open() {
    overlay.classList.add("is-open");
    document.documentElement.classList.add("ending-lock");
    setTimeout(function () {
      var closeBtn = overlay.querySelector(".ending-close");
      if (closeBtn) closeBtn.focus();
    }, 80);
  }
  function close() {
    overlay.classList.remove("is-open");
    document.documentElement.classList.remove("ending-lock");
  }

  overlay.addEventListener("click", function (event) {
    if (event.target === overlay || event.target.closest(".ending-close")) close();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") close();
  });
  openBtn.addEventListener("click", open);

  var opened = false;
  var tries = 0;
  var timer = setInterval(function () {
    var status = document.getElementById("status");
    var next = document.getElementById("btn-next");
    if (!opened && status && /20\s*\/\s*20/.test(status.textContent) && next && next.disabled) {
      opened = true;
      clearInterval(timer);
      setTimeout(open, 900);
    }
    if (++tries > 1200) clearInterval(timer);
  }, 400);
})();



// 第三幕：折线图默认收起，点「折线图」在遮罩中放大查看
(function initChartPeek() {
  if (!document.body.classList.contains("d3")) return;
  var chart = document.querySelector(".chart-block");
  var transport = document.querySelector(".transport");
  if (!chart || !transport) return;

  var backdrop = document.createElement("div");
  backdrop.className = "chart-backdrop";
  document.body.appendChild(backdrop);

  var openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.id = "btn-chart";
  openBtn.className = "chart-toggle";
  openBtn.textContent = "折线图";
  var anchor = transport.querySelector("#btn-next") || transport.lastElementChild;
  anchor.insertAdjacentElement("afterend", openBtn);

  var closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "chart-close";
  closeBtn.textContent = "关闭";
  chart.appendChild(closeBtn);

  var homeParent = chart.parentNode;
  var homeNext = chart.nextSibling;
  function closeEnding() {
    var ending = document.querySelector(".ending-screen.is-open");
    if (ending) ending.classList.remove("is-open");
    document.documentElement.classList.remove("ending-lock");
  }
  function open() {
    closeEnding();
    if (chart.classList.contains("chart-peer")) return;
    document.body.appendChild(chart);
    chart.classList.add("chart-peer");
    document.body.classList.add("chart-open");
  }
  function close() {
    document.body.classList.remove("chart-open");
    chart.classList.remove("chart-peer");
    if (homeNext && homeNext.parentNode === homeParent) {
      homeParent.insertBefore(chart, homeNext);
    } else {
      homeParent.appendChild(chart);
    }
  }

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") close();
  });
})();




