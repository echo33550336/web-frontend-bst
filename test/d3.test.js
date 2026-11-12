/**
 * d3.test.js —— 难点 3 纯函数的回归测试
 * 运行：node test/d3.test.js
 *
 * 这里断言的是"同一批数据、只换插入顺序"这件事真的实现了：
 * 生成可复现、两种顺序是同一批数的不同排列、统计读数与树形对得上。
 */
"use strict";

const fs = require("fs");
const path = require("path");
const D3 = require("../src/js/d3.js");

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

function sorted(values) {
  return values.slice().sort((a, b) => a - b);
}

function isAscending(values) {
  for (let i = 1; i < values.length; i += 1) {
    if (values[i - 1] >= values[i]) return false;
  }
  return true;
}

const SEED = 20261105;

/* 1. 数据生成：同 seed 同参数完全一致，不同 seed 不同 */
const a1 = D3.makeDataset(SEED, 20);
const a2 = D3.makeDataset(SEED, 20);
const b1 = D3.makeDataset(SEED + 1, 20);
eq("同 seed 同参数结果一致", a1, a2);
check("不同 seed 结果不同", JSON.stringify(a1) !== JSON.stringify(b1));
eq("数据数量 = n", a1.length, 20);
check("数据互不相同", new Set(a1).size === 20);
check("数据已按升序排好", isAscending(a1));
check("数据落在 1—999", a1.every((v) => v >= 1 && v <= 999));
check("n 会被夹到取值范围里", D3.makeDataset(SEED, 5000).length === 999);
eq("n=0 得到空序列", D3.makeDataset(SEED, 0), []);

/* 2. 插入顺序：右树永远是升序，左树由 orderedness 控制 */
const full = D3.makeCase(SEED, 20, 100);
const rand = D3.makeCase(SEED, 20, 0);
const half = D3.makeCase(SEED, 20, 50);
eq("右树顺序 = 升序序列", full.rightOrder, full.values);
eq("有序程度 100：左树顺序 = 升序（与右树相同）", full.leftOrder, full.rightOrder);
eq("有序程度 100：不做交换", full.swaps, 0);
eq("有序程度 0：交换次数 = 4n", rand.swaps, 80);
eq("有序程度 50：交换次数 = 2n", half.swaps, 40);
check("有序程度 0：左树顺序不是升序", !isAscending(rand.leftOrder));
eq("左树顺序是同一批数的排列", sorted(rand.leftOrder), sorted(rand.values));
eq("两棵树的数据排序后完全相等", sorted(rand.leftOrder), sorted(rand.rightOrder));
check("有序程度 0 确实打乱了位置", JSON.stringify(rand.leftOrder) !== JSON.stringify(rand.values));
eq("中间值：有序程度 50 也改变了顺序", JSON.stringify(half.leftOrder) !== JSON.stringify(half.values), true);

/* 3. 相邻交换的定义：k 次交换后仍然只动位置、不动数值集合；k 单调 */
eq("交换次数公式", [D3.swapsFor(20, 100), D3.swapsFor(20, 75), D3.swapsFor(20, 0)], [0, 20, 80]);
check("交换次数随有序程度降低而增加", D3.swapsFor(30, 0) > D3.swapsFor(30, 60));
eq("n=1 时原样返回", D3.leftOrder([7], 0, SEED), [7]);
eq("orderedness 越界会被夹住", D3.swapsFor(20, 200), 0);

/* 4. 升序链：高度 = n，最坏查找 = n，平均 = (1+2+…+n)/n */
const n = 7;
const chain = D3.buildTree(Array.from({ length: n }, (_, i) => i + 1));
eq("升序链的中序", D3.inorder(chain), [1, 2, 3, 4, 5, 6, 7]);
eq("升序链高度 = n", D3.height(chain), n);
eq("升序链最坏查找步数 = n", D3.searchSteps(chain, n), n);
const chainStats = D3.stats(chain);
eq("升序链 stats.height", chainStats.height, n);
eq("升序链最坏步数", chainStats.worstSteps, n);
eq("升序链平均步数 = (1+…+n)/n", D3.fmtNumber(chainStats.avgSteps), "4");
check("升序链平均步数 = 4", chainStats.avgSteps === 4);
eq("空树读数全 0", D3.stats(null), { n: 0, height: 0, avgSteps: 0, worstSteps: 0 });
eq("单节点高度 1", D3.stats(D3.buildTree([42])).height, 1);
eq("单节点平均步数 1", D3.stats(D3.buildTree([42])).avgSteps, 1);

