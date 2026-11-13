"use strict";

/*
 * tools/bench.js — 纯函数性能基准（Node 直接跑，不依赖浏览器）
 *
 * 用法：node tools/bench.js
 *
 * 目的：三个难点的页面都是「状态树 → 渲染」单向数据流，交互流畅度取决于
 * 纯计算是否远低于一帧（16.7ms）。这里只测计算部分，渲染耗时另见
 * docs/iteration-2.md 的浏览器实测与 Lighthouse。
 */

const Tree = require("../src/js/tree.js");
const D2 = require("../src/js/d2.js");
const D3 = require("../src/js/d3.js");

function now() {
  return Number(process.hrtime.bigint()) / 1e6;
}

function bench(label, reps, fn) {
  for (let i = 0; i < Math.min(reps, 20); i++) fn(i); // 预热
  const start = now();
  for (let i = 0; i < reps; i++) fn(i);
  const each = (now() - start) / reps;
  return { label: label, reps: reps, each: each, total: each * reps };
}

function lcg(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const rand = lcg(20261113);
const VALUES_300 = [];
for (let i = 0; i < 300; i++) VALUES_300.push(1 + Math.floor(rand() * 999));
VALUES_300.sort(function (a, b) { return a - b; });
const shuffled = VALUES_300.slice();
for (let i = shuffled.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  const t = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = t;
}

const TREE_300 = Tree.buildTree(shuffled);
const LOOKUPS = [];
for (let i = 0; i < 2000; i++) LOOKUPS.push(1 + Math.floor(rand() * 999));

const D2_TREE = [50, 30, 70, 20, 40, 60, 80, 65];
const CASE_20 = D3.makeCase(20261105, 20, 0);
const CASE_60 = D3.makeCase(20261105, 60, 0);

const rows = [
  bench("buildTree(300 个乱序值)", 200, function () { Tree.buildTree(shuffled); }),
  bench("insertNode(300 个乱序值，逐次插入)", 100, function () {
    let root = null;
    for (let i = 0; i < shuffled.length; i++) root = Tree.insertNode(root, shuffled[i]);
    return root;
  }),
  bench("layout(300 节点树)", 200, function () { Tree.layout(TREE_300); }),
  bench("pathFor + countSlots(2000 次查找)", 100, function () {
    for (let i = 0; i < LOOKUPS.length; i++) {
      Tree.pathFor(TREE_300, LOOKUPS[i]);
      Tree.countSlots(TREE_300, LOOKUPS[i] - 1, LOOKUPS[i] + 1);
    }
  }),
  bench("d2 planDeletion(双孩子 50)", 500, function () {
    D2.planDeletion(D2_TREE, 50, "successor");
  }),
  bench("d2 planDeletion(叶子 20)", 500, function () {
    D2.planDeletion(D2_TREE, 20, "successor");
  }),
  bench("d3 makeCase(n=20, 随机序)", 200, function () {
    D3.makeCase(20261105, 20, 0);
  }),
  bench("d3 makeCase(n=60, 随机序)", 60, function () {
    D3.makeCase(20261105, 60, 0);
  }),
  bench("d3 stats(60 节点树)", 1000, function () { D3.stats(CASE_60.leftRoot); }),
  bench("d3 chartSeries(60 步折线)", 200, function () { D3.chartSeries(CASE_60, 59, "height"); })
];

let slowest = 0;
rows.forEach(function (r) { slowest = Math.max(slowest, r.each); });

console.log("Node " + process.version + " · 纯函数性能基准（单次平均，单位 ms）\n");
rows.forEach(function (r) {
  const flag = r.each > 16.7 ? "  <- 超过一帧" : "";
  console.log(
    "  " + r.label.padEnd(34, " ") + r.each.toFixed(3).padStart(8) + " ms  (" + r.reps + " 次平均)" + flag
  );
});
console.log("\n最慢一项 " + slowest.toFixed(3) + " ms，一帧预算 16.7 ms。" +
  (slowest < 16.7 ? " 所有纯计算都在一帧内完成。" : " 存在超过一帧的计算，需要检查。"));
