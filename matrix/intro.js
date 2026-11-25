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
    '<div class="intro-warp"></div>' +
    '<div class="stage-panel stage-panel-left"></div>' +
    '<div class="stage-panel stage-panel-right"></div>' +
    '<div class="intro-flash"></div>' +
    '<div class="intro-flare"><i></i><i></i></div>' +
    '<svg class="intro-cracks" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true"></svg>' +
    '<div class="intro-shards" aria-hidden="true"></div>' +
    '<div class="intro-blackout"></div>' +
    '<svg class="intro-glass-defs" width="0" height="0" aria-hidden="true" focusable="false">' +
    '<defs>' +
    '<linearGradient id="glass-cool" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#ffffff" stop-opacity="1"/>' +
    '<stop offset="0.4" stop-color="#7ff7ff" stop-opacity="0.9"/>' +
    '<stop offset="0.72" stop-color="#b98cff" stop-opacity="0.72"/>' +
    '<stop offset="1" stop-color="#ff8adf" stop-opacity="0.5"/>' +
    "</linearGradient>" +
    '<linearGradient id="glass-warm" x1="0" y1="1" x2="1" y2="0">' +
    '<stop offset="0" stop-color="#ffffff" stop-opacity="1"/>' +
    '<stop offset="0.38" stop-color="#ffd37a" stop-opacity="0.92"/>' +
    '<stop offset="0.72" stop-color="#ff8adf" stop-opacity="0.7"/>' +
    '<stop offset="1" stop-color="#7ff7ff" stop-opacity="0.55"/>' +
    "</linearGradient>" +
    '<linearGradient id="glass-white" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#ffffff" stop-opacity="1"/>' +
    '<stop offset="0.45" stop-color="#e9fdff" stop-opacity="0.92"/>' +
    '<stop offset="0.75" stop-color="#ffd7ff" stop-opacity="0.68"/>' +
    '<stop offset="1" stop-color="#fff3b0" stop-opacity="0.48"/>' +
    "</linearGradient>" +
    '<linearGradient id="glass-clear" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#ffffff" stop-opacity="0.68"/>' +
    '<stop offset="0.38" stop-color="#e8fbff" stop-opacity="0.3"/>' +
    '<stop offset="0.72" stop-color="#ffffff" stop-opacity="0.1"/>' +
    '<stop offset="1" stop-color="#bdefff" stop-opacity="0.24"/>' +
    "</linearGradient>" +
    '<linearGradient id="glass-edge" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#ffffff"/>' +
    '<stop offset="0.3" stop-color="#f4feff" stop-opacity="0.98"/>' +
    '<stop offset="0.62" stop-color="#c8f4ff" stop-opacity="0.92"/>' +
    '<stop offset="0.84" stop-color="#ffffff" stop-opacity="0.96"/>' +
    '<stop offset="1" stop-color="#dff8ff" stop-opacity="0.9"/>' +
    "</linearGradient>" +
    "</defs>" +
    "</svg>" +
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
  function shatter(target) {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var host = target.querySelector(".intro-shards");
    if (!host || host.childElementCount) return;
    var NS = "http://www.w3.org/2000/svg";
    var shapes = [
      "4,16 54,0 100,58 76,98 14,88",
      "0,4 62,10 100,46 52,96 8,74",
      "10,6 64,0 100,32 82,100 20,84",
      "0,24 48,0 88,16 100,72 58,100 6,68",
      "14,0 86,4 100,60 60,100 0,56",
      "0,12 50,0 100,40 66,100 12,92",
      "6,0 58,12 96,52 44,100 0,82",
      "12,4 72,0 100,30 86,92 28,100 0,62"
    ];
    var frag = document.createDocumentFragment();
    for (var i = 0; i < 42; i++) {
      var angle = (Math.PI * 2 * i) / 42 + (Math.random() - 0.5) * 0.8;
      var large = i < 12;
      var dist = large ? 340 + Math.random() * 500 : 340 + Math.random() * 620;
      var w = large ? 120 + Math.random() * 120 : 28 + Math.random() * 66;
      var svg = document.createElementNS(NS, "svg");
      svg.setAttribute("class", "intro-shard");
      svg.setAttribute("viewBox", "0 0 100 100");
      svg.setAttribute("preserveAspectRatio", "none");
      svg.style.cssText =
        "left:" + (47 + (Math.random() - 0.5) * 14) + "%;" +
        "top:" + (45 + (Math.random() - 0.5) * 14) + "%;" +
        "width:" + w + "px;height:" + (w * (0.7 + Math.random() * 0.8)) + "px;" +
        "--tx:" + Math.cos(angle) * dist + "px;" +
        "--ty:" + Math.sin(angle) * dist + "px;" +
        "--rot:" + (Math.random() * 260 - 130) + "deg;" +
        "--delay:" + (Math.random() * 0.12) + "s;" +
        "--dur:" + (1.05 + Math.random() * 0.45) + "s;";
      var poly = document.createElementNS(NS, "polygon");
      poly.setAttribute("points", shapes[i % shapes.length]);
      poly.setAttribute("fill", "url(#glass-clear)");
      poly.setAttribute("stroke", "url(#glass-edge)");
      poly.setAttribute("stroke-width", (large ? 1.5 : 1.25));
      poly.setAttribute("stroke-opacity", "0.92");
      svg.appendChild(poly);
      var verts = shapes[i % shapes.length].split(" ").map(function (pair) { return pair.split(","); });
      var v1 = verts[Math.floor(Math.random() * verts.length)];
      var v2 = verts[Math.floor(Math.random() * verts.length)];
      var facet = document.createElementNS(NS, "polyline");
      facet.setAttribute("points", v1.join(",") + " 50,50 " + v2.join(","));
      facet.setAttribute("fill", "none");
      facet.setAttribute("stroke", "rgba(255, 255, 255, 0.82)");
      facet.setAttribute("stroke-width", "0.55");
      svg.appendChild(facet);
      var glint = document.createElementNS(NS, "polyline");
      glint.setAttribute("points", v1.join(",") + " " + v2.join(","));
      glint.setAttribute("fill", "none");
      glint.setAttribute("stroke", "rgba(228, 250, 255, 0.62)");
      glint.setAttribute("stroke-width", "0.7");
      svg.appendChild(glint);
      poly.setAttribute("fill-opacity", (0.58 + Math.random() * 0.18).toFixed(2));
      poly.setAttribute("opacity", "1");
      frag.appendChild(svg);
    }
    for (var s = 0; s < 46; s++) {
      var a = Math.random() * Math.PI * 2;
      var d = 120 + Math.random() * 520;
      var spark = document.createElement("i");
      spark.className = "intro-spark";
      spark.style.cssText =
        "left:" + (48 + (Math.random() - 0.5) * 8) + "%;" +
        "top:" + (46 + (Math.random() - 0.5) * 8) + "%;" +
        "--sx:" + Math.cos(a) * d + "px;" +
        "--sy:" + Math.sin(a) * d + "px;" +
        "--delay:" + (Math.random() * 0.14) + "s;" +
        "--dur:" + (0.5 + Math.random() * 0.55) + "s;";
      frag.appendChild(spark);
    }
    host.appendChild(frag);
    host.classList.add("is-live");

    var cracks = target.querySelector(".intro-cracks");
    if (!cracks) return;
    for (var c = 0; c < 9; c++) {
      var edgeAngle = (Math.PI * 2 * c) / 9 + (Math.random() - 0.5) * 0.5;
      var pts = "500,300";
      var px = 500, py = 300;
      for (var step = 1; step <= 4; step++) {
        var reach = step * (120 + Math.random() * 70);
        px = 500 + Math.cos(edgeAngle + (Math.random() - 0.5) * 0.24) * reach;
        py = 300 + Math.sin(edgeAngle + (Math.random() - 0.5) * 0.24) * reach;
        pts += " " + px.toFixed(1) + "," + py.toFixed(1);
      }
      var line = document.createElementNS(NS, "polyline");
      line.setAttribute("points", pts);
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", "rgba(232, 247, 255, 0.78)");
      line.setAttribute("stroke-width", "1.1");
      cracks.appendChild(line);
      var len = line.getTotalLength();
      line.style.strokeDasharray = len;
      line.style.strokeDashoffset = len;
      line.animate(
        [
          { strokeDashoffset: len, opacity: 0.9 },
          { strokeDashoffset: 0, opacity: 1, offset: 0.55 },
          { strokeDashoffset: 0, opacity: 0 }
        ],
        { duration: 620 + Math.random() * 140, easing: "cubic-bezier(0.16, 0.8, 0.3, 1)", fill: "forwards" }
      );
    }
  }

  var audio = null;

  function initAudio() {
    if (audio) {
      if (audio.ctx.state === "suspended") audio.ctx.resume().catch(function () {});
      return audio;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      var ctx = new AC();
      var master = ctx.createGain();
      master.gain.value = 0.42;
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20;
      comp.knee.value = 24;
      comp.ratio.value = 5;
      comp.attack.value = 0.004;
      comp.release.value = 0.28;
      master.connect(comp);
      comp.connect(ctx.destination);
      var noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
      var data = noise.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      audio = { ctx: ctx, master: master, noise: noise };
      if (ctx.state === "suspended") ctx.resume().catch(function () {});
      return audio;
    } catch (e) {
      return null;
    }
  }

  function panTo(ctx, node, value) {
    if (!ctx.createStereoPanner) return node;
    var p = ctx.createStereoPanner();
    p.pan.value = value;
    node.connect(p);
    return p;
  }

  function noiseSweep(a, start, dur, type, f0, f1, gain, pan) {
    var ctx = a.ctx;
    var src = ctx.createBufferSource();
    src.buffer = a.noise;
    var filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(f0, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, f1), start + dur);
    filter.Q.value = 0.9;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter);
    filter.connect(g);
    panTo(ctx, g, pan || 0).connect(a.master);
    src.start(start);
    src.stop(start + dur + 0.05);
  }

  function tone(a, start, dur, type, f0, f1, gain, pan) {
    var ctx = a.ctx;
    var osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, start);
    if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(30, f1), start + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.02, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    panTo(ctx, g, pan || 0).connect(a.master);
    osc.start(start);
    osc.stop(start + dur + 0.03);
  }

  function playIntroSound() {
    var a = initAudio();
    if (!a) return;
    var t = a.ctx.currentTime + 0.02;
    // 翻牌：低频空气感 + 上升的金属呼吸
    noiseSweep(a, t, 0.9, "bandpass", 160, 1900, 0.16, -0.08);
    noiseSweep(a, t + 0.05, 0.75, "lowpass", 90, 520, 0.12, 0.1);
    tone(a, t + 0.06, 0.7, "sine", 130, 260, 0.05, -0.12);
    // 720ms 后：低频冲击 + 玻璃碎裂
    var hit = t + 0.7;
    tone(a, hit, 0.6, "sine", 96, 38, 0.52, 0);
    noiseSweep(a, hit, 0.32, "highpass", 2600, 7200, 0.2, 0);
    for (var i = 0; i < 15; i++) {
      var at = hit + Math.random() * 0.34;
      var freq = 1500 + Math.random() * 4300;
      tone(a, at, 0.16 + Math.random() * 0.38, i % 4 === 0 ? "triangle" : "sine", freq, freq * (0.72 + Math.random() * 0.2), 0.035 + Math.random() * 0.055, Math.random() * 1.6 - 0.8);
    }
    noiseSweep(a, hit + 0.12, 0.8, "highpass", 4200, 9000, 0.05, 0.2);
    // 压黑前下坠
    tone(a, t + 1.5, 0.55, "sine", 74, 34, 0.16, 0);
  }

  function begin() {
    if (done || opening) return;
    opening = true;
    playIntroSound();
    clearTimers();
    root.classList.add("is-flip");
    timers.push(setTimeout(function () {
      root.classList.add("is-open");
      shatter(root);
      timers.push(setTimeout(remove, 1400));
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













