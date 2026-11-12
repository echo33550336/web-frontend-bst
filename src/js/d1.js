/**
 * d1.js —— 难点 1：插入时的比较路径（参数探索型）
 *
 * 一半是纯函数（建树 / 布局 / 区间 / 路径 / 候选位置），不碰 DOM，可以在 Node 里直接测；
 * 一半是这一页专属的交互（拖动滑动条 → 实时重算路径；播放控件 → 逐步演一遍）。
 * 讲解文字全部来自 data/d1.json，这里只负责填变量。
 */
(function (global) {
  "use strict";

  /* 树的纯逻辑与布局都在 tree.js 里；这里只保留本页交互。
     Node 单测直接 require 本文件，所以用 require 兜底加载 tree.js。 */
  var Tree = global.Tree;
  if (!Tree && typeof require === "function") {
    Tree = require("./tree.js");
  }
  if (!Tree) throw new Error("tree.js 必须先于 d1.js 加载");

  var GEO = Tree.GEO;
  var makeNode = Tree.makeNode;
  var insertNode = Tree.insertNode;
  var buildTree = Tree.buildTree;
  var hasValue = Tree.hasValue;
  var inorder = Tree.inorder;
  var layout = Tree.layout;
  var intervals = Tree.intervals;
  var pathFor = Tree.pathFor;
  var countSlots = Tree.countSlots;
  var intervalText = Tree.intervalText;

  /* ================= 渲染与交互 ================= */

  function mount() {
    var App = global.App;
    var svgEl = document.getElementById("canvas");
    var panelInterval = document.getElementById("panel-interval");
    var panelCandidates = document.getElementById("panel-candidates");
    var panelInorder = document.getElementById("panel-inorder");
    var panelStep = document.getElementById("panel-step");
    var statusEl = document.getElementById("status");
    var paramsBox = document.getElementById("params");
    var btnInsert = document.getElementById("btn-insert");
    var btnRegen = document.getElementById("btn-regen");

    var state = { root: null, data: null, value: 0, speed: 2, steps: [], hops: [] };
    var playback = new App.Playback({
      onRender: function (step) {
        renderStep(step);
      },
      onState: function (i, total, playing) {
        statusEl.textContent = "第 " + (i + 1) + " / " + total + " 步" + (playing ? " · 播放中" : "");
      },
    });

    App.loadJSON("../data/d1.json")
      .then(function (data) {
        state.data = data;
        ["page-title:title", "page-subtitle:subtitle", "page-howto:howToUse"].forEach(function (pair) {
          var parts = pair.split(":");
          var node = document.getElementById(parts[0]);
          if (node) node.textContent = data[parts[1]];
        });
        state.root = buildTree(data.tree.initial);
        buildParams(data, paramsBox, state, onParamChange);
        state.value = data.params[0].default;
        state.speed = data.params[1].default;
        bindButtons();
        refreshPreview();
        updateInorder();
        if (App.progress) App.progress.visit("d1");
      })
      .catch(function (err) {
        App.showError(document.getElementById("panel-step"), err);
      });

    function buildParams(data, box, st, onChange) {
      App.clear(box);
      data.params.forEach(function (p, idx) {
        var row = App.el("div", { class: "param" });
        var label = App.el("label", { text: p.label });
        var input = App.el("input", {
          type: "range",
          min: p.min,
          max: p.max,
          step: p.step,
          value: p.default,
          id: "param-" + p.key,
        });
        var readout = App.el("span", { class: "readout", text: String(p.default) });
        label.setAttribute("for", "param-" + p.key);
        input.addEventListener("input", function () {
          readout.textContent = input.value;
          onChange(idx, Number(input.value));
        });
        row.appendChild(label);
        row.appendChild(input);
        row.appendChild(readout);
        box.appendChild(row);
      });
    }

    function onParamChange(idx, v) {
      if (idx === 0) {
        state.value = v;
        refreshPreview();
      } else {
        state.speed = v;
        playback.setSpeed(v);
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
      btnInsert.addEventListener("click", function () {
        if (hasValue(state.root, state.value)) {
          panelStep.textContent = "这个值已经存在，BST 里不重复插入。换一个数试试。";
          return;
        }
        state.steps = buildSteps(state.root, state.value);
        playback.setSteps(state.steps);
        playback.play();
      });
      btnRegen.addEventListener("click", function () {
        state.root = randomTree(7);
        playback.setSteps([]);
        refreshPreview();
        updateInorder();
      });
    }

    function randomTree(n) {
      var pool = [];
      while (pool.length < n) {
        var v = 1 + Math.floor(Math.random() * 99);
        if (pool.indexOf(v) === -1) pool.push(v);
      }
      return buildTree(pool);
    }

    function updateInorder() {
      panelInorder.textContent = inorder(state.root).join(" · ");
    }

    /** 拖动滑动条时：不算"步骤"，只是一次完整的路径预览 */
    function refreshPreview() {
      var p = pathFor(state.root, state.value);
      state.hops = p.hops;
      state.steps = buildSteps(state.root, state.value);
      draw(p.hops.length - 1, state.value, false);
      fillIntervalPanel(p.hops, p.hops.length - 1);
      panelCandidates.textContent = String(countSlots(state.root, p.lo, p.hi));
      panelStep.textContent = p.duplicate
        ? "这个值已经存在，BST 里不重复插入。换一个数试试。"
        : "拖动滑块会实时预览落点；点「插入演示」看它一步步落下去。";
      playback.setSteps(state.steps, true);
      statusEl.textContent = "预览中 · 共 " + state.steps.length + " 步";
    }

    /* ---- 步骤序列：设定 → 每跳一步 → 落到空位 → 挂接校验 ---- */
    function buildSteps(root, value) {
      var p = pathFor(root, value);
      var steps = [{ kind: "set", hop: -1 }];
      p.hops.forEach(function (h, i) {
        steps.push({ kind: "hop", hop: i });
      });
      steps.push({ kind: "land", hop: p.hops.length });
      steps.push({ kind: "attach", hop: p.hops.length });
      return steps;
    }

    function renderStep(step) {
      if (!step) return;
      var d = state.data;
      var root = state.root;
      var p = pathFor(root, state.value);

      if (step.kind === "attach") {
        state.root = insertNode(root, state.value);
        updateInorder();
        draw(-1, null, true);
        panelCandidates.textContent = "0";
        panelStep.textContent = App.format(d.steps.attach, {
          value: state.value,
          inorder: inorder(state.root).join(" · "),
        });
        return;
      }

      if (step.kind === "set") {
        draw(-1, state.value, false);
        fillIntervalPanel([], -1);
        panelCandidates.textContent = String(countSlots(root, -Infinity, Infinity));
        panelStep.textContent = App.format(d.steps.set, {
          value: state.value,
          interval: intervalText(-Infinity, Infinity),
          candidates: countSlots(root, -Infinity, Infinity),
        });
        return;
      }

      if (step.kind === "hop") {
        var h = p.hops[step.hop];
        draw(step.hop, state.value, false);
        fillIntervalPanel(p.hops, step.hop);
        var before = countSlots(root, h.lo, h.hi);
        var after = countSlots(root, h.nextLo, h.nextHi);
        panelCandidates.textContent = String(after);
        panelStep.textContent = App.format(d.steps.hop, {
          value: state.value,
          node: h.node.value,
          cmp: h.dir === "right" ? ">" : "<",
          dir: h.dir === "right" ? "右" : "左",
          interval: intervalText(h.lo, h.hi),
          nextInterval: intervalText(h.nextLo, h.nextHi),
          candBefore: before,
          candAfter: after,
        });
        return;
      }

      if (step.kind === "land") {
        draw(p.hops.length, state.value, false);
        fillIntervalPanel(p.hops, p.hops.length - 1);
        panelCandidates.textContent = "1";
        panelStep.textContent = App.format(d.steps.land, { value: state.value });
      }
    }

    /** 画树。activeHop = -1 表示还没开始比较 */
    function draw(activeHop, previewValue, highlightNew) {
      var root = state.root;
      var lay = layout(root);
      var iv = intervals(root);
      var p = pathFor(root, state.value);

      App.clear(svgEl);
      svgEl.setAttribute("viewBox", "0 0 " + Math.max(lay.width, 200) + " " + Math.max(lay.height, 120));

      function onPath(node) {
        for (var i = 0; i <= activeHop && i < p.hops.length; i += 1) {
          if (p.hops[i].node === node) return true;
        }
        return false;
      }

      Tree.render(svgEl, lay, {
        showIntervals: true,
        intervalsMap: iv,
        edgeClass: function (e) {
          return onPath(e.from) ? "edge on-path" : "edge";
        },
        nodeClass: function (n) {
          return "node-circle" + (onPath(n) ? " on-path" : "") +
            (highlightNew && n.value === state.value ? " is-new" : "");
        },
      });
    }

    function fillIntervalPanel(hops, activeHop) {
      App.clear(panelInterval);
      var chain = [intervalText(-Infinity, Infinity)];
      for (var i = 0; i <= activeHop && i < hops.length; i += 1) {
        chain.push(intervalText(hops[i].nextLo, hops[i].nextHi));
      }
      chain.forEach(function (t, i) {
        panelInterval.appendChild(App.el("li", { text: t, class: i === chain.length - 1 ? "now" : "" }));
      });
    }
  }

  var api = {
    makeNode: makeNode,
    insertNode: insertNode,
    buildTree: buildTree,
    inorder: inorder,
    layout: layout,
    intervals: intervals,
    pathFor: pathFor,
    countSlots: countSlots,
    intervalText: intervalText,
    mount: mount,
  };

  global.D1 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