/* 5. stats 与逐个查找的结果对得上 */
const shuffled = D3.buildTree([50, 30, 70, 20, 40, 60, 80]);
const manual = D3.inorder(shuffled).map((v) => D3.searchSteps(shuffled, v));
const manualAvg = manual.reduce((s, x) => s + x, 0) / manual.length;
eq("stats 平均步数与手工计算一致", D3.stats(shuffled).avgSteps, manualAvg);
eq("stats 最坏步数与手工计算一致", D3.stats(shuffled).worstSteps, Math.max.apply(null, manual));
eq("7 节点满二叉树高度 3", D3.stats(shuffled).height, 3);

/* 6. 第 i 步状态：每次从插入顺序重算，不依赖上一步 */
const caseData = D3.makeCase(SEED, 9, 0);
const s0 = D3.stepState(caseData, 0);
const s8 = D3.stepState(caseData, 8);
eq("第 1 步两边各 1 个节点", [s0.leftRoot && s0.leftRoot.value !== undefined, s0.rightRoot.value !== undefined], [true, true]);
eq("第 1 步两边树高都是 1", [s0.leftStats.height, s0.rightStats.height], [1, 1]);
eq("第 1 步两边各插入 1 个值", s0.inserted, 1);
eq("最后一步右边插入完毕", s8.rightValues, caseData.rightOrder);
eq("最后一步左边插入完毕（值）", s8.leftValues, caseData.leftOrder);
eq("最后一步两边节点数都 = n", [D3.stats(s8.leftRoot).n, D3.stats(s8.rightRoot).n], [9, 9]);
eq("最后一步右树（升序链）高度 = n", s8.rightStats.height, 9);
eq("重复计算结果一致", D3.stepState(caseData, 4).leftStats, D3.stepState(caseData, 4).leftStats);
eq("index 下界被夹住", D3.stepState(caseData, -3).index, 0);
eq("index 上界被夹住", D3.stepState(caseData, 99).index, 8);
eq("步骤数 = n", D3.stepsFor(caseData).length, 9);
eq("步骤序号从 0 开始", D3.stepsFor(caseData).map((s) => s.index), [0, 1, 2, 3, 4, 5, 6, 7, 8]);

/* 7. 几何：n=5..60 都装得进坐标盒，规模大时只留轮廓 */
check("小规模节点够大（可显示数字）", D3.geoFor(5).compact === false);
check("默认规模 20 仍显示数字", D3.geoFor(20).compact === false);
check("规模 60 切到紧凑模式", D3.geoFor(60).compact === true);
check("规模 60 的横向总宽不超出坐标盒", 59 * D3.geoFor(60).dx <= 400 - 44 + 0.001);
check("规模 60 的纵向总高不超出坐标盒", 59 * D3.geoFor(60).dy <= 360 - 48 + 0.001);
check("间距随规模单调变小", D3.geoFor(30).dx < D3.geoFor(5).dx);

/* 8. data/d3.json 的约定与 JS 对得上（文案/参数/占位符都来自 JSON） */
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "d3.json"), "utf8"));
eq("JSON id", cfg.id, "d3");
check("JSON 有标题/副标题/使用说明", Boolean(cfg.title && cfg.subtitle && cfg.howToUse && cfg.kicker));
eq("JSON dataset 种子与测试一致", cfg.dataset.seed, SEED);
eq("JSON dataset 取值范围", cfg.dataset.valueRange, [1, 999]);
eq("JSON dataset 最大交换系数 = 4n", cfg.dataset.maxSwapsPerNode, 4);
check("JSON dataset note 写明了 k 的公式", /\(100\s*[−-]\s*orderedness\)/.test(cfg.dataset.note));
const paramMap = {};
cfg.params.forEach((p) => { paramMap[p.key] = p; });
eq("参数个数", cfg.params.length, 3);
eq("规模参数范围", [paramMap.size.min, paramMap.size.max, paramMap.size.default], [5, 60, 20]);
eq("有序程度参数范围", [paramMap.orderedness.min, paramMap.orderedness.max, paramMap.orderedness.default], [0, 100, 100]);
eq("速度参数范围", [paramMap.speed.min, paramMap.speed.max, paramMap.speed.default], [1, 5, 2]);
check("每个参数都有标签", cfg.params.every((p) => p.label && p.key));
eq("三张读数卡的 key", cfg.metrics.map((m) => m.key), ["height", "avgSteps", "worstSteps"]);
check("读数卡都有标签和单位", cfg.metrics.every((m) => m.label && m.unit));
check("左右两棵树都有说明文字", Boolean(cfg.captions.left && cfg.captions.right));
check("左图说明是模板（随有序程度变化）", cfg.captions.left.includes("{orderedness}"));
["n", "hLeft", "hRight", "aLeft", "aRight"].forEach((key) => {
  check("结论包含占位符 {" + key + "}", cfg.conclusion.includes("{" + key + "}"));
});
check("过程文案有插入模板", Boolean(cfg.steps.insert.length > 0));
check("过程文案有收尾模板", Boolean(cfg.steps.done.length > 0));
check("状态栏模板含 {i} 与 {n}", cfg.labels.statusLine.includes("{i}") && cfg.labels.statusLine.includes("{n}"));
check("左右标签齐全", Boolean(cfg.labels.left && cfg.labels.right));

