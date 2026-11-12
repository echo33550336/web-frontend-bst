/**
 * d3.js —— 难点 3：插入顺序与树退化（对照比较型）
 *
 * 这一页要回答的问题：同一批数据，只换插入顺序，树会差多少？
 *   - 右树恒按升序插入（必然退化成一个长链）；
 *   - 左树的插入顺序由 orderedness 控制：100 = 与右树相同（完全升序），
 *     0 = 在升序序列上做 4n 次随机相邻交换（充分随机），中间值按线性比例取交换次数。
 *
 * 一半是纯函数（可 Node 单测）：确定性 PRNG、数据生成、插入顺序、统计、第 i 步状态；
 * 一半是本页专属的交互（双画布同步重绘、参数联动、播放控件）。
 * 讲解文字、参数、读数定义全部来自 data/d3.json，这里只负责填变量。
 */
(function (global) {
  "use strict";

  /* 树的逻辑与渲染都在 tree.js 里；Node 单测直接 require 本文件，所以用 require 兜底。 */
  var Tree = global.Tree;
  if (!Tree && typeof require === "function") {
    Tree = require("./tree.js");
  }
  if (!Tree) throw new Error("tree.js 必须先于 d3.js 加载");

  /* ================= 确定性随机与数据生成（纯函数，可单测） ================= */

  /** mulberry32：32 位种子 → [0,1) 的确定性伪随机流。纯函数实现，不依赖 Math.random。 */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var DEFAULT_MIN = 1;
  var DEFAULT_MAX = 999;

  function normalizeRange(range) {
    var lo = range && range.min != null ? Math.floor(Number(range.min)) : DEFAULT_MIN;
    var hi = range && range.max != null ? Math.floor(Number(range.max)) : DEFAULT_MAX;
    if (!isFinite(lo)) lo = DEFAULT_MIN;
    if (!isFinite(hi)) hi = DEFAULT_MAX;
    if (hi < lo) {
      var tmp = lo;
      lo = hi;
      hi = tmp;
    }
    return { min: lo, max: hi };
  }

  function normOrderedness(value) {
    if (value === undefined || value === null || value === "") return 100;
    var pct = Number(value);
    if (!isFinite(pct)) return 100;
    return Math.max(0, Math.min(100, pct));
  }

  /**
   * 生成同一批数据：n 个互不相同的整数，返回升序序列。
   * 同一个 seed + n + range 一定得到同一组数（纯函数 + 种子流）。
   */
  function makeDataset(seed, n, range) {
    var box = normalizeRange(range);
    var span = box.max - box.min + 1;
    var count = Math.max(0, Math.floor(Number(n) || 0));
    count = Math.min(count, span);
    var rng = mulberry32((seed >>> 0) ^ 0x85ebca6b);
    var seen = Object.create(null);
    var out = [];
    while (out.length < count) {
      var v = box.min + Math.floor(rng() * span);
      if (seen[v]) continue;
      seen[v] = true;
      out.push(v);
    }
    out.sort(function (a, b) {
      return a - b;
    });
    return out;
  }

  /** 有序程度 → 相邻交换次数：k = round((100 − orderedness) / 100 × 4n) */
  function swapsFor(n, orderedness) {
    var pct = normOrderedness(orderedness);
    var maxSwaps = 4 * Math.max(0, Math.floor(Number(n) || 0));
    return Math.round(((100 - pct) / 100) * maxSwaps);
  }

  /**
   * 左树的插入顺序（全部由「有序程度」控制，且同 seed + 同 salt 完全可复现）：
   *   orderedness = 100 → 原样返回升序，与右树完全同序；
   *   orderedness = 0   → 带种子的 Fisher–Yates 全排列，才是真正的“完全随机”；
   *   0 < orderedness < 100 → 升序序列做 k 次随机相邻交换，k = round((100 − p) / 100 × 4n)，
   *                        局部有序程度在两个极端之间平滑变化。
   * salt 是「重排」的计数器：同一批数据、同一个有序程度，换 salt 就换一组随机顺序；
   * salt = 0 时与不传完全等价（初始状态永远稳定）。
   */
  function leftOrder(values, orderedness, seed, salt) {
    var arr = values.slice();
    var n = arr.length;
    if (n < 2) return arr;
    var pct = normOrderedness(orderedness);
    var s = Number(salt) || 0;
    var rng = mulberry32(((seed >>> 0) ^ 0x9e3779b9 ^ Math.imul(s, 0x27d4eb2d)) >>> 0);
    if (pct <= 0) {
      /* 全排列：每个插入顺序等概率出现，树高才有“随机 BST”的典型分布 */
      for (var i = n - 1; i > 0; i -= 1) {
        var r = Math.floor(rng() * (i + 1));
        var swap = arr[i];
        arr[i] = arr[r];
        arr[r] = swap;
      }
      return arr;
    }
    var k = swapsFor(n, pct);
    if (k <= 0) return arr;
    for (var t = 0; t < k; t += 1) {
      var j = Math.floor(rng() * (n - 1));
      var tmp = arr[j];
      arr[j] = arr[j + 1];
      arr[j + 1] = tmp;
    }
    return arr;
  }

  /** 一次演示所需的全部确定性数据：同一批数 + 两种插入顺序。 */
  function makeCase(seed, n, orderedness, range, salt) {
    var values = makeDataset(seed, n, range);
    var pct = normOrderedness(orderedness);
    return {
      seed: seed,
      n: values.length,
      orderedness: pct,
      salt: Number(salt) || 0,
      values: values,
      rightOrder: values.slice(),
      leftOrder: leftOrder(values, pct, seed, salt),
      swaps: swapsFor(values.length, pct),
    };
  }

  /**
   * 「重排」用的纯函数：数值集合、n、右树顺序都不动，只换左树的插入顺序。
   * 同一个 salt 结果完全一样，换一个 salt 就是另一组随机顺序。
   */
  function reshuffleCase(caseData, salt) {
    var s = Number(salt) || 0;
    return {
      seed: caseData.seed,
      n: caseData.n,
      orderedness: caseData.orderedness,
      salt: s,
      values: caseData.values.slice(),
      rightOrder: caseData.rightOrder.slice(),
      leftOrder: leftOrder(caseData.values, caseData.orderedness, caseData.seed, s),
      swaps: swapsFor(caseData.n, caseData.orderedness),
    };
  }

  /* ================= 统计读数（纯函数，可单测） ================= */

  /**
   * 当前这棵树的三个读数：
   *   height     树高层数（空 0、单节点 1）；
   *   avgSteps   对树里所有值各查一次，比较次数的平均值；
   *   worstSteps 这些查找里最大的比较次数（空树 0）。
   */
  function stats(root) {
    var values = Tree.inorder(root);
    var n = values.length;
    if (n === 0) return { n: 0, height: 0, avgSteps: 0, worstSteps: 0 };
    var sum = 0;
    var worst = 0;
    for (var i = 0; i < n; i += 1) {
      var s = Tree.searchSteps(root, values[i]);
      sum += s;
      if (s > worst) worst = s;
    }
    return {
      n: n,
      height: Tree.height(root),
      avgSteps: sum / n,
      worstSteps: worst,
    };
  }

  /**
   * 第 index 步（0 开始）的完整状态：两边各已插入 index+1 个值。
   * 每次都从插入顺序重新建树，不依赖任何累积的可变状态 —— 所以上一步/重置都正确。
   */
  function stepState(caseData, index) {
    var cd = caseData;
    var last = cd.n - 1;
    var i = index == null ? 0 : Math.floor(Number(index) || 0);
    if (i < 0) i = 0;
    if (i > last) i = last;
    var leftValues = cd.leftOrder.slice(0, i + 1);
    var rightValues = cd.rightOrder.slice(0, i + 1);
    var leftRoot = Tree.buildTree(leftValues);
    var rightRoot = Tree.buildTree(rightValues);
    return {
      index: i,
      n: cd.n,
      inserted: i + 1,
      leftValues: leftValues,
      rightValues: rightValues,
      newLeft: leftValues.length ? leftValues[leftValues.length - 1] : null,
      newRight: rightValues.length ? rightValues[rightValues.length - 1] : null,
      leftRoot: leftRoot,
      rightRoot: rightRoot,
      leftStats: stats(leftRoot),
      rightStats: stats(rightRoot),
    };
  }

  /** 播放控件的步骤表：n 步，第 i 步 = 两边各插入 i+1 个值。 */
  function stepsFor(caseData) {
    var steps = [];
    for (var i = 0; i < caseData.n; i += 1) steps.push({ index: i });
    return steps;
  }

  /* ================= 折线图数据（纯函数，可单测） ================= */

  var CHART_W = 400;
  var CHART_H = 200;
  var CHART_PAD = { left: 46, right: 12, top: 20, bottom: 30 };

  /** 从 stats 里取折线要画的读数：height / avgSteps / worstSteps */
  function statValue(s, metricKey) {
    if (metricKey === "avgSteps") return s.avgSteps;
    if (metricKey === "worstSteps") return s.worstSteps;
    return s.height;
  }

  /**
   * 第 index 步的折线数据：横轴 = 已插入个数，纵轴 = 该步读数（JSON chart.metric 指定，默认树高）。
   * 从空树开始按插入顺序逐个插入，所以第 k 个点永远等于「第 k 步」的读数；
   * 截断只由 index 决定，和播放历史无关 —— 上一步 / 重置 / 跳步都不会让折线错位。
   */
  function chartSeries(caseData, index, metricKey) {
    var key = metricKey === "avgSteps" || metricKey === "worstSteps" ? metricKey : "height";
    var last = caseData.n - 1;
    var i = index == null ? 0 : Math.floor(Number(index) || 0);
    if (i < 0) i = 0;
    if (i > last) i = last;
    var leftRoot = null;
    var rightRoot = null;
    var left = [];
    var right = [];
    for (var j = 0; j <= i; j += 1) {
      leftRoot = Tree.insertNode(leftRoot, caseData.leftOrder[j]);
      rightRoot = Tree.insertNode(rightRoot, caseData.rightOrder[j]);
      left.push({ x: j + 1, y: statValue(stats(leftRoot), key) });
      right.push({ x: j + 1, y: statValue(stats(rightRoot), key) });
    }
    return { index: i, n: caseData.n, metric: key, left: left, right: right };
  }

  /**
   * 纵轴上限按「整场演示」算，而不是按当前步算：
   * 这样折线是随插入一步步长出来的，不会每一步都被重新压扁。
   */
  function chartYMax(caseData, metricKey) {
    var full = chartSeries(caseData, caseData.n - 1, metricKey);
    var max = 0;
    full.left.forEach(function (p) { if (p.y > max) max = p.y; });
    full.right.forEach(function (p) { if (p.y > max) max = p.y; });
    return max > 0 ? max : 1;
  }

  /* ================= 本页几何：让 n=5 和 n=60 都落在同一个坐标盒子里 ================= */

  var COORD_W = 400;
  var COORD_H = 360;
  var EDGE_PAD_X = 22;
  var EDGE_PAD_Y = 24;

  /**
   * 按 n 反推节点间距：树越大，间距越小，整棵（哪怕退化成链的）树也能完整装进 COORD_W×COORD_H。
   * 左右两棵树共用同一套几何，形状差异才是可比较的；节点小到写不下数字时只画轮廓。
   */
  function geoFor(n) {
    var cols = Math.max(1, n - 1);
    var dx = Math.min(Tree.GEO.dx, (COORD_W - EDGE_PAD_X * 2) / cols);
    var dy = Math.min(Tree.GEO.dy, (COORD_H - EDGE_PAD_Y * 2) / cols);
    var radius = Math.min(Tree.GEO.nodeR, dx * 0.42, dy * 0.42);
    var stroke = Math.min(2, Math.max(0.6, radius * 0.55));
    return {
      dx: dx,
      dy: dy,
      radius: radius,
      stroke: stroke,
      font: Math.min(15, Math.max(4, radius * 1.5)),
      /* 半径小于 6 时三位数已经写不进节点，只留轮廓 */
      compact: radius < 6,
    };
  }

  function round1(value) {
    return Math.round(Number(value) * 10) / 10;
  }

  /** 读数/文案里的数字：整数原样，小数留一位（10.5 而不是 10.500000001）。 */
  function fmtNumber(value) {
    var r = round1(value);
    return isFinite(r) ? String(r) : "—";
  }

  /* ================= 页面交互 ================= */

  function mount() {
    var App = global.App;
    var paramsBox = document.getElementById("params");
    var metricsBox = document.getElementById("metrics");
    var hintBox = document.getElementById("metrics-hint");
    var stepBox = document.getElementById("panel-step");
    var statusEl = document.getElementById("status");
    var conclusionCard = document.getElementById("conclusion-card");
    var conclusionBox = document.getElementById("panel-conclusion");
    var leftSvg = document.getElementById("canvas-left");
    var rightSvg = document.getElementById("canvas-right");
    var captionLeft = document.getElementById("caption-left");
    var captionRight = document.getElementById("caption-right");
    var chartSvg = document.getElementById("chart");
    var chartMetricSelect = document.getElementById("chart-metric");
    var chartMetricLabel = document.getElementById("chart-metric-label");
    var chartLegendLeft = document.getElementById("chart-legend-left");
    var chartLegendRight = document.getElementById("chart-legend-right");
    var reshuffleNote = document.getElementById("reshuffle-note");

    var state = {
      data: null,
      seed: 0,
      n: 20,
      orderedness: 100,
      range: null,
      caseData: null,
      steps: [],
      geo: null,
      /* 折线：画哪个读数由 JSON chart.metric 指定，纵轴上限按整场演示算 */
      chartMetric: "height",
      /* 当前折线读数的元信息（标题、纵轴标签、注释），随下拉框切换 */
      chartMeta: null,
      chartMetricOptions: [],
      /* 最近一次渲染的步骤快照：切换折线读数时不用重新走播放器 */
      lastSt: null,
      yMax: 1,
      /* 「重排」计数器：0 = 初始顺序，每点一次 +1，用派生种子换一组随机顺序 */
      shuffleSalt: 0,
    };

    var playback = new App.Playback({
      onRender: function (step) {
        renderStep(step);
      },
      onState: function (index, total, playing) {
        if (!state.data) return;
        statusEl.textContent =
          App.format(state.data.labels.statusLine, { i: index + 1, n: total }) +
          (playing ? state.data.labels.playing : "");
        /* 边界步骤把按钮点亮/置灰，读屏与键盘用户也能知道「到头了」 */
        var prevBtn = document.getElementById("btn-prev");
        var nextBtn = document.getElementById("btn-next");
        if (prevBtn) prevBtn.disabled = index <= 0;
        if (nextBtn) nextBtn.disabled = index >= total - 1;
      },
    });

    App.loadJSON("../data/d3.json")
      .then(function (data) {
        state.data = data;
        state.seed = data.dataset.seed;
        state.range = Array.isArray(data.dataset.valueRange)
          ? { min: data.dataset.valueRange[0], max: data.dataset.valueRange[1] }
          : null;

        setText("page-kicker", data.kicker + " · " + data.interactionType);
        setText("page-title", data.title);
        setText("page-subtitle", data.subtitle);
        setText("page-howto", data.howToUse);
        setText("page-status", data.status);
        setText("label-params", data.labels.paramsTitle);
        setText("label-step", data.labels.stepTitle);
        setText("label-conclusion", data.labels.conclusionTitle);
        setText("btn-play", data.labels.play);
        setText("btn-pause", data.labels.pause);
        setText("btn-prev", data.labels.prev);
        setText("btn-next", data.labels.next);
        setText("btn-reset", data.labels.reset);
        setText("btn-reshuffle", data.labels.reshuffle);
        setText("reshuffle-hint", data.labels.reshuffleHint);
        state.chartMetric = data.chart && data.chart.metric ? data.chart.metric : "height";
        setText("chart-title", data.chart.title);
        setText("chart-legend-left", App.format(data.chart.legendLeft, { orderedness: state.orderedness }));
        setText("chart-legend-right", data.chart.legendRight);
        setText("chart-note", data.chart.note);
        if (chartSvg && data.chart.title) chartSvg.setAttribute("aria-label", data.chart.title);

        buildChartMetric(data);
        applyChartMeta(state.chartMetric);
        buildParams(data);
        buildMetrics(data);
        bindButtons();
        regenerate();
        if (App.progress) App.progress.visit("d3");
      })
      .catch(function (err) {
        App.showError(stepBox, err);
      });

    function setText(id, text) {
      var node = document.getElementById(id);
      if (node && text != null) node.textContent = text;
    }

    /** 参数区完全由 JSON 渲染；size / orderedness 改动会重新生成数据并重置演示。 */
    function buildParams(data) {
      App.clear(paramsBox);
      data.params.forEach(function (p) {
        var row = App.el("div", { class: "param" });
        var label = App.el("label", { text: p.label, for: "param-" + p.key });
        var input = App.el("input", {
          type: "range",
          id: "param-" + p.key,
          min: p.min,
          max: p.max,
          step: p.step,
          value: p.default,
        });
        var readout = App.el("span", { class: "readout", text: String(p.default) });

        if (p.key === "size") state.n = Number(p.default);
        if (p.key === "orderedness") state.orderedness = Number(p.default);
        if (p.key === "speed") playback.setSpeed(Number(p.default));

        input.addEventListener("input", function () {
          readout.textContent = input.value;
          if (p.key === "speed") {
            playback.setSpeed(Number(input.value));
            return;
          }
          if (p.key === "size") state.n = Number(input.value);
          if (p.key === "orderedness") state.orderedness = Number(input.value);
          if (p.key === "size" || p.key === "orderedness") state.shuffleSalt = 0;
          regenerate();
        });

        row.appendChild(label);
        row.appendChild(input);
        row.appendChild(readout);
        if (p.note) row.appendChild(App.el("p", { class: "hint", text: p.note }));
        paramsBox.appendChild(row);
      });
    }

    /** 三张读数卡，每张同时放左、右两个值（标签同样来自 JSON）。 */
    function buildMetrics(data) {
      App.clear(metricsBox);
      data.metrics.forEach(function (m) {
        var card = App.el("div", { class: "metric", "data-metric": m.key }, [
          App.el("span", { class: "metric-label", text: m.label }),
          App.el("span", { class: "metric-value" }, [
            App.el("span", { class: "mv mv-left", text: "—" }),
            App.el("span", { class: "metric-sep", text: "/" }),
            App.el("span", { class: "mv mv-right", text: "—" }),
          ]),
          App.el("span", { class: "metric-unit", text: m.unit }),
        ]);
        metricsBox.appendChild(card);
      });
    }

    /**
     * 折线读数下拉框：选项同样来自 JSON（chart.metricOptions），默认 chart.metric。
     * 切换只重画折线，不动当前步、树和读数卡。
     */
    function buildChartMetric(data) {
      var chart = data.chart;
      var options = chart.metricOptions && chart.metricOptions.length
        ? chart.metricOptions
        : data.metrics.map(function (m) {
          return {
            key: m.key,
            label: m.label,
            title: chart.title,
            yLabel: chart.yLabel,
            note: chart.note,
          };
        });
      state.chartMetricOptions = options;
      if (chartMetricLabel) chartMetricLabel.textContent = chart.metricLabel || "折线读数";
      if (!chartMetricSelect) return;
      App.clear(chartMetricSelect);
      options.forEach(function (opt) {
        chartMetricSelect.appendChild(App.el("option", { value: opt.key, text: opt.label }));
      });
      chartMetricSelect.value = state.chartMetric;
      chartMetricSelect.addEventListener("change", function () {
        applyChartMeta(chartMetricSelect.value);
        if (!state.caseData) return;
        state.yMax = chartYMax(state.caseData, state.chartMetric);
        if (state.lastSt) drawChart(state.lastSt);
      });
    }

    /** 把当前读数的标题 / 纵轴标签 / 注释同步到页面，坐标轴文字也在 drawChart 里用 chartMeta。 */
    function applyChartMeta(key) {
      var chart = state.data.chart;
      var options = state.chartMetricOptions || [];
      var meta = null;
      for (var i = 0; i < options.length; i++) {
        if (options[i].key === key) meta = options[i];
      }
      if (!meta) meta = chart;
      if (!meta.key) meta = { key: key, label: chart.title, title: chart.title, yLabel: chart.yLabel, note: chart.note };
      state.chartMetric = meta.key;
      state.chartMeta = meta;
      setText("chart-title", meta.title || chart.title);
      setText("chart-note", meta.note || chart.note);
      if (chartSvg && meta.title) chartSvg.setAttribute("aria-label", meta.title);
      if (chartMetricSelect && chartMetricSelect.value !== state.chartMetric) {
        chartMetricSelect.value = state.chartMetric;
      }
    }

    function bindButtons() {
      document.getElementById("btn-play").addEventListener("click", function () {
        playback.play();
      });
      document.getElementById("btn-pause").addEventListener("click", function () {
        playback.pause();
      });
      document.getElementById("btn-prev").addEventListener("click", function () {
        playback.prev();
      });
      document.getElementById("btn-next").addEventListener("click", function () {
        playback.next();
      });
      document.getElementById("btn-reset").addEventListener("click", function () {
        playback.reset();
      });
      var reshuffleBtn = document.getElementById("btn-reshuffle");
      if (reshuffleBtn) {
        reshuffleBtn.addEventListener("click", function () {
          reshuffle();
        });
      }
    }

    /**
     * 「重排」：n 和数值集合都不变，只换左树的插入顺序，然后回到第 1 步。
     * 有序程度偏高、n 偏小时，相邻交换次数会被 round 成 0（升序是唯一顺序），
     * 所以先把有序程度降到 0（滑块与读数同步更新），再按 salt 换一组随机顺序。
     * 0 时是 Fisher–Yates 全排列，8 个 salt 必然换出不同顺序；万一小 n 仍撞车，
     * 就在 hint 里如实说明，而不是让用户以为按钮坏了。
     */
    function reshuffle() {
      var prev = state.caseData ? state.caseData.leftOrder.join(",") : null;
      if (swapsFor(state.n, state.orderedness) === 0) {
        state.orderedness = 0;
        setParamValue("orderedness", 0);
        updateCaptions();
      }
      var salt = state.shuffleSalt;
      var candidate = null;
      var changed = false;
      for (var tries = 0; tries < 8; tries += 1) {
        salt += 1;
        candidate = makeCase(state.seed, state.n, state.orderedness, state.range, salt);
        if (!prev || prev !== candidate.leftOrder.join(",")) {
          changed = true;
          break;
        }
      }
      state.shuffleSalt = salt;
      if (reshuffleNote) {
        reshuffleNote.textContent = state.data ? state.data.labels.reshuffleSame : "";
        reshuffleNote.hidden = changed;
      }
      updateCaptions();
      regenerate();
    }

    /** 让滑块的显示值与 state 同步（重排把有序程度降为 0 时用）。 */
    function setParamValue(key, value) {
      var input = document.getElementById("param-" + key);
      if (!input) return;
      input.value = value;
      var readout = input.parentNode && input.parentNode.querySelector(".readout");
      if (readout) readout.textContent = String(value);
    }

    /** 换了 seed / n / orderedness：暂停 → 重新生成同一批数据 → 回到第 1 步。 */
    function regenerate() {
      if (playback.playing()) playback.pause();
      var caseData = makeCase(state.seed, state.n, state.orderedness, state.range, state.shuffleSalt);
      state.caseData = caseData;
      state.geo = geoFor(caseData.n);
      state.steps = stepsFor(caseData);
      state.yMax = chartYMax(caseData, state.chartMetric);
      hintBox.hidden = !state.geo.compact;
      if (state.geo.compact) hintBox.textContent = state.data.labels.compactHint;
      updateCaptions();
      playback.setSteps(state.steps);
    }

    function updateCaptions() {
      if (!state.data) return;
      var chart = state.data.chart;
      captionLeft.textContent = App.format(state.data.captions.left, { orderedness: state.orderedness });
      captionRight.textContent = App.format(state.data.captions.right, { orderedness: state.orderedness });
      leftSvg.setAttribute("aria-label", captionLeft.textContent);
      rightSvg.setAttribute("aria-label", captionRight.textContent);
      if (chartLegendLeft) {
        chartLegendLeft.textContent = App.format(chart.legendLeft, { orderedness: state.orderedness });
      }
      if (chartLegendRight) chartLegendRight.textContent = chart.legendRight;
    }

    /** 回到「第 index 步」：两棵树都从插入顺序重新建，不读取任何上一步留下的状态。 */
    function renderStep(step) {
      if (!step || !state.data || !state.caseData) return;
      var st = stepState(state.caseData, step.index);
      state.lastSt = st;
      drawTree(leftSvg, st.leftRoot, state.geo, st.newLeft);
      drawTree(rightSvg, st.rightRoot, state.geo, st.newRight);
      updateMetrics(st);
      drawChart(st);
      updateStepText(st);
    }

    function drawTree(svgEl, root, geo, newValue) {
      App.clear(svgEl);
      var count = Tree.size(root);
      var depth = Tree.height(root) - 1;
      var padX = Math.max(EDGE_PAD_X, (COORD_W - (count - 1) * geo.dx) / 2);
      var lay = Tree.layout(root, {
        nodeR: geo.radius,
        dx: geo.dx,
        dy: geo.dy,
        padX: padX,
        padY: EDGE_PAD_Y,
      });
      var boxW = Math.max(COORD_W, lay.width);
      var boxH = Math.max(COORD_H, lay.height);
      svgEl.setAttribute("viewBox", "0 0 " + Math.round(boxW) + " " + Math.round(boxH));
      svgEl.classList.toggle("compact", geo.compact);
      try {
        svgEl.style.setProperty("--d3-font", geo.font.toFixed(2) + "px");
        svgEl.style.setProperty("--d3-stroke", geo.stroke.toFixed(2));
      } catch (e) {
        /* 老浏览器不支持自定义属性也不影响主流程 */
      }

      Tree.render(svgEl, lay, {
        radius: geo.radius,
        nodeClass: function (node) {
          return "node-circle" + (node.value === newValue ? " is-new" : "");
        },
        edgeClass: function () {
          return "edge";
        },
      });
    }

    /**
     * metric 区下方那条折线：左树一条、右树一条，只画到当前步。
     * 所有几何都是 index 的纯函数，所以上一步 / 重置 / 跳步都会得到和当初一样的线。
     */
    function drawChart(st) {
      var chart = state.data.chart;
      var meta = state.chartMeta || chart;
      var series = chartSeries(state.caseData, st.index, state.chartMetric);
      var yMax = state.yMax;
      var left = CHART_PAD.left;
      var top = CHART_PAD.top;
      var plotW = CHART_W - CHART_PAD.left - CHART_PAD.right;
      var plotH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;
      var n = state.caseData.n;

      var xOf = function (v) {
        if (n <= 1) return left + plotW / 2;
        return left + ((v - 1) / (n - 1)) * plotW;
      };
      var yOf = function (v) {
        var ratio = yMax > 0 ? v / yMax : 0;
        return top + plotH - ratio * plotH;
      };
      var pointText = function (list) {
        return list.map(function (p) {
          return round1(xOf(p.x)) + "," + round1(yOf(p.y));
        }).join(" ");
      };

      App.clear(chartSvg);
      chartSvg.setAttribute("viewBox", "0 0 " + CHART_W + " " + CHART_H);

      /* 横向网格 + 纵轴刻度 */
      var tickStep = yMax <= 4 ? 1 : Math.ceil(yMax / 4);
      for (var t = 0; t <= yMax + 1e-9; t += tickStep) {
        var gy = yOf(t);
        chartSvg.appendChild(App.svg("line", {
          class: "chart-grid",
          x1: left, y1: gy, x2: left + plotW, y2: gy,
        }));
        var tick = App.svg("text", { class: "chart-tick", x: left - 6, y: gy + 3, "text-anchor": "end" });
        tick.textContent = fmtNumber(t);
        chartSvg.appendChild(tick);
      }

      /* 坐标轴 */
      chartSvg.appendChild(App.svg("line", { class: "chart-axis", x1: left, y1: top, x2: left, y2: top + plotH }));
      chartSvg.appendChild(App.svg("line", { class: "chart-axis", x1: left, y1: top + plotH, x2: left + plotW, y2: top + plotH }));

      /* 两条折线（左深蓝、右橙红，颜色在 CSS 里） */
      chartSvg.appendChild(App.svg("polyline", { class: "chart-line chart-line-left", points: pointText(series.left) }));
      chartSvg.appendChild(App.svg("polyline", { class: "chart-line chart-line-right", points: pointText(series.right) }));

      var lastLeft = series.left[series.left.length - 1];
      var lastRight = series.right[series.right.length - 1];
      chartSvg.appendChild(App.svg("circle", {
        class: "chart-dot chart-dot-left", cx: xOf(lastLeft.x), cy: yOf(lastLeft.y), r: 2.6,
      }));
      chartSvg.appendChild(App.svg("circle", {
        class: "chart-dot chart-dot-right", cx: xOf(lastRight.x), cy: yOf(lastRight.y), r: 2.6,
      }));
      chartSvg.appendChild(App.svg("line", {
        class: "chart-cursor", x1: xOf(lastLeft.x), y1: top, x2: xOf(lastLeft.x), y2: top + plotH,
      }));

      /* 轴标签（文字来自 JSON） */
      var yLabel = App.svg("text", {
        class: "chart-axis-label",
        x: 12,
        y: top + plotH / 2,
        "text-anchor": "middle",
        transform: "rotate(-90 12 " + (top + plotH / 2) + ")",
      });
      yLabel.textContent = meta.yLabel || chart.yLabel;
      chartSvg.appendChild(yLabel);

      var xLabel = App.svg("text", {
        class: "chart-axis-label", x: left + plotW / 2, y: CHART_H - 8, "text-anchor": "middle",
      });
      xLabel.textContent = chart.xLabel;
      chartSvg.appendChild(xLabel);

      /* 横轴刻度：1 / 中间 / n（n 小的时候避免重复） */
      var tickXs = n <= 1 ? [1] : [1, Math.round(n / 2), n];
      var seen = {};
      tickXs.forEach(function (v) {
        if (v < 1 || v > n || seen[v]) return;
        seen[v] = true;
        var lbl = App.svg("text", {
          class: "chart-tick", x: xOf(v), y: top + plotH + 15, "text-anchor": "middle",
        });
        lbl.textContent = String(v);
        chartSvg.appendChild(lbl);
      });
    }

    function metricValue(key, s) {
      if (key === "height") return String(s.height);
      if (key === "avgSteps") return fmtNumber(s.avgSteps);
      if (key === "worstSteps") return String(s.worstSteps);
      return "—";
    }

    function updateMetrics(st) {
      var data = state.data;
      data.metrics.forEach(function (m) {
        var card = metricsBox.querySelector('.metric[data-metric="' + m.key + '"]');
        if (!card) return;
        card.querySelector(".mv-left").textContent = App.format(data.labels.sideValue, {
          side: data.labels.left,
          value: metricValue(m.key, st.leftStats),
        });
        card.querySelector(".mv-right").textContent = App.format(data.labels.sideValue, {
          side: data.labels.right,
          value: metricValue(m.key, st.rightStats),
        });
      });
    }

    function updateStepText(st) {
      var data = state.data;
      var isLast = st.index === state.caseData.n - 1;
      var vars = {
        i: st.index + 1,
        n: state.caseData.n,
        leftValue: st.newLeft,
        rightValue: st.newRight,
        hLeft: st.leftStats.height,
        hRight: st.rightStats.height,
        aLeft: fmtNumber(st.leftStats.avgSteps),
        aRight: fmtNumber(st.rightStats.avgSteps),
        wLeft: st.leftStats.worstSteps,
        wRight: st.rightStats.worstSteps,
        orderedness: state.orderedness,
      };
      /* 左右插入顺序完全相同时（有序程度 100%，或 k 被取整成 0），要把话说明白：
         这时就不该再说“树高差很多”，而是指出“顺序相同 → 形状相同”，并引导降低有序程度。 */
      var sameOrder =
        state.caseData.leftOrder.join(",") === state.caseData.rightOrder.join(",");
      var doneTemplate = sameOrder && data.steps.doneSame ? data.steps.doneSame : data.steps.done;
      stepBox.textContent = App.format(isLast ? doneTemplate : data.steps.insert, vars);
      if (isLast) {
        var conclusionTemplate = sameOrder && data.conclusionSame ? data.conclusionSame : data.conclusion;
        conclusionBox.textContent = App.format(conclusionTemplate, vars);
        conclusionCard.hidden = false;
      } else {
        conclusionCard.hidden = true;
      }
    }
  }

  /* ================= 导出 ================= */

  var api = {
    /* 纯函数：Node 单测与页面共用同一套实现 */
    mulberry32: mulberry32,
    makeDataset: makeDataset,
    swapsFor: swapsFor,
    leftOrder: leftOrder,
    makeCase: makeCase,
    reshuffleCase: reshuffleCase,
    stats: stats,
    stepState: stepState,
    stepsFor: stepsFor,
    chartSeries: chartSeries,
    chartYMax: chartYMax,
    geoFor: geoFor,
    fmtNumber: fmtNumber,
    /* 方便测试直接建树/查树，不用再 require 一次 */
    buildTree: Tree.buildTree,
    inorder: Tree.inorder,
    height: Tree.height,
    searchSteps: Tree.searchSteps,
    /* 页面入口 */
    mount: mount,
  };

  global.D3 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
