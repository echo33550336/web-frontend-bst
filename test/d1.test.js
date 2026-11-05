/**
 * d1.test.js —— 难点 1 纯函数的回归测试
 * 运行：node test/d1.test.js
 * 这些断言就是"树结构对不对"的证据，改了 d1.js 先跑一遍。
 */
"use strict";

const D1 = require("../src/js/d1.js");

let pass = 0;
const fails = [];

function check(name, cond, extra) {
  if (cond) {
    pass += 1;
  } else {
    fails.push(name + (extra ? "  ← " + extra : ""));
  }
}

function eq(name, actual, expected) {
  check(name, JSON.stringify(actual) === JSON.stringify(expected), "得到 " + JSON.stringify(actual));
}

/* 1. 建树 + 中序 */
const root = D1.buildTree([50, 30, 70, 20, 40, 60, 80]);
eq("中序序列递增", D1.inorder(root), [20, 30, 40, 50, 60, 70, 80]);

/* 2. 区间标注：60 的允许区间应当是 (50, 70) */
const iv = D1.intervals(root);
eq("节点 60 的区间", D1.intervalText(iv["n60"].lo, iv["n60"].hi), "(50, 70)");
eq("根节点区间", D1.intervalText(iv["n50"].lo, iv["n50"].hi), "(−∞, +∞)");

/* 3. 插入 65 的比较路径：50 → 70 → 60 */
const p = D1.pathFor(root, 65);
eq("比较路径", p.hops.map((h) => h.node.value), [50, 70, 60]);
eq("每一步的方向", p.hops.map((h) => h.dir), ["right", "left", "right"]);

/* 4. 候选位置逐层减半：8 → 4 → 2 → 1 */
const counts = [D1.countSlots(root, -Infinity, Infinity)];
p.hops.forEach((h) => counts.push(D1.countSlots(root, h.nextLo, h.nextHi)));
eq("候选位置", counts, [8, 4, 2, 1]);

/* 5. 落点区间 */
eq("最终落点区间", D1.intervalText(p.lo, p.hi), "(60, 70)");

/* 6. 插入后仍然有序、且值确实进来了 */
D1.insertNode(root, 65);
eq("插入后中序仍递增", D1.inorder(root), [20, 30, 40, 50, 60, 65, 70, 80]);
check("重复值不重复插入", D1.inorder(D1.insertNode(D1.buildTree([50, 30]), 30)).length === 2);

/* 7. 布局：7 个节点，宽度为正，深度不超过 3 */
const lay = D1.layout(D1.buildTree([50, 30, 70, 20, 40, 60, 80]));
eq("布局节点数", lay.nodes.length, 7);
check("布局宽度为正", lay.width > 0);
check("深度合理", lay.depthMax === 2, "depthMax=" + lay.depthMax);

/* 8. 退化：升序插入 1—7 应当得到一条链（高度 = 6，中序仍递增） */
const chain = D1.buildTree([1, 2, 3, 4, 5, 6, 7]);
eq("退化成链的高度", D1.layout(chain).depthMax, 6);
eq("退化链的中序", D1.inorder(chain), [1, 2, 3, 4, 5, 6, 7]);

console.log(pass + " 项通过" + (fails.length ? "，" + fails.length + " 项失败：" : "，全部通过"));
fails.forEach((f) => console.log("  ✗ " + f));
process.exit(fails.length ? 1 : 0);
