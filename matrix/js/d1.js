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
    var inorderCheck = document.getElementById("inorder-check");
    var panelStep = document.getElementById("panel-step");
    var panelStepTitle = document.getElementById("panel-step-title");
    var statusEl = document.getElementById("status");
    var paramsBox = document.getElementById("params");
    var btnInsert = document.getElementById("btn-insert");
    var btnRegen = document.getElementById("btn-regen");

    // baseRoot 是「这一轮演示开始时」的树：重播时仍从它出发，避免把已插入的值算成重复。
    var state = {
      root: null,
      baseRoot: null,
      data: null,
      value: 0,
      size: 7,
      speed: 2,
      steps: [],
      hops: [],
    };
    var playback = new App.Playback({
      onRender: function (step) {
        renderStep(step);
      },
      onState: function (i, total, playing) {
        statusEl.textContent = "第 " + (i + 1) + " / " + total + " 步" + (playing ? " · 播放中" : "");
      },
    });

    App.loadJSON("data/d1.json")
      .then(function (data) {
        state.data = data;
        var byKey = {};
        data.params.forEach(function (p) {
          byKey[p.key] = p;
        });
        state.value = byKey.value ? byKey.value.default : 65;
        state.size = byKey.size ? byKey.size.default : data.tree.initial.length;
        state.speed = byKey.speed ? byKey.speed.default : 2;

        state.root = buildTree(data.tree.initial);
        state.baseRoot = state.root;

        applyTexts(data);
        buildParams(data, paramsBox, state, onParamChange);
        bindButtons();
        refreshPreview();
        updateInorder();
        if (App.progress) App.progress.visit("d1");
      })
      .catch(function (err) {
        App.showError(document.getElementById("panel-step"), err);
      });

    function setText(id, text) {
      var node = document.getElementById(id);
      if (node && text) node.textContent = text;
    }

    function applyTexts(data) {
      setText("page-title", data.title);
      setText("page-subtitle", data.subtitle);
      setText("page-howto", data.howToUse);
      var labels = data.labels || {};
      setText("card-params-title", labels.params);
      setText("card-interval-title", labels.interval);
      setText("card-inorder-title", labels.inorder);
      setText("card-step-title", labels.step);
      setText("candidates-label", labels.candidates);
    }

    function buildParams(data, box, st, onChange) {
      App.clear(box);
      data.params.forEach(function (p) {
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
          onChange(p.key, Number(input.value));
        });
        row.appendChild(label);
        row.appendChild(input);
        row.appendChild(readout);
        box.appendChild(row);
      });
    }

    function onParamChange(key, v) {
      if (key === "value") {
        state.value = v;
        refreshPreview();
      } else if (key === "speed") {
        state.speed = v;
        playback.setSpeed(v);
      } else if (key === "size") {
        state.size = v;
        regenerate();
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
        // 重置回到这一轮演示开始时的树（撤销 attach 步的挂接）
        state.root = state.baseRoot || state.root;
        playback.reset();
        updateInorder();
      });
      btnInsert.addEventListener("click", function () {
        if (hasValue(state.root, state.value)) {
          state.steps = [];
          playback.setSteps([]);
          setTransportDisabled(true);
          panelStepTitle.textContent = state.data.titles.set;
          panelStep.textContent = state.data.messages.duplicate;
          return;
        }
        state.baseRoot = state.root;
        state.steps = buildSteps(state.baseRoot, state.value);
        playback.setSteps(state.steps);
        setTransportDisabled(false);
        playback.play();
      });
      btnRegen.addEventListener("click", regenerate);
    }

    /** 深拷贝一棵树：插入会原地改节点，重播时必须从「演示开始时的树」复制一份 */
    function cloneTree(n) {
      if (!n) return null;
      var copy = makeNode(n.value);
      copy.left = cloneTree(n.left);
      copy.right = cloneTree(n.right);
      return copy;
    }

    function regenerate() {
      playback.pause();
      state.root = randomTree(state.size);
      state.baseRoot = state.root;
      playback.setSteps([]);
      refreshPreview();
      updateInorder();
      if (state.data) {
        panelStepTitle.textContent = state.data.labels.preview || "";
        panelStep.textContent = App.format(state.data.messages.regen, { size: state.size });
      }
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
      var seq = inorder(state.root);
      panelInorder.textContent = seq.join(" · ");
      var ok = true;
      for (var i = 1; i < seq.length; i += 1) {
        if (seq[i - 1] >= seq[i]) {
          ok = false;
          break;
        }
      }
      if (inorderCheck && state.data) {
        inorderCheck.textContent = ok ? state.data.messages.inorderOk : state.data.messages.inorderBad;
      }
    }

    /** 重复值 / 空步骤时禁用播放与单步，避免「没插入却播完成功」 */
    function setTransportDisabled(disabled) {
      ["btn-play", "btn-prev", "btn-next"].forEach(function (id) {
        var btn = document.getElementById(id);
        if (btn) btn.disabled = !!disabled;
      });
    }

    /** 拖动滑动条时：不算"步骤"，只是一次完整的路径预览 */
    function refreshPreview() {
      state.baseRoot = state.root;
      var p = pathFor(state.baseRoot, state.value);
      state.hops = p.hops;
      if (p.duplicate) {
        // 重复值不会插入：清空步骤并禁用播放，只保留路径预览
        state.steps = [];
        playback.setSteps([], true);
        setTransportDisabled(true);
        draw(p.hops.length - 1, state.value, false);
        fillIntervalPanel(p.hops, p.hops.length - 1);
        panelCandidates.textContent = String(countSlots(state.root, p.lo, p.hi));
        panelStepTitle.textContent = state.data ? state.data.labels.preview || "" : "";
        panelStep.textContent = state.data ? state.data.messages.duplicate : "这个值已经存在。";
        statusEl.textContent = state.data ? state.data.messages.duplicate : "重复值不会插入";
        return;
      }
      state.steps = buildSteps(state.baseRoot, state.value);
      draw(p.hops.length - 1, state.value, false);
      fillIntervalPanel(p.hops, p.hops.length - 1);
      panelCandidates.textContent = String(countSlots(state.root, p.lo, p.hi));
      panelStepTitle.textContent = state.data ? state.data.labels.preview || "" : "";
      panelStep.textContent = state.data ? state.data.messages.dragHint : "";
      playback.setSteps(state.steps, true);
      setTransportDisabled(false);
      statusEl.textContent = state.data
        ? App.format(state.data.messages.preview, { count: state.steps.length })
        : "预览中 · 共 " + state.steps.length + " 步";
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

    function setStepTitle(kind, vars) {
      if (!state.data || !state.data.titles) return;
      var tpl = state.data.titles[kind];
      if (tpl) panelStepTitle.textContent = App.format(tpl, vars || {});
    }

    function renderStep(step) {
      if (!step) return;
      // 回退到 attach 之前的步骤时，把画面恢复到「还没挂接」的树，
      // 中序面板也要跟着回来，否则会出现「画布 7 个节点、中序却有 65」的矛盾。
      if (step.kind !== "attach" && state.baseRoot) {
        state.root = state.baseRoot;
        updateInorder();
      }
      var d = state.data;
      var root = state.baseRoot || state.root;
      var p = pathFor(root, state.value);

      if (step.kind === "attach") {
        if (hasValue(root, state.value)) {
          // 防御：重复值即使绕过按钮进入步骤序列，也不能假装挂接成功
          panelStepTitle.textContent = d.titles.set;
          panelStep.textContent = d.messages.duplicate;
          return;
        }
        state.root = insertNode(cloneTree(root), state.value);
        updateInorder();
        draw(-1, null, true);
        panelCandidates.textContent = "0";
        setStepTitle("attach", { value: state.value });
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
        setStepTitle("set", { value: state.value });
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
        setStepTitle("hop", { node: h.node.value });
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
        setStepTitle("land", { value: state.value });
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

      // 只有「真正走过」的连续 hop 边才算路径；只按端点是否在路径上判断
      // 会把路径节点的左右两条孩子边都点亮，正好和「只沿一个方向走」相反。
      var pathEdges = {};
      for (var pi = 0; pi < activeHop && pi + 1 < p.hops.length; pi += 1) {
        pathEdges[p.hops[pi].node.id + "|" + p.hops[pi + 1].node.id] = true;
      }

      Tree.render(svgEl, lay, {
        showIntervals: true,
        intervalsMap: iv,
        edgeClass: function (e) {
          var key = e.from.id + "|" + e.to.id;
          return pathEdges[key] ? "edge on-path" : "edge";
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