/* 9. 用 JSON 里的 seed 与默认参数跑一次完整演示，结论里的数字能算出来 */
const demo = D3.makeCase(cfg.dataset.seed, paramMap.size.default, paramMap.orderedness.default, {
  min: cfg.dataset.valueRange[0],
  max: cfg.dataset.valueRange[1],
});
eq("默认参数下两棵树是同一批数", sorted(demo.leftOrder), sorted(demo.rightOrder));
eq("默认参数下左树 = 升序（有序程度 100）", demo.leftOrder, demo.values);
const demoLast = D3.stepState(demo, demo.n - 1);
eq("默认参数最后一步右树退化成链", demoLast.rightStats.height, 20);
check("退化链的最坏查找步数 = 节点数", demoLast.rightStats.worstSteps === 20);
check("左树（默认升序）与右树读数相同", demoLast.leftStats.avgSteps === demoLast.rightStats.avgSteps);
const scrambled = D3.makeCase(cfg.dataset.seed, paramMap.size.default, 0, {
  min: cfg.dataset.valueRange[0],
  max: cfg.dataset.valueRange[1],
});
const scrambledLast = D3.stepState(scrambled, scrambled.n - 1);
check("随机顺序的树高明显低于升序链", scrambledLast.leftStats.height < demoLast.rightStats.height,
  "左 " + scrambledLast.leftStats.height + " 右 " + demoLast.rightStats.height);
check("随机顺序的平均查找步数更低", scrambledLast.leftStats.avgSteps < demoLast.rightStats.avgSteps,
  "左 " + D3.fmtNumber(scrambledLast.leftStats.avgSteps) + " 右 " + D3.fmtNumber(demoLast.rightStats.avgSteps));

/* 10. 重排：数值集合不变，只换左树插入顺序；salt 相同结果相同、不同则不同 */
const beforeReshuffle = D3.makeCase(SEED, 20, 0);
const res1 = D3.reshuffleCase(beforeReshuffle, 1);
const res1again = D3.reshuffleCase(beforeReshuffle, 1);
const res2 = D3.reshuffleCase(beforeReshuffle, 2);
eq("重排不改变 n", res1.n, beforeReshuffle.n);
eq("重排不改变数值集合", sorted(res1.values), sorted(beforeReshuffle.values));
eq("重排后右树顺序仍是升序", res1.rightOrder, beforeReshuffle.rightOrder);
eq("重排后的左树顺序仍是同一批数的排列", sorted(res1.leftOrder), sorted(beforeReshuffle.values));
check("重排换了左树的插入顺序",
  JSON.stringify(res1.leftOrder) !== JSON.stringify(beforeReshuffle.leftOrder));
check("连续两次重排顺序不同",
  JSON.stringify(res1.leftOrder) !== JSON.stringify(res2.leftOrder));
eq("同一个 salt 重排结果完全一致", res1.leftOrder, res1again.leftOrder);
eq("salt 记在 case 里", [res1.salt, res2.salt], [1, 2]);
eq("makeCase 传 salt 与 reshuffleCase 等价", D3.makeCase(SEED, 20, 0, null, 1).leftOrder, res1.leftOrder);
eq("salt=0 与不传 salt 完全等价", D3.makeCase(SEED, 20, 0).leftOrder, beforeReshuffle.leftOrder);
eq("leftOrder 显式 salt=0 与旧签名等价",
  D3.leftOrder(beforeReshuffle.values, 0, SEED, 0), D3.leftOrder(beforeReshuffle.values, 0, SEED));
