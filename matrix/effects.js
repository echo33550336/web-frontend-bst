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
      '<div class="ending-visual" aria-hidden="true">' +
        '<canvas class="ending-dna"></canvas>' +
        '<span class="ending-dna-label">BINARY SEARCH TREE / 03</span>' +
      '</div>' +
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

  /* 结语右侧的树形动态图：只在面板打开时绘制 */
  var dnaCanvas = overlay.querySelector(".ending-dna");
  var dnaRaf = 0, dnaStart = 0;
  var dnaReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function drawTree(ts) {
    if (!dnaCanvas) return;
    var w = dnaCanvas.clientWidth, h = dnaCanvas.clientHeight;
    if (!w || !h) { dnaRaf = requestAnimationFrame(drawTree); return; }
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (dnaCanvas.width !== Math.round(w * dpr) || dnaCanvas.height !== Math.round(h * dpr)) {
      dnaCanvas.width = Math.round(w * dpr);
      dnaCanvas.height = Math.round(h * dpr);
    }
    var ctx = dnaCanvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!dnaStart) dnaStart = ts || 0;
    var time = dnaReduced ? 2.6 : (ts - dnaStart) / 1000;
    var grow = dnaReduced ? 1 : Math.min(1, time / 1.4);
    var ease = 1 - Math.pow(1 - grow, 3);

    var layout = [
      [0.50, 0.12, 50, -1],
      [0.28, 0.35, 30, 0],
      [0.72, 0.35, 70, 0],
      [0.15, 0.58, 20, 1],
      [0.41, 0.58, 40, 1],
      [0.60, 0.58, 60, 2],
      [0.85, 0.58, 80, 2],
      [0.63, 0.81, 65, 5]
    ];
    var pathSet = { 0: 1, 2: 1, 5: 1, 7: 1 };
    var nodes = layout.map(function (n) {
      return { x: w * n[0], y: h * n[1], v: n[2], p: n[3] };
    });

    var cx = w * 0.5, cy = h * 0.48;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(time * 0.16) * 0.012);
    ctx.translate(-cx, -cy);

    /* 背景轨道与光晕 */
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(184,156,255,0.10)";
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.47, w * 0.44, h * 0.39, -0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(143,227,255,0.07)";
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.47, w * 0.36, h * 0.32, 0.22, 0, Math.PI * 2);
    ctx.stroke();

    function bevel(a, b, t) {
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 10;
      var u = 1 - t;
      return [u * u * a.x + 2 * u * t * mx + t * t * b.x, u * u * a.y + 2 * u * t * my + t * t * b.y];
    }

    /* 枝干：从根向外生长，再持续轻微呼吸 */
    var i, t, p, q, pt;
    for (i = 1; i < nodes.length; i++) {
      var a = nodes[nodes[i].p], b = nodes[i];
      var hot = pathSet[i] && pathSet[nodes[i].p];
      var delay = 0.1 + (b.y / h) * 0.35;
      var edgeGrow = Math.max(0, Math.min(1, (ease - delay) / (1 - delay)));
      if (edgeGrow <= 0) continue;
      pt = [];
      for (t = 0; t <= 24; t++) {
        p = (t / 24) * edgeGrow;
        pt.push(bevel(a, b, p));
      }
      ctx.beginPath();
      ctx.moveTo(pt[0][0], pt[0][1]);
      for (q = 1; q < pt.length; q++) ctx.lineTo(pt[q][0], pt[q][1]);
      ctx.lineWidth = hot ? 1.9 : 1.25;
      ctx.strokeStyle = hot ? "rgba(255,158,210,0.78)" : "rgba(184,156,255,0.48)";
      ctx.shadowColor = hot ? "rgba(255,158,210,0.55)" : "rgba(143,227,255,0.35)";
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      /* 沿枝干流动的光点 */
      if (edgeGrow > 0.6 && !dnaReduced) {
        for (var k = 0; k < 2; k++) {
          var flow = (time * 0.32 + (i * 0.21) + k * 0.5) % 1;
          if (flow > edgeGrow) continue;
          var fp = bevel(a, b, flow);
          ctx.beginPath();
          ctx.fillStyle = hot ? "rgba(255,196,226,0.9)" : "rgba(196,240,255,0.85)";
          ctx.shadowColor = hot ? "#ff9ed2" : "#8fe3ff";
          ctx.shadowBlur = 12;
          ctx.arc(fp[0], fp[1], 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    }

    /* 节点 */
    for (i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var appear = Math.max(0, Math.min(1, (ease - (n.y / h) * 0.35) / 0.35));
      if (appear <= 0.02) continue;
      var hotNode = pathSet[i];
      var base = hotNode ? [255, 158, 210] : [184, 156, 255];
      var pulse = 0.5 + 0.5 * Math.sin(time * 1.25 + i * 0.7);
      var r = (11.5 + pulse * 1.2) * appear;
      var halo = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 3.1);
      halo.addColorStop(0, "rgba(" + base[0] + "," + base[1] + "," + base[2] + ",0.32)");
      halo.addColorStop(1, "rgba(" + base[0] + "," + base[1] + "," + base[2] + ",0)");
      ctx.beginPath();
      ctx.fillStyle = halo;
      ctx.arc(n.x, n.y, r * 3.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = "rgba(9,8,20,0.94)";
      ctx.strokeStyle = "rgba(" + base[0] + "," + base[1] + "," + base[2] + ",0.92)";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "rgba(" + base[0] + "," + base[1] + "," + base[2] + ",0.6)";
      ctx.shadowBlur = 12;
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (appear > 0.65) {
        ctx.fillStyle = "rgba(238,233,255,0.92)";
        ctx.font = "600 11px ui-monospace, SFMono-Regular, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(n.v), n.x, n.y + 0.5);
      }
    }

    /* 边缘漂浮微粒，呼应专辑封面的颗粒感 */
    for (i = 0; i < 18; i++) {
      var ax = (Math.sin(i * 12.9898 + time * 0.14) * 0.5 + 0.5) * w;
      var ay = (Math.cos(i * 78.233 + time * 0.09) * 0.5 + 0.5) * h;
      ctx.beginPath();
      ctx.fillStyle = i % 3 ? "rgba(143,227,255,0.22)" : "rgba(255,158,210,0.24)";
      ctx.arc(ax, ay, i % 4 === 0 ? 1.6 : 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    dnaRaf = requestAnimationFrame(drawTree);
  }

  function startDna() {
    if (!dnaCanvas || dnaRaf) return;
    if (dnaReduced) { drawTree(0); return; }
    dnaRaf = requestAnimationFrame(drawTree);
  }
  function stopDna() {
    if (dnaRaf) cancelAnimationFrame(dnaRaf);
    dnaRaf = 0;
  }

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
    startDna();
    setTimeout(function () {
      var closeBtn = overlay.querySelector(".ending-close");
      if (closeBtn) closeBtn.focus();
    }, 80);
  }
  function close() {
    overlay.classList.remove("is-open");
    document.documentElement.classList.remove("ending-lock");
    stopDna();
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




