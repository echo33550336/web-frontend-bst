/* 星空与旋涡星系背景（canvas，纯装饰）
   - 星点缓慢闪烁，星系缓慢自转
   - 支持 prefers-reduced-motion：只画一帧
   - 页面隐藏时暂停 */
(function () {
  "use strict";

  var canvas = document.getElementById("galaxy");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var w = 0, h = 0;
  var stars = [];
  var dust = [];
  var parts = [];
  var galaxy2 = { x: 0, y: 0, r: 0 };
  var parts2 = [];
  var galaxy = { x: 0.72, y: 0.32, r: 0.42 };
  var pointer = { x: 0, y: 0 };
  var scrollShift = 0;
  var raf = 0;
  var last = 0;
  var t0 = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function build() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    galaxy.x = w > 900 ? 0.78 : 0.86;
    galaxy.y = w > 900 ? 0.13 : 0.1;
    galaxy.r = Math.min(w, h) * (w > 900 ? 0.29 : 0.38);
    galaxy2.x = w > 900 ? 0.15 : 0.78;
    galaxy2.y = w > 900 ? 0.82 : 0.9;
    galaxy2.r = Math.min(w, h) * (w > 900 ? 0.16 : 0.16);

    stars = [];
    var starCount = Math.round(Math.min(420, (w * h) / 3800));
    for (var i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() < 0.9 ? rand(0.35, 0.9) : rand(0.9, 1.6),
        a: rand(0.18, 0.8),
        tw: rand(0.4, 1.4),
        ph: Math.random() * Math.PI * 2,
        depth: rand(0.2, 1)
      });
    }

    dust = [];
    for (var d = 0; d < 9; d++) {
      dust.push({
        a: Math.random() * Math.PI * 2,
        t: rand(0.18, 0.95),
        s: rand(0.22, 0.6),
        warm: Math.random() < 0.55
      });
    }

    parts = [];
    var arms = 2;
    var count = Math.round(w > 900 ? 1600 : 800);
    for (var p = 0; p < count; p++) {
      var t = Math.pow(Math.random(), 0.62);
      var arm = p % arms;
      var spread = rand(-0.12, 0.12) * (0.3 + t);
      parts.push({
        t: t,
        theta: arm * Math.PI + t * 3.6 + spread,
        r: (0.06 + t * 0.94) * galaxy.r,
        size: rand(0.5, 1.5) * (1 - t * 0.35),
        a: rand(0.25, 0.85) * (1 - t * 0.45),
        warm: t < 0.5
      });
    }

    parts2 = [];
    var arms2 = 2;
    var count2 = Math.round(w > 900 ? 620 : 260);
    for (var p2 = 0; p2 < count2; p2++) {
      var t2 = Math.pow(Math.random(), 0.68);
      var arm2 = p2 % arms2;
      var sp2 = rand(-0.16, 0.16) * (0.3 + t2);
      parts2.push({
        t: t2,
        theta: arm2 * Math.PI + t2 * 5.2 + sp2,
        r: (0.08 + t2 * 0.92) * galaxy2.r,
        size: rand(0.4, 1.1),
        a: rand(0.18, 0.7) * (1 - t2 * 0.45),
        warm: t2 < 0.3
      });
    }
  }

  function draw(time) {
    var elapsed = time * 0.001;
    scrollShift = window.scrollY * 0.04;
    var cx = w * galaxy.x + pointer.x * 14;
    var cy = h * galaxy.y + pointer.y * 12 - scrollShift;

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#04060b";
    ctx.fillRect(0, 0, w, h);

    // 星云
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < dust.length; i++) {
      var d = dust[i];
      var da = d.a + elapsed * 0.004;
      var dx = cx + Math.cos(da) * galaxy.r * d.t;
      var dy = cy + Math.sin(da) * galaxy.r * d.t * 0.62;
      var dr = galaxy.r * d.s;
      var g = ctx.createRadialGradient(dx, dy, 0, dx, dy, dr);
      g.addColorStop(0, d.warm ? "rgba(216,162,74,0.10)" : "rgba(120,170,220,0.10)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(dx - dr, dy - dr, dr * 2, dr * 2);
    }

    // 星点
    for (var s = 0; s < stars.length; s++) {
      var st = stars[s];
      var tw = 0.65 + Math.sin(elapsed * st.tw + st.ph) * 0.35;
      var sy = st.y - scrollShift * st.depth * 0.6;
      if (sy < -4) sy += h + 8;
      if (sy > h + 4) sy -= h + 8;
      ctx.globalAlpha = st.a * tw;
      ctx.fillStyle = "#dcecff";
      ctx.beginPath();
      ctx.arc(st.x, sy, st.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 星系核心
    var core = ctx.createRadialGradient(cx, cy, 0, cx, cy, galaxy.r * 0.42);
    core.addColorStop(0, "rgba(255,226,178,0.5)");
    core.addColorStop(0.22, "rgba(255,206,140,0.22)");
    core.addColorStop(0.6, "rgba(216,162,74,0.08)");
    core.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, galaxy.r * 0.42, 0, Math.PI * 2);
    ctx.fill();

    // 旋臂粒子
    for (var k = 0; k < parts.length; k++) {
      var q = parts[k];
      var speed = 0.05 - q.t * 0.022;
      var ang = q.theta + elapsed * speed;
      var px = cx + Math.cos(ang) * q.r;
      var py = cy + Math.sin(ang) * q.r * 0.72;
      ctx.globalAlpha = q.a;
      ctx.fillStyle = q.warm ? "#f0c883" : "#bcd8f2";
      ctx.beginPath();
      ctx.arc(px, py, q.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 星系核心：暗核 + 吸积环，让旋涡结构有中心
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    var coreR = galaxy.r * 0.055;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fillStyle = "#04060b";
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(255, 224, 170, 0.85)";
    ctx.stroke();
    var ring = ctx.createRadialGradient(cx, cy, coreR, cx, cy, coreR * 3.2);
    ring.addColorStop(0, "rgba(255, 226, 178, 0.35)");
    ring.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 左下角第二个小星系：正面旋涡，冰蓝色，和右上黑洞形成纵深
    var c2x = w * galaxy2.x;
    var c2y = h * galaxy2.y - scrollShift * 0.5;
    ctx.globalCompositeOperation = "lighter";
    var halo2 = ctx.createRadialGradient(c2x, c2y, 0, c2x, c2y, galaxy2.r * 1.3);
    halo2.addColorStop(0, "rgba(150, 205, 245, 0.3)");
    halo2.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = halo2;
    ctx.beginPath();
    ctx.arc(c2x, c2y, galaxy2.r * 1.3, 0, Math.PI * 2);
    ctx.fill();
    for (var k2 = 0; k2 < parts2.length; k2++) {
      var q2 = parts2[k2];
      var ang2 = q2.theta - elapsed * (0.03 - q2.t * 0.012);
      var px2 = c2x + Math.cos(ang2) * q2.r;
      var py2 = c2y + Math.sin(ang2) * q2.r * 0.55;
      ctx.globalAlpha = q2.a;
      ctx.fillStyle = q2.warm ? "#f0c883" : "#cfe6f8";
      ctx.beginPath();
      ctx.arc(px2, py2, q2.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    var core2 = galaxy2.r * 0.05;
    ctx.beginPath();
    ctx.arc(c2x, c2y, core2, 0, Math.PI * 2);
    ctx.fillStyle = "#04060b";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(178, 216, 244, 0.85)";
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    if (!t0) t0 = now;
    if (now - last >= 33) {
      draw(now - t0);
      last = now;
    }
    if (!reduce) raf = requestAnimationFrame(frame);
  }

  function start() {
    cancelAnimationFrame(raf);
    if (reduce) {
      draw(0);
      return;
    }
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  window.addEventListener("resize", function () {
    build();
    if (reduce) draw(0);
  });

  window.addEventListener("pointermove", function (e) {
    pointer.x = (e.clientX / w - 0.5) * 2;
    pointer.y = (e.clientY / h - 0.5) * 2;
  }, { passive: true });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else if (!reduce) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  });

  build();
  start();
})();







