/**
 * d1.js —— 难点 1：插入时的比较路径（参数探索型）
 *
 * 一半是纯函数（建树 / 布局 / 区间 / 路径 / 候选位置），不碰 DOM，可以在 Node 里直接测；
 * 一半是这一页专属的交互（拖动滑动条 → 实时重算路径；播放控件 → 逐步演一遍）。
 * 讲解文字全部来自 data/d1.json，这里只负责填变量。
 */
(function (global) {
  "use strict";

  var GEO = { nodeR: 19, dx: 74, dy: 82, padX: 46, padY: 40 };

  /* ================= 纯逻辑 ================= */

  function makeNode(value) {
    return { id: "n" + value, value: value, left: null, right: null };
  }

  function insertNode(root, value) {
    if (!root) return makeNode(value);
    var cur = root;
    for (;;) {
      if (value === cur.value) return root;
      if (value < cur.value) {
        if (!cur.left) {
          cur.left = makeNode(value);
          return root;
        }
        cur = cur.left;
      } else {
        if (!cur.right) {
          cur.right = makeNode(value);
          return root;
        }
        cur = cur.right;
      }
    }
  }

  function buildTree(values) {
    var root = null;
    values.forEach(function (v) {
      root = insertNode(root, v);
    });
    return root;
  }

  function hasValue(root, value) {
    var cur = root;
    while (cur) {
      if (value === cur.value) return true;
      cur = value < cur.value ? cur.left : cur.right;
    }
    return false;
  }

  function inorder(root) {
    var out = [];
    (function walk(n) {
      if (!n) return;
      walk(n.left);
      out.push(n.value);
      walk(n.right);
    })(root);
    return out;
  }

  /** 中序序号当 x、深度当 y —— BST 的布局天然可以这么算，不需要任何迭代收敛 */
  function layout(root) {
    var nodes = [];
    var edges = [];
    var depthMax = 0;
    (function walk(n, depth) {
      if (!n) return;
      walk(n.left, depth + 1);
      n._col = nodes.length;
      n._row = depth;
      depthMax = Math.max(depthMax, depth);
      nodes.push(n);
      walk(n.right, depth + 1);
    })(root, 0);
    (function walk(n) {
      if (!n) return;
      if (n.left) edges.push({ from: n, to: n.left });
      if (n.right) edges.push({ from: n, to: n.right });
      walk(n.left);
      walk(n.right);
    })(root);
    return {
      nodes: nodes,
      edges: edges,
      depthMax: depthMax,
      x: function (n) {
        return GEO.padX + n._col * GEO.dx;
      },
      y: function (n) {
        return GEO.padY + n._row * GEO.dy;
      },
      width: GEO.padX * 2 + Math.max(0, nodes.length - 1) * GEO.dx,
      height: GEO.padY * 2 + depthMax * GEO.dy,
    };
  }

  /** 每个节点"允许的取值范围"，由祖先路径决定 */
  function intervals(root) {
    var map = {};
    (function walk(n, lo, hi) {
      if (!n) return;
      map[n.id] = { lo: lo, hi: hi };
      walk(n.left, lo, n.value);
      walk(n.right, n.value, hi);
    })(root, -Infinity, Infinity);
    return map;
  }

  /** 从根走到空位，沿途记下每一次比较 */
  function pathFor(root, value) {
    var hops = [];
    var n = root;
    var lo = -Infinity;
    var hi = Infinity;
    while (n) {
      var dir = value < n.value ? "left" : "right";
      var nextLo = dir === "left" ? lo : n.value;
      var nextHi = dir === "left" ? n.value : hi;
      hops.push({ node: n, dir: dir, lo: lo, hi: hi, nextLo: nextLo, nextHi: nextHi });
      lo = nextLo;
      hi = nextHi;
      n = dir === "left" ? n.left : n.right;
    }
    return { hops: hops, lo: lo, hi: hi, duplicate: hasValue(root, value) };
  }

  /** 当前区间里还剩多少个"可能的位置"（空指针位），这是"每层砍一半"的可读数字 */
  function countSlots(root, lo, hi) {
    if (lo >= hi) return 0;
    var count = 0;
    (function walk(n, lo, hi) {
      if (lo >= hi) return;
      if (!n) {
        count += 1;
        return;
      }
      // 注意：n.value 可能落在区间外（祖先已经把范围收窄了），所以要用 max/min 收紧
      walk(n.left, lo, Math.min(hi, n.value));
      walk(n.right, Math.max(lo, n.value), hi);
    })(root, lo, hi);
    return count;
  }

  /* ================= 渲染与交互 ================= */

  function intervalText(lo, hi) {
    var a = lo === -Infinity ? "−∞" : String(lo);
    var b = hi === Infinity ? "+∞" : String(hi);
    return "(" + a + ", " + b + ")";
  }

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

      // 先画边
      lay.edges.forEach(function (e) {
        var onPath = false;
        for (var i = 0; i <= activeHop && i < p.hops.length; i += 1) {
          if (p.hops[i].node === e.from) onPath = true;
        }
        svgEl.appendChild(
          App.svg("line", {
            x1: lay.x(e.from),
            y1: lay.y(e.from),
            x2: lay.x(e.to),
            y2: lay.y(e.to),
            class: onPath ? "edge on-path" : "edge",
          })
        );
      });

      // 再画节点
      lay.nodes.forEach(function (n) {
        var g = App.svg("g", { class: "node" });
        var onPath = false;
        for (var i = 0; i <= activeHop && i < p.hops.length; i += 1) {
          if (p.hops[i].node === n) onPath = true;
        }
        var circle = App.svg("circle", {
          cx: lay.x(n),
          cy: lay.y(n),
          r: GEO.nodeR,
          class:
            (onPath ? "node-circle on-path" : "node-circle") +
            (highlightNew && n.value === state.value ? " is-new" : ""),
        });
        var text = App.svg("text", { x: lay.x(n), y: lay.y(n), class: "node-value" });
        text.textContent = n.value;
        g.appendChild(circle);
        g.appendChild(text);

        var it = iv[n.id];
        var lab = App.svg("text", {
          x: lay.x(n),
          y: lay.y(n) + GEO.nodeR + 13,
          class: "node-interval",
        });
        lab.textContent = intervalText(it.lo, it.hi);
        g.appendChild(lab);
        svgEl.appendChild(g);
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
