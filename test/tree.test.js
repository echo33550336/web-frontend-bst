/**
 * tree.test.js —— 三个难点共用的树的纯逻辑回归测试
 * 运行：node test/tree.test.js
 */
"use strict";

const T = require("../src/js/tree.js");

let pass = 0;
const fails = [];
function check(name, cond, extra) {
  if (cond) pass += 1;
  else fails.push(name + (extra ? "  ← " + extra : ""));
}
function eq(name, actual, expected) {
  check(name, JSON.stringify(actual) === JSON.stringify(expected), "得到 " + JSON.stringify(actual));
}

const root = T.buildTree([50, 30, 70, 20, 40, 60, 80, 65]);

/* 基本结构 */
eq("中序递增", T.inorder(root), [20, 30, 40, 50, 60, 65, 70, 80]);
eq("节点数", T.size(root), 8);
eq("树高（层数）", T.height(root), 4);
eq("查找 65 的比较次数", T.searchSteps(root, 65), 4);
eq("查找不存在的值返回 -1", T.searchSteps(root, 99), -1);

/* 区间与路径 */
const iv = T.intervals(root);
eq("65 的允许区间", T.intervalText(iv.n65.lo, iv.n65.hi), "(60, 70)");
eq("根区间", T.intervalText(iv.n50.lo, iv.n50.hi), "(−∞, +∞)");
eq("插入 66 的路径", T.pathFor(root, 66).hops.map((h) => h.node.value), [50, 70, 60, 65]);

/* 中序后继 / 前驱 */
eq("50 的中序后继", T.successorValue(root, 50), 60);
eq("50 的中序前驱", T.predecessorValue(root, 50), 40);
eq("最大值无后继", T.successorValue(root, 80), null);

/* 删除的三种情形 */
const leaf = T.removeNode(T.buildTree([50, 30, 70, 20]), 20);
check("删除叶子：removed", leaf.removed === true);
eq("删除叶子后中序", T.inorder(leaf.root), [30, 50, 70]);

const one = T.removeNode(T.buildTree([50, 30, 70, 20, 40, 60, 80, 65]), 60);
eq("删除单孩子节点后中序", T.inorder(one.root), [20, 30, 40, 50, 65, 70, 80]);

const two = T.removeNode(T.buildTree([50, 30, 70, 20, 40, 60, 80, 65]), 50);
eq("删除双孩子节点（后继替换）后中序", T.inorder(two.root), [20, 30, 40, 60, 65, 70, 80]);
eq("替换后根节点值", two.root.value, 60);
check("删除不存在的值不改树", T.removeNode(root, 99).removed === false);

/* 删除任意节点后仍满足 BST 有序性 */
[20, 30, 40, 50, 60, 65, 70, 80].forEach(function (v) {
  const r = T.removeNode(T.buildTree([50, 30, 70, 20, 40, 60, 80, 65]), v);
  const ord = T.inorder(r.root);
  check("删除 " + v + " 后中序递增", ord.every((x, i) => i === 0 || ord[i - 1] < x));
});

/* 布局 */
const lay = T.layout(T.buildTree([50, 30, 70, 20, 40, 60, 80]));
eq("布局节点数", lay.nodes.length, 7);
check("布局宽度为正", lay.width > 0);
check("深度 depthMax=2", lay.depthMax === 2);

console.log(pass + " 项通过" + (fails.length ? "，" + fails.length + " 项失败：" : "，全部通过"));
fails.forEach((f) => console.log("  ✗ " + f));
process.exit(fails.length ? 1 : 0);
