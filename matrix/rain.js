/* rain.js —— matrix/ 皮肤的背景代码雨。
   纯装饰：fixed 定位、pointer-events:none，不参与页面交互与布局。
   遵循 prefers-reduced-motion：开启减少动态时只画一帧静止的字符，不循环。 */
(function () {
  "use strict";

  var canvas = document.getElementById("matrix-rain");
  if (!canvas || !canvas.getContext) {
    return;
  }

  var ctx = canvas.getContext("2d");
  var GLYPHS = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789<>=+*";
  var FONT_SIZE = 15;
  var FPS_INTERVAL = 1000 / 24;

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  var columns = [];
  var width = 0;
  var height = 0;
  var dpr = 1;
  var rafId = 0;
  var lastFrame = 0;
  var running = false;

  function randomGlyph() {
    return GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length));
  }

  function makeColumns() {
    var count = Math.ceil(width / FONT_SIZE) + 1;
    columns = [];
    for (var i = 0; i < count; i++) {
      columns.push({
        y: Math.random() * height,
        speed: 0.6 + Math.random() * 2.4,
        // 少量列更亮，形成深浅层次
        bright: Math.random() < 0.18
      });
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#030604";
    ctx.fillRect(0, 0, width, height);
    makeColumns();
  }

  function paintColumn(column, index) {
    var x = index * FONT_SIZE;
    var y = column.y;
    if (y < -(FONT_SIZE * 2) || y > height + FONT_SIZE) {
      column.y = -Math.random() * height * 0.35;
      column.speed = 0.6 + Math.random() * 2.4;
      return;
    }

    ctx.font = FONT_SIZE + "px 'Cascadia Mono', Consolas, 'Courier New', monospace";
    ctx.textBaseline = "top";

    // 头部字符偏亮，向下逐渐变暗
    ctx.fillStyle = column.bright ? "rgba(160, 255, 120, 0.75)" : "rgba(78, 220, 90, 0.5)";
    ctx.fillText(randomGlyph(), x, y);

    for (var k = 1; k <= 6; k++) {
      var alpha = (column.bright ? 0.16 : 0.11) / k;
      ctx.fillStyle = "rgba(57, 255, 20, " + alpha + ")";
      ctx.fillText(randomGlyph(), x, y - k * FONT_SIZE);
    }
  }

  function draw(now) {
    if (!running) {
      return;
    }
    rafId = window.requestAnimationFrame(draw);

    if (now - lastFrame < FPS_INTERVAL) {
      return;
    }
    lastFrame = now;

    // 半透明覆盖形成拖尾
    ctx.fillStyle = "rgba(3, 6, 4, 0.12)";
    ctx.fillRect(0, 0, width, height);

    for (var i = 0; i < columns.length; i++) {
      paintColumn(columns[i], i);
      columns[i].y += FONT_SIZE * columns[i].speed;
    }
  }

  function start() {
    if (running) {
      return;
    }
    running = true;
    lastFrame = 0;
    rafId = window.requestAnimationFrame(draw);
  }

  function stop() {
    running = false;
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function renderStill() {
    // 减少动态：只画一帧低透明度字符，不启动循环
    ctx.fillStyle = "#030604";
    ctx.fillRect(0, 0, width, height);
    ctx.font = FONT_SIZE + "px 'Cascadia Mono', Consolas, 'Courier New', monospace";
    ctx.textBaseline = "top";
    for (var i = 0; i < columns.length; i++) {
      var x = i * FONT_SIZE;
      var y = columns[i].y;
      for (var k = 0; k < 10; k++) {
        ctx.fillStyle = "rgba(57, 255, 20, " + (0.05 + 0.05 / (k + 1)) + ")";
        ctx.fillText(randomGlyph(), x, y + k * FONT_SIZE);
      }
    }
  }

  function onVisibilityChange() {
    if (document.hidden) {
      stop();
    } else if (!reduceMotion || !reduceMotion.matches) {
      start();
    }
  }

  resize();
  window.addEventListener("resize", function () {
    resize();
    if (reduceMotion && reduceMotion.matches) {
      renderStill();
    }
  });

  if (reduceMotion && reduceMotion.matches) {
    renderStill();
  } else {
    start();
  }

  document.addEventListener("visibilitychange", onVisibilityChange);

  if (reduceMotion) {
    var onPreferenceChange = function () {
      if (reduceMotion.matches) {
        stop();
        renderStill();
      } else {
        start();
      }
    };
    if (typeof reduceMotion.addEventListener === "function") {
      reduceMotion.addEventListener("change", onPreferenceChange);
    } else if (typeof reduceMotion.addListener === "function") {
      reduceMotion.addListener(onPreferenceChange);
    }
  }
})();
