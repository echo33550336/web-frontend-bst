/* 舞台幕布：每个页面载入时先拉开幕布，再露出内容。
   - 自动启幕；点击/按键可立即跳过
   - prefers-reduced-motion 直接跳过
   - ?intro=0 用于截图和自动化 */
(function () {
  "use strict";

  if (location.search.indexOf("intro=0") > -1) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var path = location.pathname.split("/").pop() || "index.html";
  var acts = {
    "index.html": { kicker: "序章", title: "二叉搜索树", sub: "有序性是怎么被维护的" },
    "d1.html": { kicker: "第一幕", title: "插入时的比较路径", sub: "每次比较，候选区间收窄一层" },
    "d2.html": { kicker: "第二幕", title: "删除双孩子节点", sub: "为什么用中序后继替换" },
    "d3.html": { kicker: "第三幕", title: "插入顺序与树退化", sub: "同一批数据，两种形状" }
  };
  var act = acts[path] || acts["index.html"];

  var root = document.createElement("div");
  root.className = "stage-intro";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML =
    '<div class="stage-panel stage-panel-left"></div>' +
    '<div class="stage-panel stage-panel-right"></div>' +
    '<div class="stage-copy">' +
    '<p class="stage-kicker">' + act.kicker + "</p>" +
    "<h2>" + act.title + "</h2>" +
    '<p class="stage-sub">' + act.sub + "</p>" +
    '<p class="stage-hint">点击任意处启幕</p>' +
    "</div>";

  document.documentElement.classList.add("intro-lock");
  document.body.appendChild(root);

  var timers = [];
  var done = false;

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function remove() {
    if (done) return;
    done = true;
    clearTimers();
    root.remove();
    document.documentElement.classList.remove("intro-lock");
    document.documentElement.classList.add("intro-done");
  }

  function openCurtain() {
    if (done) return;
    root.classList.add("is-open");
    timers.push(setTimeout(remove, 1180));
  }

  function skip() {
    if (done) return;
    clearTimers();
    root.classList.add("is-open", "is-skip");
    timers.push(setTimeout(remove, 260));
  }

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      root.classList.add("is-visible");
    });
  });

  timers.push(setTimeout(openCurtain, 1150));
  root.addEventListener("click", skip);
  window.addEventListener("keydown", skip);
  window.addEventListener("wheel", skip, { passive: true });
  window.addEventListener("touchstart", skip, { passive: true });
})();

