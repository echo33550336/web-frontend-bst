/**
 * tree.js —— 三个难点共用的二叉搜索树模块
 *
 * 只做三件事：
 *   1. 纯逻辑：建树 / 插入 / 删除 / 中序 / 区间 / 比较路径 / 统计；
 *   2. 布局：中序序号当 x、深度当 y —— BST 天然可以这么摆，不需要迭代收敛；
 *   3. 按统一样式把树画到 SVG 上。
 *
 * 页面特有的东西（高亮哪条路径、指针画在哪、A/B/C 判定）留在 d1.js / d2.js / d3.js。
 * 纯函数不碰 DOM，Node 下可以直接 require 做单测。
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
    return findNode(root, value) !== null;
  }

  function findNode(root, value) {
    var cur = root;
    while (cur) {
      if (value === cur.value) return cur;
      cur = value < cur.value ? cur.left : cur.right;
    }
    return null;
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

  /** 中序序号当 x、深度当 y；返回的 x()/y() 直接拿去画 */
  function layout(root, geo) {
    geo = geo || GEO;
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
      root: root,
      nodes: nodes,
      edges: edges,
      depthMax: depthMax,
      x: function (n) {
        return geo.padX + n._col * geo.dx;
      },
      y: function (n) {
        return geo.padY + n._row * geo.dy;
      },
      width: geo.padX * 2 + Math.max(0, nodes.length - 1) * geo.dx,
      height: geo.padY * 2 + depthMax * geo.dy,
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

  /** 当前区间里还剩多少个"可能的位置"（空指针位） */
  function countSlots(root, lo, hi) {
    if (lo >= hi) return 0;
    var count = 0;
    (function walk(n, lo, hi) {
      if (lo >= hi) return;
      if (!n) {
        count += 1;
        return;
      }
      walk(n.left, lo, Math.min(hi, n.value));
      walk(n.right, Math.max(lo, n.value), hi);
    })(root, lo, hi);
    return count;
  }

  function intervalText(lo, hi) {
    var a = lo === -Infinity ? "−∞" : String(lo);
    var b = hi === Infinity ? "+∞" : String(hi);
    return "(" + a + ", " + b + ")";
  }

  /** 树高 = 层数（空树 0，单节点 1） */
  function height(root) {
    if (!root) return 0;
    return 1 + Math.max(height(root.left), height(root.right));
  }

  function size(root) {
    if (!root) return 0;
    return 1 + size(root.left) + size(root.right);
  }

  /** 查一个值要比较几次（根算 1 次）；不在树里返回 -1 */
  function searchSteps(root, value) {
    var steps = 0;
    var cur = root;
    while (cur) {
      steps += 1;
      if (value === cur.value) return steps;
      cur = value < cur.value ? cur.left : cur.right;
    }
    return -1;
  }

  /** 中序后继的值（比 value 大的最小值）；不存在返回 null */
  function successorValue(root, value) {
    var cur = root;
    var best = null;
    while (cur) {
      if (value < cur.value) {
        best = cur.value;
        cur = cur.left;
      } else {
        cur = cur.right;
      }
    }
    return best;
  }

  /** 中序前驱的值（比 value 小的最大值）；不存在返回 null */
  function predecessorValue(root, value) {
    var cur = root;
    var best = null;
    while (cur) {
      if (value > cur.value) {
        best = cur.value;
        cur = cur.right;
      } else {
        cur = cur.left;
      }
    }
    return best;
  }

  /**
   * 标准 BST 删除（双孩子用中序后继替换），返回 { root, removed }。
   * 页面上那棵树是逐步动画的；这个函数用于"最后校验"和单测，保证算法本身没写错。
   */
  function removeNode(root, value) {
    var removed = false;
    function del(n, v) {
      if (!n) return null;
      if (v < n.value) {
        n.left = del(n.left, v);
        return n;
      }
      if (v > n.value) {
        n.right = del(n.right, v);
        return n;
      }
      removed = true;
      if (!n.left) return n.right;
      if (!n.right) return n.left;
      // 双孩子：找到右子树最小值（中序后继），把它摘下来顶替当前节点
      var succParent = n;
      var succ = n.right;
      while (succ.left) {
        succParent = succ;
        succ = succ.left;
      }
      if (succParent !== n) {
        succParent.left = succ.right;
        succ.right = n.right;
      }
      succ.left = n.left;
      return succ;
    }
    return { root: del(root, value), removed: removed };
  }

  /* ================= 渲染 ================= */

  var SVG_NS = "http://www.w3.org/2000/svg";

  function svgNode(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (attrs[k] !== undefined && attrs[k] !== null) node.setAttribute(k, attrs[k]);
      });
    }
    return node;
  }

  /**
   * 把一棵已经 layout 过的树画到 svgEl 上。opts 全部可选：
   *   radius        节点半径，默认 GEO.nodeR
   *   nodeClass     function(node) → circle 的 class（默认 "node-circle"）
   *   edgeClass     function(edge) → line 的 class（默认 "edge"）
   *   showIntervals 是否在节点下方画允许区间
   *   intervalsMap  先算好的 Tree.intervals(root)，省得重复算
   *   intervalLabel function(node, band) → 区间文字
   */
  function render(svgEl, lay, opts) {
    opts = opts || {};
    var r = opts.radius || GEO.nodeR;
    var band = opts.intervalsMap || null;

    lay.edges.forEach(function (e) {
      var cls = opts.edgeClass ? opts.edgeClass(e) : "edge";
      if (!cls) return;
      svgEl.appendChild(
        svgNode("line", {
          x1: lay.x(e.from),
          y1: lay.y(e.from),
          x2: lay.x(e.to),
          y2: lay.y(e.to),
          class: cls,
        })
      );
    });

    lay.nodes.forEach(function (n) {
      var g = svgNode("g", { class: "node" });
      var circleCls = opts.nodeClass ? opts.nodeClass(n) : "node-circle";
      g.appendChild(svgNode("circle", { cx: lay.x(n), cy: lay.y(n), r: r, class: circleCls }));
      var text = svgNode("text", { x: lay.x(n), y: lay.y(n), class: "node-value" });
      text.textContent = n.value;
      g.appendChild(text);

      if (opts.showIntervals) {
        var band2 = band && band[n.id];
        var lab = svgNode("text", {
          x: lay.x(n),
          y: lay.y(n) + r + 13,
          class: "node-interval",
        });
        lab.textContent = opts.intervalLabel
          ? opts.intervalLabel(n, band2)
          : intervalText(band2.lo, band2.hi);
        g.appendChild(lab);
      }

      svgEl.appendChild(g);
    });
  }

  var api = {
    GEO: GEO,
    makeNode: makeNode,
    insertNode: insertNode,
    buildTree: buildTree,
    hasValue: hasValue,
    findNode: findNode,
    inorder: inorder,
    layout: layout,
    intervals: intervals,
    pathFor: pathFor,
    countSlots: countSlots,
    intervalText: intervalText,
    height: height,
    size: size,
    searchSteps: searchSteps,
    successorValue: successorValue,
    predecessorValue: predecessorValue,
    removeNode: removeNode,
    render: render,
  };

  global.Tree = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

