/**
 * d2.js —— 难点 2：删除双孩子节点（步进推演型 + 一次操作判定）
 *
 * 分成两半：
 *   1. 纯逻辑：planDeletion() 一次性算出三种删除情形的全部步骤与每一步的树快照，
 *      不碰 DOM，Node 下可以直接 require 做单测（test/d2.test.js）；
 *   2. 页面交互：把当前步骤的快照画到 SVG，处理播放控件、点击选目标、A/B/C 判定。
 *
 * 关键约束：每一步的画面只由「步骤索引 + 快照」决定，绝不污染上一棵树，
 * 所以上一步 / 重置 / 任意跳步都能正确重算。
 */
(function (global) {
  "use strict";

  var Tree = global.Tree;
  if (!Tree && typeof require === "function") {
    Tree = require("./tree.js");
  }
  if (!Tree) throw new Error("tree.js 必须先于 d2.js 加载");

  /* ============================================================
   * 第一部分：纯逻辑（可在 Node 里单测）
   * ============================================================ */

  function normalizeStrategy(s) {
    if (s === "predecessor" || s === "前驱" || s === "中序前驱") return "predecessor";
    return "successor";
  }

  function cloneTree(n) {
    if (!n) return null;
    return { id: n.id, value: n.value, left: cloneTree(n.left), right: cloneTree(n.right) };
  }

  function countChildren(n) {
    return (n.left ? 1 : 0) + (n.right ? 1 : 0);
  }

  function caseOfNode(n) {
    var c = countChildren(n);
    if (c === 0) return "leaf";
    if (c === 1) return "single";
    return "double";
  }

  /** 只判断情形：0 个孩子 leaf / 1 个孩子 single / 2 个孩子 double；目标不存在返回 null */
  function caseOf(initialValues, targetValue) {
    var root = Tree.buildTree((initialValues || []).slice());
    var target = Tree.findNode(root, targetValue);
    return target ? caseOfNode(target) : null;
  }

  function findParent(root, value) {
    var parent = null;
    var side = null;
    var cur = root;
    while (cur) {
      if (value === cur.value) return { parent: parent, side: side };
      parent = cur;
      if (value < cur.value) {
        side = "left";
        cur = cur.left;
      } else {
        side = "right";
        cur = cur.right;
      }
    }
    return { parent: null, side: null };
  }

  function pathIds(root, value) {
    return Tree.pathFor(root, value).hops.map(function (h) {
      return h.node.id;
    });
  }

  function isSorted(seq) {
    for (var i = 1; i < seq.length; i += 1) {
      if (!(seq[i - 1] < seq[i])) return false;
    }
    return true;
  }

  /** 中序严格递增 + 每个节点都落在自己的允许区间内 */
  function isBST(root) {
    if (!root) return true;
    var ino = Tree.inorder(root);
    if (!isSorted(ino)) return false;
    var iv = Tree.intervals(root);
    var ok = true;
    (function walk(n) {
      if (!n) return;
      var band = iv[n.id];
      if (!band || !(n.value > band.lo && n.value < band.hi)) ok = false;
      walk(n.left);
      walk(n.right);
    })(root);
    return ok;
  }

  /** 用中序前驱替换的删除（tree.js 的 removeNode 用后继；这里补另一种策略） */
  function removePredecessorRoot(root, value) {
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
      var predParent = n;
      var pred = n.left;
      while (pred.right) {
        predParent = pred;
        pred = pred.right;
      }
      if (predParent !== n) {
        predParent.right = pred.left;
        pred.left = n.left;
      }
      pred.right = n.right;
      return pred;
    }
    return { root: del(root, value), removed: removed };
  }

  /** 按策略删除，返回新的根（输入树不会被改动） */
  function removeByStrategy(root, value, strategy) {
    if (!root) return root;
    if (normalizeStrategy(strategy) === "predecessor") {
      return removePredecessorRoot(cloneTree(root), value).root;
    }
    return Tree.removeNode(cloneTree(root), value).root;
  }

  /** 从被删节点出发找到替换节点：后继 = 右子树一路向左；前驱 = 左子树一路向右 */
  function searchReplacement(root, target, strategy) {
    var start = strategy === "successor" ? target.right : target.left;
    var node = start;
    var parent = target;
    var walk = [start];
    if (strategy === "successor") {
      while (node.left) {
        parent = node;
        node = node.left;
        walk.push(node);
      }
    } else {
      while (node.right) {
        parent = node;
        node = node.right;
        walk.push(node);
      }
    }
    return {
      node: node,
      parent: parent,
      start: start,
      walk: walk,
      value: node.value,
      child: strategy === "successor" ? node.right : node.left,
    };
  }

  /** 记住某个节点在「动手之前」的坐标，用来画悬空的幽灵节点 */
  function ghostAt(root, value, kind) {
    var copy = cloneTree(root);
    var lay = Tree.layout(copy);
    var node = Tree.findNode(copy, value);
    if (!node) return null;
    return { value: value, x: lay.x(node), y: lay.y(node), kind: kind || "removed" };
  }

  function copyArrows(list) {
    return list.map(function (a) {
      var o = {};
      Object.keys(a).forEach(function (k) {
        o[k] = a[k];
      });
      return o;
    });
  }

  /**
   * 错误选项 C 的演示：直接把右孩子（或左孩子）提上来顶替被删节点，
   * 被删节点另一侧的子树没有位置可挂，整块断链丢失。
   * 注意：剩下的那部分树仍然是有序的——C 的错误是「丢了节点、断了链」。
   */
  function brokenDemoFor(initialRoot, targetValue, strategy) {
    var root = cloneTree(initialRoot);
    var expected = Tree.inorder(initialRoot);
    var target = Tree.findNode(root, targetValue);
    var info = findParent(root, targetValue);
    var child = strategy === "successor" ? target.right : target.left;
    var orphan = strategy === "successor" ? target.left : target.right;
    // 让 C 顶到被删节点的位置（只改父指针，不处理另一侧子树）
    if (!info.parent) root = child;
    else if (info.side === "left") info.parent.left = child;
    else info.parent.right = child;
    var reachable = Tree.inorder(root);
    // 被删的目标本身是「按计划删除」的，不算 C 造成的丢失；C 丢的是它另一侧的子树
    var lost = expected.filter(function (v) {
      return v !== targetValue && reachable.indexOf(v) === -1;
    });
    return {
      kind: "broken",
      option: "C",
      root: root,
      promotedValue: child.value,
      orphan: cloneTree(orphan),
      orphanRootValue: orphan ? orphan.value : null,
      reachableInorder: reachable,
      expectedInorder: expected,
      lostValues: lost,
      intact: false,
    };
  }

  /** 选错「另一种也成立」的方案时的对照：那种替换确实能保持有序，但不是当前策略 */
  function alternativeDemoFor(initialRoot, targetValue, strategy) {
    var other = strategy === "successor" ? "predecessor" : "successor";
    var altRoot = removeByStrategy(initialRoot, targetValue, other);
    return {
      kind: "wrong-strategy",
      option: strategy === "successor" ? "B" : "A",
      alternativeRoot: altRoot,
      alternativeInorder: Tree.inorder(altRoot),
      expectedInorder: Tree.inorder(initialRoot),
      intact: true,
    };
  }

  /**
   * 核心纯函数：为一次删除生成全部步骤与快照。
   *
   * 返回 { case, targetValue, strategy, steps, choose, wrongDemos, finalRoot, finalInorder }
   *   steps[i] = { key, index, vars, snapshot }
   *   snapshot = { root, targetId, inorder, orderOk, intervalOk, marks, ghost, arrows, verified, showIntervals }
   *
   * 步骤 key：
   *   叶子：pick → detachLeaf → verify
   *   单孩子：pick → attachOnlyChild → verify
   *   双孩子：pick → enterRight/enterLeft → walkLeft/walkRight → found → choose → detach → attach → verify
   */
  function planDeletion(initialValues, targetValue, strategy) {
    strategy = normalizeStrategy(strategy);
    var values = Array.isArray(initialValues) ? initialValues.slice() : [];
    var initialRoot = Tree.buildTree(values);
    var target = Tree.findNode(initialRoot, targetValue);
    if (!target) return null;

    var caseType = caseOfNode(target);
    var parentInfo = findParent(initialRoot, targetValue);
    var initialInorder = Tree.inorder(initialRoot);
    var parentValue = parentInfo.parent ? parentInfo.parent.value : null;

    var plan = {
      case: caseType,
      targetValue: targetValue,
      strategy: strategy,
      childCount: countChildren(target),
      initialInorder: initialInorder,
      initialRoot: cloneTree(initialRoot),
      successor: Tree.successorValue(initialRoot, targetValue),
      predecessor: Tree.predecessorValue(initialRoot, targetValue),
      parentValue: parentValue,
      parentSide: parentInfo.side,
      steps: [],
      choose: null,
      wrongDemos: {},
      finalRoot: null,
      finalInorder: null,
    };

    function snapshotOf(root, opts) {
      opts = opts || {};
      var ino = Tree.inorder(root);
      return {
        root: root,
        targetValue: targetValue,
        targetId: opts.targetId || null,
        key: null,
        case: caseType,
        inorder: ino,
        orderOk: isSorted(ino),
        intervalOk: isBST(root),
        marks: {
          path: opts.path || [],
          walk: opts.walk || [],
          succ: opts.succ || null,
          pred: opts.pred || null,
          candidates: opts.candidates || null,
          parent: opts.parent || null,
          child: opts.child || null,
          detachedParent: opts.detachedParent || null,
          newLinks: opts.newLinks || [],
          attach: opts.attach || null,
        },
        ghost: opts.ghost || null,
        arrows: opts.arrows || [],
        verified: !!opts.verified,
        showIntervals: !!opts.showIntervals,
      };
    }

    function push(key, vars, snapshot) {
      snapshot.key = key;
      snapshot.index = plan.steps.length;
      snapshot.case = caseType;
      plan.steps.push({ key: key, index: plan.steps.length, vars: vars || {}, snapshot: snapshot });
    }

    /* ---------- 第 1 步：三种情形共用 ---------- */
    push(
      "pick",
      { target: targetValue, parent: parentValue, side: parentInfo.side, childCount: countChildren(target) },
      snapshotOf(cloneTree(initialRoot), { targetId: target.id, path: pathIds(initialRoot, targetValue) })
    );

    /* ---------- 叶子：pick → detachLeaf → verify ---------- */
    if (caseType === "leaf") {
      var leafFinal = removeByStrategy(initialRoot, targetValue, strategy);
      var leafIno = Tree.inorder(leafFinal);
      var leafParentId = parentInfo.parent ? parentInfo.parent.id : null;
      push(
        "detachLeaf",
        {
          target: targetValue,
          parent: parentValue,
          side: parentInfo.side,
          isRoot: !parentInfo.parent,
        },
        snapshotOf(cloneTree(leafFinal), {
          parent: leafParentId,
          ghost: ghostAt(initialRoot, targetValue, "removed"),
          attach: leafParentId ? { parentId: leafParentId, side: parentInfo.side } : null,
          arrows: leafParentId ? [{ kind: "cut", fromId: leafParentId, toGhost: true, labelKey: "arrowCut" }] : [],
        })
      );
      push(
        "verify",
        { target: targetValue, inorder: leafIno.join(" · "), count: leafIno.length, removed: targetValue },
        snapshotOf(cloneTree(leafFinal), { verified: true, showIntervals: true })
      );
      plan.finalRoot = cloneTree(leafFinal);
      plan.finalInorder = leafIno;
      return plan;
    }

    /* ---------- 单孩子：pick → attachOnlyChild → verify ---------- */
    if (caseType === "single") {
      var onlyChild = target.left || target.right;
      var childSide = target.left ? "left" : "right";
      var singleFinal = removeByStrategy(initialRoot, targetValue, strategy);
      var singleIno = Tree.inorder(singleFinal);
      var singleParentId = parentInfo.parent ? parentInfo.parent.id : null;
      push(
        "attachOnlyChild",
        {
          target: targetValue,
          child: onlyChild.value,
          childDir: childSide,
          parent: parentValue,
          side: parentInfo.side,
          isRoot: !parentInfo.parent,
        },
        snapshotOf(cloneTree(singleFinal), {
          child: onlyChild.id,
          parent: singleParentId,
          ghost: ghostAt(initialRoot, targetValue, "removed"),
          newLinks: singleParentId ? [{ fromId: singleParentId, toId: onlyChild.id }] : [],
          arrows: singleParentId ? [{ kind: "new", fromId: singleParentId, toId: onlyChild.id, labelKey: "arrowNew" }] : [],
        })
      );
      push(
        "verify",
        { target: targetValue, inorder: singleIno.join(" · "), count: singleIno.length, removed: targetValue },
        snapshotOf(cloneTree(singleFinal), { verified: true, showIntervals: true })
      );
      plan.finalRoot = cloneTree(singleFinal);
      plan.finalInorder = singleIno;
      return plan;
    }

    /* ---------- 双孩子：8 步 ---------- */
    var repl = searchReplacement(initialRoot, target, strategy);
    var succValue = plan.successor;
    var predValue = plan.predecessor;
    var childForC = strategy === "successor" ? target.right : target.left;
    var freeDir = strategy === "successor" ? "left" : "right";
    var enterKey = strategy === "successor" ? "enterRight" : "enterLeft";
    var walkKey = strategy === "successor" ? "walkLeft" : "walkRight";
    var walkIds = repl.walk.map(function (n) {
      return n.id;
    });
    var walkValues = repl.walk.map(function (n) {
      return n.value;
    });
    var walkArrows = [];
    for (var wi = 1; wi < repl.walk.length; wi += 1) {
      walkArrows.push({
        kind: "walk",
        fromId: repl.walk[wi - 1].id,
        toId: repl.walk[wi].id,
        labelKey: wi === 1 ? "arrowWalk" : null,
      });
    }

    /* 第 2 步：进入右/左子树 */
    push(
      enterKey,
      { target: targetValue, start: repl.start.value },
      snapshotOf(cloneTree(initialRoot), {
        targetId: target.id,
        walk: [repl.start.id],
        arrows: [{ kind: "walk", fromId: target.id, toId: repl.start.id, labelKey: "arrowWalk" }],
      })
    );

    /* 第 3 步：一路向左/右走到底 */
    push(
      walkKey,
      { start: repl.start.value, succ: repl.value, walkPath: walkValues.join(" → ") },
      snapshotOf(cloneTree(initialRoot), {
        targetId: target.id,
        walk: walkIds,
        arrows: copyArrows(walkArrows),
      })
    );

    /* 第 4 步：找到替换节点 */
    push(
      "found",
      {
        target: targetValue,
        succ: repl.value,
        succParent: repl.parent.value,
        succFreeDir: freeDir,
        succChild: repl.child ? repl.child.value : null,
      },
      snapshotOf(cloneTree(initialRoot), {
        targetId: target.id,
        walk: walkIds,
        succ: repl.node.id,
        arrows: copyArrows(walkArrows),
      })
    );

    /* 第 5 步：A/B/C 判定 */
    var succNode = Tree.findNode(initialRoot, succValue);
    var predNode = Tree.findNode(initialRoot, predValue);
    var answerKey = strategy === "successor" ? "A" : "B";
    var wrongKey = strategy === "successor" ? "B" : "A";
    plan.choose = {
      answer: answerKey,
      wrongKey: wrongKey,
      options: [
        { key: "A", role: "successor", value: succValue },
        { key: "B", role: "predecessor", value: predValue },
        { key: "C", role: "child", value: childForC.value },
      ],
    };
    push(
      "choose",
      {
        target: targetValue,
        succ: succValue,
        pred: predValue,
        child: childForC.value,
        childDir: strategy === "successor" ? "right" : "left",
      },
      snapshotOf(cloneTree(initialRoot), {
        targetId: target.id,
        candidates: { A: succNode.id, B: predNode.id, C: childForC.id },
      })
    );

    /* 错误选项的演示数据（纯数据，渲染在 mount 里做） */
    plan.wrongDemos[wrongKey] = alternativeDemoFor(initialRoot, targetValue, strategy);
    plan.wrongDemos.C = brokenDemoFor(initialRoot, targetValue, strategy);

    /* 第 6 步：把替换节点从原位置摘下来 */
    var detachRoot = cloneTree(initialRoot);
    var detachTarget = Tree.findNode(detachRoot, targetValue);
    var detachRepl = Tree.findNode(detachRoot, repl.value);
    var detachParentInfo = findParent(detachRoot, repl.value);
    var detachParent = detachParentInfo.parent;
    var movedChild = null;
    if (strategy === "successor") {
      movedChild = detachRepl.right;
      if (detachParent === detachTarget) detachTarget.right = detachRepl.right;
      else detachParent.left = detachRepl.right;
    } else {
      movedChild = detachRepl.left;
      if (detachParent === detachTarget) detachTarget.left = detachRepl.left;
      else detachParent.right = detachRepl.left;
    }
    var detachArrows = [];
    if (movedChild) {
      detachArrows.push({ kind: "detach", fromId: detachParent.id, toId: movedChild.id, labelKey: "arrowDetach" });
    } else {
      detachArrows.push({ kind: "cut", fromId: detachParent.id, toGhost: true, labelKey: "arrowCut" });
    }
    detachArrows.push({ kind: "attach", fromGhost: true, toId: detachTarget.id, labelKey: "arrowAttach" });
    push(
      "detach",
      {
        succ: repl.value,
        succParent: detachParent.value,
        succFreeDir: freeDir,
        succChild: movedChild ? movedChild.value : null,
        // 摘节点这一步涉及两个方向：父节点被改的是哪一侧指针，
        // 以及被搬走的是替换节点哪一侧的孩子。后继：父指针 left、孩子 right。
        parentSide: freeDir,
        movedDir: strategy === "successor" ? "right" : "left",
      },
      snapshotOf(detachRoot, {
        targetId: detachTarget.id,
        detachedParent: detachParent.id,
        newLinks: movedChild ? [{ fromId: detachParent.id, toId: movedChild.id }] : [],
        attach: {
          parentId: detachParent.id,
          side: strategy === "successor" ? "left" : "right",
          childId: movedChild ? movedChild.id : null,
        },
        ghost: ghostAt(initialRoot, repl.value, "detached"),
        arrows: detachArrows,
      })
    );

    /* 第 7 步：替换节点顶到被删位置 */
    var attachRoot = cloneTree(initialRoot);
    var attachTarget = Tree.findNode(attachRoot, targetValue);
    var attachRepl = Tree.findNode(attachRoot, repl.value);
    var attachParentInfo = findParent(attachRoot, repl.value);
    var attachParent = attachParentInfo.parent;
    if (strategy === "successor") {
      if (attachParent === attachTarget) attachTarget.right = attachRepl.right;
      else attachParent.left = attachRepl.right;
    } else {
      if (attachParent === attachTarget) attachTarget.left = attachRepl.left;
      else attachParent.right = attachRepl.left;
    }
    attachRepl.left = attachTarget.left;
    attachRepl.right = attachTarget.right;
    var attachToInfo = findParent(attachRoot, targetValue);
    var attachToParentId = attachToInfo.parent ? attachToInfo.parent.id : null;
    if (!attachToInfo.parent) {
      attachRoot = attachRepl;
    } else if (attachToInfo.side === "left") {
      attachToInfo.parent.left = attachRepl;
    } else {
      attachToInfo.parent.right = attachRepl;
    }
    var attachLinks = [];
    if (attachRepl.left) attachLinks.push({ fromId: attachRepl.id, toId: attachRepl.left.id });
    if (attachRepl.right) attachLinks.push({ fromId: attachRepl.id, toId: attachRepl.right.id });
    if (attachToParentId) attachLinks.push({ fromId: attachToParentId, toId: attachRepl.id });
    var attachArrows = [];
    if (attachRepl.left) {
      attachArrows.push({ kind: "new", fromId: attachRepl.id, toId: attachRepl.left.id, labelKey: "arrowNew" });
    }
    if (attachRepl.right) {
      attachArrows.push({ kind: "new", fromId: attachRepl.id, toId: attachRepl.right.id, labelKey: "arrowNew" });
    }
    if (attachToParentId) {
      attachArrows.push({ kind: "new", fromId: attachToParentId, toId: attachRepl.id, labelKey: "arrowNew" });
    }
    push(
      "attach",
      {
        target: targetValue,
        succ: repl.value,
        left: attachRepl.left ? attachRepl.left.value : null,
        right: attachRepl.right ? attachRepl.right.value : null,
        parent: attachToInfo.parent ? attachToInfo.parent.value : null,
        isRoot: !attachToParentId,
      },
      snapshotOf(attachRoot, {
        succ: attachRepl.id,
        targetId: null,
        newLinks: attachLinks,
        arrows: attachArrows,
      })
    );

    /* 第 8 步：校验 */
    var finalIno = Tree.inorder(attachRoot);
    push(
      "verify",
      { target: targetValue, inorder: finalIno.join(" · "), count: finalIno.length, removed: targetValue },
      snapshotOf(cloneTree(attachRoot), { succ: attachRepl.id, verified: true, showIntervals: true })
    );
    plan.finalRoot = cloneTree(attachRoot);
    plan.finalInorder = finalIno;
    return plan;
  }

  /* ============================================================
   * 第二部分：页面交互（只有浏览器调用 mount 时才用到 DOM / App）
   * ============================================================ */

  /**
   * 把「某一步的原始数据」和 JSON 里的标签合成文案模板可用的变量表。
   * 纯函数：Node 单测可以拿它逐个检查 JSON 模板里的 {占位符} 是否都有值。
   */
  function textVars(data, plan, step) {
    var raw = (step && step.vars) || {};
    var vars = {};
    Object.keys(raw).forEach(function (k) {
      vars[k] = raw[k];
    });
    var caseMeta = (data.cases && data.cases[plan.case]) || { label: plan.case, hint: "" };
    vars.caseLabel = caseMeta.label;
    vars.childrenDesc = caseMeta.hint;
    vars.inorder = step.snapshot.inorder.join(" · ");
    vars.count = step.snapshot.inorder.length;
    vars.removed = plan.targetValue;
    vars.sideLabel = raw.side ? data.labels[raw.side] || raw.side : data.labels.none;
    if (raw.childDir) vars.childDirLabel = data.labels[raw.childDir] || raw.childDir;
    if (raw.succFreeDir) vars.succFreeDirLabel = data.labels[raw.succFreeDir] || raw.succFreeDir;
    if (raw.parentSide) vars.succParentSideLabel = data.labels[raw.parentSide] || raw.parentSide;
    if (raw.movedDir) vars.movedDirLabel = data.labels[raw.movedDir] || raw.movedDir;
    vars.isRoot = !!raw.isRoot;
    vars.parentText = raw.parent == null ? data.labels.rootNode : raw.parent;
    vars.succParentText = raw.succParent == null ? data.labels.rootNode : raw.succParent;
    vars.succChildText = raw.succChild == null ? data.labels.none : raw.succChild;
    vars.leftText = raw.left == null ? data.labels.none : raw.left;
    vars.rightText = raw.right == null ? data.labels.none : raw.right;
    /* attach 步骤末尾的 {rootText}：目标是根时补一句「成为新根」，否则为空 */
    vars.rootText = raw.isRoot ? data.labels.attachRootText || "" : "";
    vars.replWord = plan.strategy === "predecessor" ? data.labels.replWordPred : data.labels.replWordSucc;
    return vars;
  }

  var ARROW_MARKER = {
    walk: "accent",
    detach: "danger",
    cut: "danger",
    attach: "green",
    new: "green",
    candidate: "purple",
  };

  function mount() {
    var App = global.App;
    if (!App) throw new Error("common.js 必须先于 d2.js 加载");
    var doc = global.document;
    var svgEl = doc.getElementById("canvas");
    var stepBox = doc.getElementById("panel-step");
    var stepTitle = doc.getElementById("step-title");
    var statusEl = doc.getElementById("status");
    var paramsBox = doc.getElementById("params");
    var stepsBox = doc.getElementById("panel-steps");
    var chooseBox = doc.getElementById("panel-choose");
    var chooseHeading = doc.getElementById("choose-heading");
    var choosePrompt = doc.getElementById("choose-prompt");
    var chooseOptions = doc.getElementById("choose-options");
    var feedbackEl = doc.getElementById("panel-feedback");
    var chooseHint = doc.getElementById("choose-hint");
    var checkBox = doc.getElementById("panel-check");

    var state = {
      data: null,
      plan: null,
      case: "double",
      strategy: "successor",
      speed: 2,
      targetValue: null,
      answered: false,
      wrong: null,
      lastIndex: -1,
      resumeAfterChoose: false,
      answerToken: 0,
    };

    var playback = new App.Playback({
      onRender: function (step, index) {
        renderStep(step, index);
      },
      onState: function (i, total, playing) {
        updateStatus(i, total, playing);
      },
    });

    /* ---------- 启动：载入数据、搭控件、生成第一版计划 ---------- */
    App.loadJSON("../data/d2.json")
      .then(function (data) {
        state.data = data;
        setText("page-title", data.title);
        setText("page-subtitle", data.subtitle);
        setText("page-howto", data.howToUse);
        setText("page-status", data.status);
        buildParams();
        bindButtons();
        var defaults = paramDefaults();
        state.case = defaults.case || "double";
        state.strategy = defaults.strategy || "successor";
        state.speed = defaults.speed || 2;
        playback.setSpeed(state.speed);
        rebuild(null);
        if (App.progress) App.progress.visit("d2");
      })
      .catch(function (err) {
        App.showError(stepBox, err);
      });

    /* ---------- 小工具 ---------- */
    function setText(id, text) {
      var node = doc.getElementById(id);
      if (node) node.textContent = text;
    }

    function paramDefaults() {
      var out = {};
      state.data.params.forEach(function (p) {
        out[p.key] = p.default;
      });
      return out;
    }

    function syncSelect(key, value) {
      var el = doc.getElementById("param-" + key);
      if (el && el.value !== String(value)) el.value = String(value);
    }

    /* ---------- 参数控件（全部由 JSON 描述） ---------- */
    function buildParams() {
      App.clear(paramsBox);
      state.data.params.forEach(function (p) {
        var row = App.el("div", { class: "param" });
        var label = App.el("label", { text: p.label });
        label.setAttribute("for", "param-" + p.key);
        row.appendChild(label);

        var input;
        if (p.type === "select") {
          input = App.el("select", { id: "param-" + p.key });
          (p.options || []).forEach(function (opt) {
            input.appendChild(App.el("option", { value: opt.value, text: opt.label }));
          });
          input.value = p.default;
          input.addEventListener("change", function () {
            onParamChange(p.key, input.value);
          });
          row.appendChild(input);
        } else {
          input = App.el("input", {
            type: "range",
            id: "param-" + p.key,
            min: p.min,
            max: p.max,
            step: p.step,
            value: p.default,
          });
          var readout = App.el("span", { class: "readout", text: String(p.default) });
          input.addEventListener("input", function () {
            readout.textContent = input.value;
            onParamChange(p.key, Number(input.value));
          });
          row.appendChild(input);
          row.appendChild(readout);
        }
        if (p.hint) row.appendChild(App.el("p", { class: "hint", text: p.hint }));
        paramsBox.appendChild(row);
      });
    }

    function onParamChange(key, value) {
      if (key === "case") {
        state.case = value;
        rebuild(state.data.cases[value] ? state.data.cases[value].target : null);
      } else if (key === "strategy") {
        state.strategy = value;
        rebuild(null);
      } else if (key === "speed") {
        state.speed = Number(value);
        playback.setSpeed(state.speed);
      }
    }

    function bindButtons() {
      doc.getElementById("btn-play").addEventListener("click", function () {
        if (!canAdvance()) return;
        state.resumeAfterChoose = false;
        playback.play();
      });
      doc.getElementById("btn-pause").addEventListener("click", function () {
        playback.pause();
      });
      doc.getElementById("btn-prev").addEventListener("click", function () {
        playback.pause();
        playback.prev();
      });
      doc.getElementById("btn-next").addEventListener("click", function () {
        playback.pause();
        if (!canAdvance()) return;
        playback.next();
      });
      doc.getElementById("btn-reset").addEventListener("click", function () {
        resetToStart();
      });
    }

    function resetToStart() {
      state.answered = false;
      state.wrong = null;
      state.lastIndex = -1;
      state.resumeAfterChoose = false;
      state.answerToken += 1;
      hideFeedback();
      if (state.plan) {
        var fresh = planDeletion(state.data.tree.initial, state.targetValue, state.strategy);
        if (fresh) state.plan = fresh;
      }
      // 重建步骤列表并重新登记同一份步骤：否则 playback.steps 还指着旧数组
      buildStepList();
      playback.setSteps(state.plan ? state.plan.steps : []);
    }

    /* ---------- 重新生成计划（目标 / 情形 / 策略变化时） ---------- */
    function rebuild(targetValue) {
      var data = state.data;
      var values = data.tree.initial;
      var wanted = targetValue;
      if (wanted == null) {
        wanted = state.targetValue != null ? state.targetValue : data.cases[state.case].target;
      }
      var plan = planDeletion(values, wanted, state.strategy);
      if (!plan) {
        var fallback = data.cases[state.case] ? data.cases[state.case].target : values[0];
        plan = planDeletion(values, fallback, state.strategy);
      }
      if (!plan) {
        App.showError(stepBox, new Error("无法为目标 " + wanted + " 生成删除步骤"));
        return;
      }
      state.plan = plan;
      state.case = plan.case;
      state.strategy = plan.strategy;
      state.targetValue = plan.targetValue;
      state.answered = false;
      state.wrong = null;
      state.lastIndex = -1;
      state.resumeAfterChoose = false;
      state.answerToken += 1;
      hideFeedback();
      syncSelect("case", plan.case);
      syncSelect("strategy", plan.strategy);
      buildStepList();
      playback.setSteps(plan.steps);
    }

    /* ---------- 步骤列表 ---------- */
    function buildStepList() {
      App.clear(stepsBox);
      state.plan.steps.forEach(function (step, i) {
        var tpl = state.data.steps[step.key] || { title: step.key };
        var title = App.format(tpl.title || step.key, varsFor(step));
        var text = App.format(state.data.labels.stepTitle, { index: i + 1, title: title });
        var li = App.el("li", { text: text, class: "step-item" });
        li.addEventListener("click", function () {
          jumpTo(i);
        });
        stepsBox.appendChild(li);
      });
    }

    function updateStepList(index) {
      if (!stepsBox) return;
      var items = stepsBox.querySelectorAll("li");
      Array.prototype.forEach.call(items, function (li, i) {
        li.className = "step-item" + (i === index ? " now" : i < index ? " done" : "");
      });
    }

    function jumpTo(i) {
      playback.pause();
      if (!canAdvance(i)) {
        // 步骤列表在 choose 之前通常看不到「等待选择」提示，这里直接写到状态栏，
        // 避免用户点了第 7/8 步却像什么都没发生。
        if (statusEl && state.data && state.plan) {
          statusEl.textContent =
            App.format(state.data.statusTemplates.step, {
              i: playback.index + 1,
              total: state.plan.steps.length,
            }) + state.data.statusTemplates.waiting;
        }
        return;
      }
      playback.goto(i);
    }

    /* ---------- 文案变量：JSON 模板 + 本步数据 ---------- */
    function varsFor(step) {
      return textVars(state.data, state.plan, step);
    }

    /* ---------- 每一步的渲染入口 ---------- */
    function renderStep(step, index) {
      if (!step || !state.data || !state.plan) return;
      if (index !== state.lastIndex) {
        state.lastIndex = index;
        state.answered = false;
        state.wrong = null;
        state.answerToken += 1; // 离开第 5 步就作废还没执行的「选对后前进」定时器
        hideFeedback();
      }
      var vars = varsFor(step);
      var tpl = state.data.steps[step.key] || { title: step.key, text: "" };
      if (stepTitle) {
        stepTitle.textContent = App.format(state.data.labels.stepTitle, {
          index: index + 1,
          title: App.format(tpl.title || step.key, vars),
        });
      }
      if (stepBox) {
        // 叶子删根这种边界情况没有父节点，用 JSON 里单独的兜底文案
        var tplText = step.vars && step.vars.isRoot && tpl.rootText ? tpl.rootText : tpl.text || "";
        stepBox.textContent = App.format(tplText, vars);
      }
      renderChoose(step, index, vars);
      renderCanvas(step, vars);
      renderCheck(step);
      updateStepList(index);

      if (step.key === "choose" && playback.playing()) {
        state.resumeAfterChoose = true;
        playback.pause();
      }
    }

    /* ---------- 状态栏 ---------- */
    function updateStatus(i, total, playing) {
      if (!statusEl) return;
      if (!state.data || !state.plan) {
        statusEl.textContent = "";
        return;
      }
      var tpl = state.data.statusTemplates;
      var text = total > 0 ? App.format(tpl.step, { i: i + 1, total: total }) : tpl.empty;
      if (playing) text += tpl.playing;
      var cur = playback.current();
      if (cur && cur.key === "choose" && !state.answered) text += tpl.waiting;
      statusEl.textContent = text;
      updateStepList(i);
    }

    /* ---------- 播放闸门：不能越过还没作答的 choose 步 ---------- */
    function chooseStepIndex() {
      if (!state.plan) return -1;
      for (var i = 0; i < state.plan.steps.length; i += 1) {
        if (state.plan.steps[i].key === "choose") return i;
      }
      return -1;
    }

    function canAdvance(targetIndex) {
      var ci = chooseStepIndex();
      if (ci === -1) return true;
      var cur = playback.index;
      // 当前步已经越过了 choose（作答后正常前进），不重复拦截；
      // 若从后面跳回 choose 之前，则重新作答后才能再越过。
      if (state.answered || cur > ci) return true;
      // targetIndex 为空 = 前进一步（播放 / 下一步）；否则是跳步目标
      var target = targetIndex == null ? cur + 1 : targetIndex;
      if (target > ci) {
        showHint(state.data.labels.stepWait);
        return false;
      }
      return true;
    }

    function showHint(text) {
      if (chooseHint && text) chooseHint.textContent = text;
    }

    function hideFeedback() {
      if (!feedbackEl) return;
      feedbackEl.hidden = true;
      feedbackEl.textContent = "";
      feedbackEl.className = "feedback";
    }

    function showFeedback(title, text, cls) {
      if (!feedbackEl) return;
      feedbackEl.hidden = false;
      feedbackEl.className = "feedback " + cls;
      feedbackEl.textContent = (title ? title + "：" : "") + text;
    }

    /* ---------- A/B/C 判定面板 ---------- */
    function renderChoose(step, index, vars) {
      if (!chooseBox) return;
      if (step.key !== "choose") {
        chooseBox.hidden = true;
        return;
      }
      var data = state.data;
      chooseBox.hidden = false;
      if (chooseHeading) chooseHeading.textContent = data.choose.heading;
      if (choosePrompt) choosePrompt.textContent = App.format(data.choose.prompt, vars);
      App.clear(chooseOptions);
      // plan 里只存选项的 key/角色/值，展示文案在 JSON 里，按 key 对上号
      var optionSpecs = {};
      (data.choose.options || []).forEach(function (o) {
        optionSpecs[o.key] = o;
      });
      (state.plan.choose.options || []).forEach(function (opt) {
        var spec = optionSpecs[opt.key] || {};
        var btn = App.el("button", {
          type: "button",
          class: "choose-btn choose-" + opt.key.toLowerCase(),
          text: App.format(spec.text || opt.key, vars),
        });
        if (state.answered && opt.key === state.plan.choose.answer) btn.className += " is-correct";
        if (state.wrong && state.wrong.option === opt.key) btn.className += " is-wrong";
        btn.addEventListener("click", function () {
          answerOption(opt);
        });
        chooseOptions.appendChild(btn);
      });
      if (chooseHint) {
        chooseHint.textContent = state.answered ? "" : data.choose.retry || "";
      }
    }

    function focusFirstOption() {
      if (!chooseOptions) return;
      var first = chooseOptions.querySelector("button");
      if (first && typeof first.focus === "function") first.focus();
    }

    function answerOption(opt) {
      var step = playback.current();
      if (!step || step.key !== "choose" || !state.plan || state.answered) return;
      var data = state.data;
      var plan = state.plan;
      var vars = varsFor(step);

      if (opt.key === plan.choose.answer) {
        state.answered = true;
        state.wrong = null;
        state.answerToken += 1;
        var token = state.answerToken;
        var correct = data.choose.correct[plan.strategy] || data.choose.correct.successor;
        showFeedback(correct.title, App.format(correct.text, vars), "ok");
        renderChoose(step, playback.index, vars);
        focusFirstOption();
        renderCanvas(step, vars);
        renderCheck(step);
        updateStatus(playback.index, state.plan.steps.length, playback.playing());
        var resume = state.resumeAfterChoose;
        state.resumeAfterChoose = false;
        setTimeout(function () {
          if (token !== state.answerToken) return;
          var cur = playback.current();
          if (!cur || cur.key !== "choose") return;
          playback.pause();
          playback.next();
          if (resume) playback.play();
        }, 420);
        return;
      }

      var cons = data.choose.consequences[plan.strategy][opt.key];
      if (!cons) return;
      var demo = plan.wrongDemos[opt.key] || null;
      state.answered = false;
      state.wrong = { option: opt.key, consequence: cons, demo: demo };
      var demoVars = {};
      Object.keys(vars).forEach(function (k) {
        demoVars[k] = vars[k];
      });
      if (demo && demo.lostValues) demoVars.lostText = demo.lostValues.join("、");
      var cls = demo && demo.kind === "broken" ? "bad" : "warn";
      showFeedback(cons.title, App.format(cons.text, demoVars), cls);
      renderChoose(step, playback.index, vars);
      focusFirstOption();
      renderCanvas(step, vars);
      renderCheck(step);
    }

    /* ---------- 校验面板 ---------- */
    function addCheckLine(text, cls) {
      if (!checkBox) return;
      checkBox.appendChild(App.el("p", { class: "check-line" + (cls ? " " + cls : ""), text: text }));
    }

    function renderCheck(step) {
      if (!checkBox) return;
      App.clear(checkBox);
      var labels = state.data.labels;
      var demo = state.wrong && state.wrong.demo;
      if (demo && demo.kind === "broken") {
        addCheckLine(labels.inorderReachable + "：" + demo.reachableInorder.join(" · "), "bad");
        addCheckLine(labels.inorderExpected + "：" + demo.expectedInorder.join(" · "));
        addCheckLine(labels.lost + "：" + demo.lostValues.join("、"), "bad");
        addCheckLine(labels.brokenFlag, "bad");
        return;
      }
      if (demo && demo.kind === "wrong-strategy") {
        addCheckLine(labels.alternativeInorder + "：" + demo.alternativeInorder.join(" · "), "warn");
        addCheckLine(labels.strategyMismatch, "warn");
        return;
      }
      var sn = step.snapshot;
      addCheckLine(labels.inorder + "：" + sn.inorder.join(" · "));
      addCheckLine(sn.orderOk ? labels.orderOk : labels.orderBad, sn.orderOk ? "ok" : "bad");
      addCheckLine(sn.intervalOk ? labels.intervalOk : labels.intervalBad, sn.intervalOk ? "ok" : "bad");
    }

    /* ---------- 画布 ---------- */
    function renderCanvas(step, vars) {
      if (!svgEl) return;
      App.clear(svgEl);
      var useWrong = state.wrong && step.key === "choose" && state.wrong.demo;
      if (useWrong && state.wrong.demo.kind === "broken") {
        drawBrokenDemo(state.wrong.demo);
        return;
      }
      if (useWrong) {
        drawTree(step.snapshot, vars, { mismatchOption: state.wrong.option, noClick: true });
        return;
      }
      drawTree(step.snapshot, vars, {});
    }

    function ensureDefs() {
      var defs = App.svg("defs", {});
      [
        ["accent", "#1f3a5f"],
        ["danger", "#b3261e"],
        ["green", "#2f7d4f"],
        ["purple", "#6a4fa3"],
      ].forEach(function (pair) {
        var marker = App.svg("marker", {
          id: "d2-arrow-" + pair[0],
          viewBox: "0 0 8 8",
          refX: "7",
          refY: "4",
          markerWidth: "7",
          markerHeight: "7",
          orient: "auto",
          markerUnits: "strokeWidth",
        });
        marker.appendChild(App.svg("path", { d: "M0,0 L8,4 L0,8 z", class: "d2-marker-" + pair[0] }));
        defs.appendChild(marker);
      });
      svgEl.appendChild(defs);
    }

    function nodeMap(lay) {
      var map = {};
      lay.nodes.forEach(function (n) {
        map[n.id] = n;
      });
      return map;
    }

    function setViewBox(width, height) {
      svgEl.setAttribute("viewBox", "0 0 " + Math.max(240, Math.round(width)) + " " + Math.max(150, Math.round(height)));
    }

    /**
     * 幽灵节点的坐标来自「动手之前」的布局，摘掉节点后树会重新排版，
     * 因此可能和新位置上顶替上来的节点完全重合。重合时固定左移一点，
     * 并且先画幽灵再画树，让树节点压在上面，避免「60 盖住 65」。
     */
    function placeGhost(ghost, lay) {
      if (!ghost) return null;
      var hit = lay.nodes.some(function (n) {
        var dx = lay.x(n) - ghost.x;
        var dy = lay.y(n) - ghost.y;
        return Math.sqrt(dx * dx + dy * dy) < Tree.GEO.nodeR * 2;
      });
      return {
        value: ghost.value,
        kind: ghost.kind,
        x: ghost.x + (hit ? -26 : 0),
        y: ghost.y,
      };
    }

    function drawTree(snapshot, vars, opts) {
      opts = opts || {};
      ensureDefs();
      if (!snapshot || !snapshot.root) {
        setViewBox(240, 150);
        return;
      }
      var lay = Tree.layout(snapshot.root);
      var byId = nodeMap(lay);
      var iv = Tree.intervals(snapshot.root);
      var ghost = placeGhost(snapshot.ghost, lay);
      var width = lay.width + 40;
      var height = lay.height + 90;
      if (ghost) {
        width = Math.max(width, ghost.x + 80);
        height = Math.max(height, ghost.y + 90);
      }
      setViewBox(width, height);

      // 先画幽灵（在树节点后面），再画树，最后画箭头与标签
      if (ghost) drawGhost(ghost, vars);

      Tree.render(svgEl, lay, {
        showIntervals: snapshot.showIntervals,
        intervalsMap: iv,
        nodeClass: function (n) {
          return nodeClassFor(snapshot, n, opts);
        },
        edgeClass: function (e) {
          return edgeClassFor(snapshot, e);
        },
      });

      drawArrows(snapshot, lay, byId, vars, ghost);
      drawTags(snapshot, lay, byId, opts);

      if (!opts.noClick) bindNodeClicks(lay);
    }

    function nodeClassFor(snapshot, n, opts) {
      var cls = ["node-circle"];
      var m = snapshot.marks;
      if (snapshot.targetId && n.id === snapshot.targetId) cls.push("is-target", "target");
      if (snapshot.verified) cls.push("is-verified");
      if (m.path && m.path.indexOf(n.id) !== -1 && n.id !== snapshot.targetId) cls.push("on-path");
      if (m.walk && m.walk.indexOf(n.id) !== -1) cls.push("on-path");
      if (m.succ && n.id === m.succ) cls.push("is-succ");
      if (m.candidates) {
        Object.keys(m.candidates).forEach(function (k) {
          if (m.candidates[k] === n.id) {
            cls.push("is-candidate", "is-candidate-" + k.toLowerCase());
            if (opts.mismatchOption && opts.mismatchOption === k) cls.push("is-wrong-candidate");
          }
        });
      }
      if (m.child && n.id === m.child) cls.push("is-new");
      if (m.succ && n.id === m.succ && snapshot.key === "attach") cls.push("is-new");
      return cls.join(" ");
    }

    function edgeClassFor(snapshot, e) {
      var cls = ["edge"];
      var m = snapshot.marks;
      function consecutive(list) {
        for (var i = 0; i + 1 < (list || []).length; i += 1) {
          if (list[i] === e.from.id && list[i + 1] === e.to.id) return true;
        }
        return false;
      }
      if (consecutive(m.path) || consecutive(m.walk)) cls.push("on-path");
      (m.newLinks || []).forEach(function (l) {
        if (l.fromId === e.from.id && l.toId === e.to.id) cls.push("is-new-link");
      });
      return cls.join(" ");
    }

    function drawGhost(ghost, vars) {
      var group = App.svg("g", { class: "ghost" });
      group.appendChild(App.svg("circle", { cx: ghost.x, cy: ghost.y, r: Tree.GEO.nodeR, class: "ghost-circle" }));
      var value = App.svg("text", { x: ghost.x, y: ghost.y, class: "ghost-value" });
      value.textContent = ghost.value;
      group.appendChild(value);
      var label = App.svg("text", {
        x: ghost.x,
        y: ghost.y + Tree.GEO.nodeR + 14,
        class: "ghost-label",
      });
      label.textContent = App.format(
        ghost.kind === "detached" ? state.data.labels.ghostDetached : state.data.labels.ghostRemoved,
        { value: ghost.value }
      );
      group.appendChild(label);
      svgEl.appendChild(group);
    }

    function drawArrows(snapshot, lay, byId, vars, ghost) {
      if (!snapshot.arrows || !snapshot.arrows.length) return;
      var labels = state.data.labels;

      function coords(id) {
        var n = byId[id];
        return n ? { x: lay.x(n), y: lay.y(n) } : null;
      }
      function ghostCoords() {
        return ghost ? { x: ghost.x, y: ghost.y } : null;
      }
      function shorten(a, b) {
        var dx = b.x - a.x;
        var dy = b.y - a.y;
        var len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) return null;
        var ux = dx / len;
        var uy = dy / len;
        var pad = Tree.GEO.nodeR + 3;
        return { x1: a.x + ux * pad, y1: a.y + uy * pad, x2: b.x - ux * pad, y2: b.y - uy * pad };
      }

      snapshot.arrows.forEach(function (spec) {
        var a = spec.fromGhost ? ghostCoords() : coords(spec.fromId);
        var b = spec.toGhost ? ghostCoords() : coords(spec.toId);
        if (!a || !b) return;
        var line = shorten(a, b);
        if (!line) return;
        var kind = spec.kind || "walk";
        var marker = ARROW_MARKER[kind] || "accent";
        var el = App.svg("line", {
          x1: line.x1,
          y1: line.y1,
          x2: line.x2,
          y2: line.y2,
          class: "pointer-line " + kind,
          "marker-end": "url(#d2-arrow-" + marker + ")",
        });
        svgEl.appendChild(el);
        var labelKey = spec.labelKey;
        if (labelKey === "arrowWalk") {
          labelKey = state.plan.strategy === "predecessor" ? "arrowWalkPred" : "arrowWalkSucc";
        }
        if (labelKey && labels[labelKey]) {
          var mid = App.svg("text", {
            x: (line.x1 + line.x2) / 2,
            y: (line.y1 + line.y2) / 2 - 10,
            class: "pointer-label " + kind,
          });
          mid.textContent = App.format(labels[labelKey], vars || {});
          svgEl.appendChild(mid);
        }
      });
    }

    function drawTags(snapshot, lay, byId, opts) {
      var labels = state.data.labels;
      var m = snapshot.marks;
      function tag(text, node, cls) {
        if (!node) return;
        var el = App.svg("text", {
          x: lay.x(node),
          y: lay.y(node) - Tree.GEO.nodeR - 10,
          class: "node-tag " + cls,
        });
        el.textContent = text;
        svgEl.appendChild(el);
      }
      if (snapshot.targetId && byId[snapshot.targetId]) {
        tag(labels.target, byId[snapshot.targetId], "target-tag");
      }
      if (m.succ && byId[m.succ]) {
        var replLabel = state.plan.strategy === "predecessor" ? labels.replPred : labels.replSucc;
        tag(replLabel, byId[m.succ], "succ-tag");
      }
      if (m.candidates) {
        Object.keys(m.candidates).forEach(function (k) {
          var node = byId[m.candidates[k]];
          if (!node) return;
          tag(App.format(labels.candidateTag, { key: k }), node, "candidate-tag key-" + k.toLowerCase());
          if (opts && opts.mismatchOption === k) {
            tag(labels.wrongTag, node, "wrong-tag");
          }
        });
      }
    }

    function bindNodeClicks(lay) {
      var groups = svgEl.querySelectorAll("g.node");
      Array.prototype.forEach.call(groups, function (g, i) {
        var node = lay.nodes[i];
        if (!node) return;
        if (g.style) g.style.cursor = "pointer";
        g.setAttribute("role", "button");
        g.setAttribute("tabindex", "0");
        g.setAttribute(
          "aria-label",
          App.format(state.data.labels.nodeAria || "节点 {value}", { value: node.value })
        );
        g.addEventListener("click", function () {
          selectTarget(node.value);
        });
        g.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter" || ev.key === " " || ev.key === "Spacebar") {
            ev.preventDefault();
            selectTarget(node.value);
          }
        });
      });
    }

    function selectTarget(value) {
      if (!state.data) return;
      playback.pause();
      rebuild(value);
    }

    /* ---------- 错误选项 C：断链演示 ---------- */
    function drawBrokenDemo(demo) {
      ensureDefs();
      var lay = Tree.layout(demo.root);
      var orphanLay = demo.orphan ? Tree.layout(demo.orphan) : null;
      var offsetX = lay.width + 60;
      var width = lay.width + 40;
      var height = lay.height + 90;
      if (orphanLay) {
        width = offsetX + orphanLay.width + 40;
        height = Math.max(height, orphanLay.height + 90);
      }
      setViewBox(width, height);

      Tree.render(svgEl, lay, {
        nodeClass: function () {
          return "node-circle is-broken";
        },
        edgeClass: function () {
          return "edge is-broken";
        },
      });

      if (orphanLay && demo.orphanRootValue != null) {
        // 断链的起点：顶替上来的 C（找不到时退回整棵残树的根）
        var anchor = Tree.findNode(demo.root, demo.promotedValue) || demo.root;
        var ax = lay.x(anchor);
        var ay = lay.y(anchor);
        var brokenLine = App.svg("line", {
          x1: ax,
          y1: ay,
          x2: offsetX + orphanLay.x(demo.orphan),
          y2: orphanLay.y(demo.orphan),
          class: "pointer-line cut",
          "marker-end": "url(#d2-arrow-danger)",
        });
        svgEl.appendChild(brokenLine);

        var brokenLabel = App.svg("text", {
          x: (ax + offsetX + orphanLay.x(demo.orphan)) / 2,
          y: (ay + orphanLay.y(demo.orphan)) / 2 - 12,
          class: "pointer-label cut",
        });
        brokenLabel.textContent = state.data.labels.brokenLink;
        svgEl.appendChild(brokenLabel);

        var group = App.svg("g", { transform: "translate(" + offsetX + ",0)" });
        Tree.render(group, orphanLay, {
          nodeClass: function () {
            return "node-circle is-broken";
          },
          edgeClass: function () {
            return "edge is-broken";
          },
        });
        svgEl.appendChild(group);
      }
    }
  }

  /* ============================================================
   * 导出
   * ============================================================ */

  var api = {
    planDeletion: planDeletion,
    caseOf: caseOf,
    removeByStrategy: removeByStrategy,
    removePredecessorRoot: function (root, value) {
      return removePredecessorRoot(cloneTree(root), value);
    },
    isBST: isBST,
    isSorted: isSorted,
    textVars: textVars,
    mount: mount,
  };

  global.D2 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
