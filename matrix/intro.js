/* 塔罗牌启幕：等待点击后翻牌，再拉开星空幕布。
   - 点击 / 按键 / 滚轮 / 触摸后开始，不再自动跳转
   - prefers-reduced-motion 与 ?intro=0 直接跳过 */
(function () {
  "use strict";

  if (location.search.indexOf("intro=0") > -1) {
    document.documentElement.classList.remove("intro-pending");
    return;
  }
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.documentElement.classList.remove("intro-pending");
    return;
  }

  var path = location.pathname.split("/").pop() || "index.html";
  var acts = {
    "index.html": { numeral: "0", arcana: "THE FOOL", kicker: "序章", title: "二叉搜索树", sub: "有序性是怎么被维护的" },
    "d1.html": { numeral: "I", arcana: "THE MAGICIAN", kicker: "第一幕", title: "插入时的比较路径", sub: "每次比较，候选区间收窄一层" },
    "d2.html": { numeral: "XIII", arcana: "DEATH", kicker: "第二幕", title: "删除双孩子节点", sub: "为什么用中序后继替换" },
    "d3.html": { numeral: "XVI", arcana: "THE TOWER", kicker: "第三幕", title: "插入顺序与树退化", sub: "同一批数据，两种形状" }
  };
  var act = acts[path] || acts["index.html"];

  var art =
    '<svg viewBox="0 0 200 150" role="presentation" aria-hidden="true">' +
    '<defs><radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">' +
    '<stop offset="0%" stop-color="#d3c2ff" stop-opacity="0.45"/>' +
    '<stop offset="100%" stop-color="#d3c2ff" stop-opacity="0"/>' +
    "</radialGradient></defs>" +
    '<circle cx="100" cy="52" r="34" fill="url(#moonGlow)"/>' +
    '<circle cx="100" cy="52" r="21" fill="none" stroke="#b89cff" stroke-width="0.8"/>' +
    '<circle cx="107" cy="48" r="18" fill="#0d0a18"/>' +
    '<g stroke="#9d92bd" stroke-width="0.8" fill="none">' +
    '<line x1="100" y1="73" x2="100" y2="100"/>' +
    '<line x1="100" y1="100" x2="56" y2="124"/><line x1="100" y1="100" x2="144" y2="124"/>' +
    "</g>" +
    '<g fill="#0d0a18" stroke="#b89cff" stroke-width="0.9">' +
    '<circle cx="100" cy="100" r="9"/><circle cx="56" cy="124" r="8"/><circle cx="144" cy="124" r="8"/>' +
    "</g>" +
    '<g fill="#d3c2ff">' +
    '<path d="M158 34l1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4-4.4-1.6 4.4-1.6z"/>' +
    '<circle cx="38" cy="46" r="1.3"/><circle cx="66" cy="28" r="1"/><circle cx="170" cy="76" r="1.1"/>' +
    "</g>" +
    '<line x1="34" y1="138" x2="166" y2="138" stroke="#4b3f68" stroke-width="0.6"/>' +
    "</svg>";

  var root = document.createElement("div");
  root.className = "stage-intro";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML =
    '<div class="stage-panel stage-panel-left"></div>' +
    '<div class="stage-panel stage-panel-right"></div>' +
    '<div class="tarot-stage">' +
    '<div class="tarot-card">' +
    '<div class="tarot-face tarot-back"><span class="tarot-seal">✦</span><i></i><i></i><i></i><i></i></div>' +
    '<div class="tarot-face tarot-front">' +
    '<div class="tarot-top"><span class="tarot-numeral">' + act.numeral + '</span><span class="tarot-arcana">' + act.arcana + "</span></div>" +
    '<div class="tarot-art">' + art + "</div>" +
    '<div class="tarot-bottom"><p class="tarot-kicker">' + act.kicker + "</p><h2>" + act.title + "</h2><p>" + act.sub + "</p></div>" +
    '<div class="tarot-rule"><span>BINARY SEARCH TREE</span></div>' +
    "</div>" +
    "</div>" +
    '<p class="tarot-hint">点击翻牌启幕</p>' +
    "</div>";

  document.documentElement.classList.add("intro-lock");
  document.body.appendChild(root);
  document.documentElement.classList.add("intro-active");
  document.documentElement.classList.remove("intro-pending");

  var timers = [];
  var done = false;
  var opening = false;

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
    document.documentElement.classList.remove("intro-active");
    document.documentElement.classList.remove("intro-pending");
    document.documentElement.classList.add("intro-done");
  }
  function begin() {
    if (done || opening) return;
    opening = true;
    clearTimers();
    root.classList.add("is-flip");
    timers.push(setTimeout(function () {
      root.classList.add("is-open");
      timers.push(setTimeout(remove, 1250));
    }, 720));
  }

  requestAnimationFrame(function () {
    requestAnimationFrame(function () { root.classList.add("is-visible"); });
  });
  root.addEventListener("click", begin);
  window.addEventListener("keydown", begin);
  window.addEventListener("wheel", begin, { passive: true });
  window.addEventListener("touchstart", begin, { passive: true });
})();