check("有序程度 100 时重排无法产生第二种顺序（升序唯一）",
  D3.reshuffleCase(D3.makeCase(SEED, 20, 100), 3).leftOrder.join(",") ===
  D3.makeCase(SEED, 20, 100).rightOrder.join(","));

/* 11. 折线序列：点数随步数增长、可确定性截断、末点与 stats 对得上 */
const chartCase = D3.makeCase(SEED, 12, 0);
const chart1 = D3.chartSeries(chartCase, 0, "height");
const chart5 = D3.chartSeries(chartCase, 4, "height");
const chartFull = D3.chartSeries(chartCase, 11, "height");
eq("第 1 步每条线 1 个点", [chart1.left.length, chart1.right.length], [1, 1]);
eq("第 5 步每条线 5 个点", [chart5.left.length, chart5.right.length], [5, 5]);
eq("最后一步每条线 n 个点", [chartFull.left.length, chartFull.right.length], [12, 12]);
eq("横轴 x 从 1 连续到当前步", chart5.left.map((p) => p.x), [1, 2, 3, 4, 5]);
eq("折线 metric 记在结果里", chart5.metric, "height");
eq("截断是确定性的：后一步的前段 = 前一步整段",
  chartFull.left.slice(0, 5), chart5.left);
eq("上一步/重置依赖同一个纯函数",
  D3.chartSeries(chartCase, 4, "height").left, chart5.left);
eq("末点 = 最后一步的树高",
  chartFull.left[chartFull.left.length - 1].y, D3.stepState(chartCase, 11).leftStats.height);
eq("平均步数曲线末点 = stats 平均值",
  D3.chartSeries(chartCase, 11, "avgSteps").right.slice(-1)[0].y,
  D3.stepState(chartCase, 11).rightStats.avgSteps);
check("索引下界被夹住", D3.chartSeries(chartCase, -5, "height").left.length === 1);
check("索引上界被夹住", D3.chartSeries(chartCase, 999, "height").left.length === 12);
eq("升序右树的树高曲线是一条 1..n 的斜线",
  chartFull.right.map((p) => p.y), Array.from({ length: 12 }, (_, i) => i + 1));
const yMax = D3.chartYMax(chartCase, "height");
eq("纵轴上限 = 整场演示里的最大树高", yMax, 12);
check("纵轴上限覆盖两条线的所有点",
  chartFull.left.every((p) => p.y <= yMax) && chartFull.right.every((p) => p.y <= yMax));
check("随机左树的高度曲线低于升序右树",
  chartFull.left[11].y < chartFull.right[11].y,
  "left=" + chartFull.left[11].y + " right=" + chartFull.right[11].y);

/* 12. JSON 里新增的折线图与重排定义 */
check("JSON 有 chart 配置", Boolean(cfg.chart && cfg.chart.title && cfg.chart.note));
eq("折线画的是树高（与指标卡一致）", cfg.chart.metric, "height");
check("折线有纵轴/横轴标签", Boolean(cfg.chart.yLabel && cfg.chart.xLabel));
check("折线图例是模板（左）", cfg.chart.legendLeft.includes("{orderedness}"));
check("折线说明写清横轴与截断", /横轴/.test(cfg.chart.note) && /截断/.test(cfg.chart.note));
eq("JSON 有重排按钮文案", cfg.labels.reshuffle, "重排");
check("JSON 有重排说明", Boolean(cfg.labels.reshuffleHint && cfg.labels.reshuffleHint.length > 10));
check("使用说明提到重排与折线",
  cfg.howToUse.includes("重排") && cfg.howToUse.includes("折线"));

/* 13. 默认参数（有序程度 100）下，图表用不到重排，但页面仍按 salt=0 生成 */
const defaultChart = D3.chartSeries(demo, demo.n - 1, cfg.chart.metric || "height");
eq("默认演示的两条曲线末尾右树退化到 n 层", defaultChart.right[defaultChart.right.length - 1].y, 20);

console.log(pass + " 项通过" + (fails.length ? "，" + fails.length + " 项失败：" : "，全部通过"));
fails.forEach((f) => console.log("  ✗ " + f));
process.exit(fails.length ? 1 : 0);
