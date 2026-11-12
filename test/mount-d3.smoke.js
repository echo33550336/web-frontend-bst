/**
 * mount-d3.smoke.js —— 不开浏览器，验证 d3.html 真的能挂载起来
 * 运行：node test/mount-d3.smoke.js
 *
 * 它检查的是"页面能不能用"这件事，不是 BST 算法（算法在 d3.test.js 里测）：
 * 1. JSON 是否读进来、两棵画布是否都画出来；2. 读数卡与结论是否按步骤更新；
 * 3. 参数滑块是否真的重新生成数据；4. 播放/单步/重置/速度是否改变状态。
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const D3 = require("../src/js/d3.js");

const ROOT = path.join(__dirname, "..");
const fails = [];
let pass = 0;
function check(name, cond, extra) {
  if (cond) pass += 1;
  else fails.push(name + (extra ? "  ← " + extra : ""));
}

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "d3.json"), "utf8"));
const html = fs.readFileSync(path.join(ROOT, "src", "d3.html"), "utf8");
const dom = new JSDOM(html, { url: "http://localhost/src/d3.html", runScripts: "outside-only", pretendToBeVisual: true });
const win = dom.window;

// 把 fetch 指到本地磁盘：路径相对 src/d3.html
win.fetch = async function (p) {
  const file = path.resolve(ROOT, "src", String(p).replace(/^\.\.\//, "../"));
  if (!fs.existsSync(file)) return { ok: false, status: 404 };
  const text = fs.readFileSync(file, "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(text) };
};

["common.js", "tree.js", "d3.js"].forEach((name) => {
  win.eval(fs.readFileSync(path.join(ROOT, "src", "js", name), "utf8"));
});
win.D3.mount();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 与页面里 App.format 相同的占位符替换，用来算"文案应该长什么样" */
function fmt(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (m, key) => (vars[key] !== undefined ? String(vars[key]) : m));
}

function textOf(doc, id) {
  const el = doc.getElementById(id);
  return el ? el.textContent : "";
}

function metricText(doc, key) {
  const card = doc.querySelector('.metric[data-metric="' + key + '"]');
  return card ? card.textContent.replace(/\s+/g, " ").trim() : "";
}

function valueOf(doc, key, side) {
  const el = doc.querySelector('.metric[data-metric="' + key + '"] .mv-' + side);
  return el ? el.textContent : "";
}

async function main() {
  await sleep(150);
  const doc = win.document;

  /* ---------- 1. 载入与初始状态 ---------- */
  check("App 已加载", typeof win.App === "object");
  check("D3 已加载", typeof win.D3 === "object");
  check("d3.html 按 common → tree → d3 的顺序加载脚本",
    /js\/common\.js[\s\S]*js\/tree\.js[\s\S]*js\/d3\.js/.test(html));
  check("标题来自 JSON", textOf(doc, "page-title") === cfg.title, textOf(doc, "page-title"));
  check("副标题来自 JSON", textOf(doc, "page-subtitle") === cfg.subtitle, textOf(doc, "page-subtitle"));
  check("kicker 来自 JSON", textOf(doc, "page-kicker").includes(cfg.kicker), textOf(doc, "page-kicker"));

  const leftSvg = doc.getElementById("canvas-left");
  const rightSvg = doc.getElementById("canvas-right");
  check("左右两个画布都存在", Boolean(leftSvg && rightSvg));
  check("左画布画出 1 个节点", leftSvg.querySelectorAll("circle").length === 1,
    "circles=" + leftSvg.querySelectorAll("circle").length);
  check("右画布画出 1 个节点", rightSvg.querySelectorAll("circle").length === 1,
    "circles=" + rightSvg.querySelectorAll("circle").length);
  check("两画布都有 viewBox", Boolean(leftSvg.getAttribute("viewBox") && rightSvg.getAttribute("viewBox")),
    leftSvg.getAttribute("viewBox"));
  check("两画布 viewBox 一致（同一套几何才可比较）",
    leftSvg.getAttribute("viewBox") === rightSvg.getAttribute("viewBox"));
  check("新插入节点被高亮（左）", leftSvg.querySelectorAll("circle.is-new").length === 1);
  check("新插入节点被高亮（右）", rightSvg.querySelectorAll("circle.is-new").length === 1);

  check("三张读数卡由 JSON 渲染", doc.querySelectorAll("#metrics .metric").length === 3,
    "cards=" + doc.querySelectorAll("#metrics .metric").length);
  check("读数卡标签来自 JSON", metricText(doc, "height").includes(cfg.metrics[0].label), metricText(doc, "height"));
  check("初始树高左 1", valueOf(doc, "height", "left") === "左 1", valueOf(doc, "height", "left"));
  check("初始树高右 1", valueOf(doc, "height", "right") === "右 1", valueOf(doc, "height", "right"));
  check("初始平均步数左 1", valueOf(doc, "avgSteps", "left") === "左 1", valueOf(doc, "avgSteps", "left"));
  check("初始最坏步数右 1", valueOf(doc, "worstSteps", "right") === "右 1", valueOf(doc, "worstSteps", "right"));

  check("参数区有 3 个滑块", doc.querySelectorAll("#params input[type=range]").length === 3);
  check("规模默认 20", doc.getElementById("param-size").value === "20");
  check("有序程度默认 100", doc.getElementById("param-orderedness").value === "100");
  check("速度默认 2", doc.getElementById("param-speed").value === "2");
  check("状态栏显示第 1 / 20 步", /^第 1 \/ 20 步$/.test(textOf(doc, "status")), textOf(doc, "status"));

  check("左右说明文字来自 JSON captions",
    textOf(doc, "caption-left") === fmt(cfg.captions.left, { orderedness: 100 }),
    textOf(doc, "caption-left"));
  check("右图说明写明升序", textOf(doc, "caption-right") === cfg.captions.right);

  const caseDefault = D3.makeCase(cfg.dataset.seed, 20, 100, {
    min: cfg.dataset.valueRange[0],
    max: cfg.dataset.valueRange[1],
  });
  const step1 = D3.stepState(caseDefault, 0);
  check("第 1 步过程文案来自 JSON 模板",
    textOf(doc, "panel-step") === fmt(cfg.steps.insert, {
      i: 1, n: 20, leftValue: step1.newLeft, rightValue: step1.newRight,
      hLeft: step1.leftStats.height, hRight: step1.rightStats.height,
      aLeft: D3.fmtNumber(step1.leftStats.avgSteps), aRight: D3.fmtNumber(step1.rightStats.avgSteps),
    }), textOf(doc, "panel-step"));
  check("结论卡初始隐藏", doc.getElementById("conclusion-card").hidden === true);

  /* ---------- 2. 下一步 / 上一步 / 重置 ---------- */
  doc.getElementById("btn-next").dispatchEvent(new win.Event("click"));
  check("下一步后左画布 2 个节点", leftSvg.querySelectorAll("circle").length === 2,
    "circles=" + leftSvg.querySelectorAll("circle").length);
  check("下一步后右画布 2 个节点", rightSvg.querySelectorAll("circle").length === 2);
  check("下一步后状态栏第 2 / 20 步", /^第 2 \/ 20 步$/.test(textOf(doc, "status")), textOf(doc, "status"));
  const step2 = D3.stepState(caseDefault, 1);
  check("第 2 步右树高 2（升序插入 = 链）", valueOf(doc, "height", "right") === "右 2",
    valueOf(doc, "height", "right"));
  check("第 2 步左树高 2（默认也是升序）", valueOf(doc, "height", "left") === "左 2",
    valueOf(doc, "height", "left"));
  check("升序链的平均查找步数 = (1+2)/2",
    valueOf(doc, "avgSteps", "right") === "右 " + D3.fmtNumber(step2.rightStats.avgSteps),
    valueOf(doc, "avgSteps", "right"));
  check("第 2 步过程文案含两个新值",
    textOf(doc, "panel-step").includes(String(step2.newLeft)) &&
    textOf(doc, "panel-step").includes(String(step2.newRight)));

  doc.getElementById("btn-prev").dispatchEvent(new win.Event("click"));
  check("上一步回到 1 个节点", leftSvg.querySelectorAll("circle").length === 1);
  check("上一步回到第 1 / 20 步", /^第 1 \/ 20 步$/.test(textOf(doc, "status")), textOf(doc, "status"));

  doc.getElementById("btn-next").dispatchEvent(new win.Event("click"));
  doc.getElementById("btn-reset").dispatchEvent(new win.Event("click"));
  check("重置回到第 1 步", /^第 1 \/ 20 步$/.test(textOf(doc, "status")), textOf(doc, "status"));
  check("重置后两画布各 1 个节点",
    leftSvg.querySelectorAll("circle").length === 1 && rightSvg.querySelectorAll("circle").length === 1);

  /* ---------- 3. 有序程度滑块：重新生成数据并重置 ---------- */
  const ordered = doc.getElementById("param-orderedness");
  check("有序程度读数显示 100", ordered.parentNode.querySelector(".readout").textContent === "100");
  ordered.value = "0";
  ordered.dispatchEvent(new win.Event("input"));
  check("拖动滑块后读数变成 0", ordered.parentNode.querySelector(".readout").textContent === "0");
  check("拖动后重置到第 1 / 20 步", /^第 1 \/ 20 步$/.test(textOf(doc, "status")), textOf(doc, "status"));
  check("左图说明跟着变成 0%",
    textOf(doc, "caption-left") === fmt(cfg.captions.left, { orderedness: 0 }), textOf(doc, "caption-left"));
  check("拖动后左右仍是各 1 个节点",
    leftSvg.querySelectorAll("circle").length === 1 && rightSvg.querySelectorAll("circle").length === 1);

  const caseRandom = D3.makeCase(cfg.dataset.seed, 20, 0, {
    min: cfg.dataset.valueRange[0],
    max: cfg.dataset.valueRange[1],
  });
  check("随机顺序确实不同于升序（页面内部数据可用）",
    JSON.stringify(caseRandom.leftOrder) !== JSON.stringify(caseRandom.values));

  /* ---------- 4. 推到最后一格：conclusion 出现且数字正确 ---------- */
  for (let i = 0; i < 19; i += 1) {
    doc.getElementById("btn-next").dispatchEvent(new win.Event("click"));
  }
  check("最后一步状态栏第 20 / 20 步", /^第 20 \/ 20 步$/.test(textOf(doc, "status")), textOf(doc, "status"));
  check("最后一步左右各 20 个节点",
    leftSvg.querySelectorAll("circle").length === 20 && rightSvg.querySelectorAll("circle").length === 20,
    "left=" + leftSvg.querySelectorAll("circle").length + " right=" + rightSvg.querySelectorAll("circle").length);
  const last = D3.stepState(caseRandom, 19);
  check("最后一步过程文案用 JSON 的 done 模板",
    textOf(doc, "panel-step") === fmt(cfg.steps.done, {
      n: 20, hLeft: last.leftStats.height, hRight: last.rightStats.height,
      aLeft: D3.fmtNumber(last.leftStats.avgSteps), aRight: D3.fmtNumber(last.rightStats.avgSteps),
    }), textOf(doc, "panel-step"));

  const conclusionCard = doc.getElementById("conclusion-card");
  check("最后一步结论卡出现", conclusionCard.hidden === false);
  const expectedConclusion = fmt(cfg.conclusion, {
    n: 20,
    hLeft: last.leftStats.height,
    hRight: last.rightStats.height,
    aLeft: D3.fmtNumber(last.leftStats.avgSteps),
    aRight: D3.fmtNumber(last.rightStats.avgSteps),
  });
  check("结论文本来自 JSON 且有真实数字",
    textOf(doc, "panel-conclusion") === expectedConclusion, textOf(doc, "panel-conclusion"));
  check("结论里含 20 个数与两棵树高",
    textOf(doc, "panel-conclusion").includes("20") &&
    textOf(doc, "panel-conclusion").includes(String(last.leftStats.height)) &&
    textOf(doc, "panel-conclusion").includes(String(last.rightStats.height)));
  check("升序右树退化：高 20、平均步数 10.5",
    last.rightStats.height === 20 && D3.fmtNumber(last.rightStats.avgSteps) === "10.5");
  check("随机左树比升序右树矮", last.leftStats.height < last.rightStats.height,
    "left=" + last.leftStats.height + " right=" + last.rightStats.height);

  /* ---------- 5. 规模滑块：n=9 与 n=60 ---------- */
  const size = doc.getElementById("param-size");
  size.value = "9";
  size.dispatchEvent(new win.Event("input"));
  check("规模改成 9 后状态栏第 1 / 9 步", /^第 1 \/ 9 步$/.test(textOf(doc, "status")), textOf(doc, "status"));
  check("规模变小后重置到 1 个节点", leftSvg.querySelectorAll("circle").length === 1);
  check("规模变小后结论卡重新隐藏", conclusionCard.hidden === true);

  size.value = "60";
  size.dispatchEvent(new win.Event("input"));
  check("规模改成 60 后状态栏第 1 / 60 步", /^第 1 \/ 60 步$/.test(textOf(doc, "status")), textOf(doc, "status"));
  check("规模 60 时两画布切到紧凑模式（节点数字隐去）",
    leftSvg.classList.contains("compact") && rightSvg.classList.contains("compact"));
  const hint = doc.getElementById("metrics-hint");
  check("紧凑模式下出现提示文字", hint.hidden === false && hint.textContent === cfg.labels.compactHint,
    hint.textContent);
  check("规模 60 时两画布仍各有 1 个节点",
    leftSvg.querySelectorAll("circle").length === 1 && rightSvg.querySelectorAll("circle").length === 1);

  /* ---------- 6. 播放 / 暂停 / 速度 ---------- */
  const speed = doc.getElementById("param-speed");
  speed.value = "5";
  speed.dispatchEvent(new win.Event("input"));
  doc.getElementById("btn-reset").dispatchEvent(new win.Event("click"));
  doc.getElementById("btn-play").dispatchEvent(new win.Event("click"));
  check("播放中状态栏带「播放中」", textOf(doc, "status").includes(cfg.labels.playing),
    textOf(doc, "status"));
  await sleep(700);
  const playingStatus = textOf(doc, "status");
  check("播放后步数自动推进", /^第 ([2-9]|[1-5]\d) \/ 60 步 · 播放中$/.test(playingStatus), playingStatus);
  check("播放时树同步长高", leftSvg.querySelectorAll("circle").length > 1,
    "circles=" + leftSvg.querySelectorAll("circle").length);

  doc.getElementById("btn-pause").dispatchEvent(new win.Event("click"));
  check("暂停后「播放中」消失", !textOf(doc, "status").includes(cfg.labels.playing),
    textOf(doc, "status"));
  const pausedStatus = textOf(doc, "status");
  await sleep(500);
  check("暂停后步数不再变化", textOf(doc, "status") === pausedStatus);

  /* ---------- 7. 折线图：两条线随步数增长，单步/重置按当前步截断 ---------- */
  size.value = "9";
  size.dispatchEvent(new win.Event("input"));
  const chartSvg = doc.getElementById("chart");
  /* 每次重画都会清空并重建 <polyline>，所以必须重新查询，不能缓存元素引用 */
  const chartLine = (cls) => chartSvg.querySelector(cls);
  const chartPoints = (cls) => ((chartLine(cls) && chartLine(cls).getAttribute("points")) || "")
    .trim().split(/\s+/).filter(Boolean);
  check("折线图画布存在且已设 viewBox", Boolean(chartSvg.getAttribute("viewBox")), chartSvg.getAttribute("viewBox"));
  check("折线图标题来自 JSON", textOf(doc, "chart-title") === cfg.chart.title, textOf(doc, "chart-title"));
  check("折线图左图例来自 JSON（随有序程度变化）",
    textOf(doc, "chart-legend-left") === fmt(cfg.chart.legendLeft, { orderedness: 0 }),
    textOf(doc, "chart-legend-left"));
  check("折线图右图例来自 JSON", textOf(doc, "chart-legend-right") === cfg.chart.legendRight);
  check("两条折线都画出来了",
    Boolean(chartLine(".chart-line-left")) && Boolean(chartLine(".chart-line-right")));
  check("初始每条折线 1 个点",
    chartPoints(".chart-line-left").length === 1 && chartPoints(".chart-line-right").length === 1,
    "left=" + chartPoints(".chart-line-left").length + " right=" + chartPoints(".chart-line-right").length);
  check("折线坐标都是有限数字",
    chartPoints(".chart-line-left").concat(chartPoints(".chart-line-right")).every((p) => {
      const xy = p.split(",");
      return xy.length === 2 && isFinite(Number(xy[0])) && isFinite(Number(xy[1]));
    }));
  check("纵轴/横轴标签来自 JSON",
    chartSvg.textContent.includes(cfg.chart.yLabel) && chartSvg.textContent.includes(cfg.chart.xLabel),
    chartSvg.textContent.replace(/\s+/g, " ").slice(0, 80));
  check("折线图说明来自 JSON", textOf(doc, "chart-note") === cfg.chart.note);

  for (let i = 0; i < 4; i += 1) {
    doc.getElementById("btn-next").dispatchEvent(new win.Event("click"));
  }
  check("推进 4 步后每条折线 5 个点",
    chartPoints(".chart-line-left").length === 5 && chartPoints(".chart-line-right").length === 5,
    "left=" + chartPoints(".chart-line-left").length + " right=" + chartPoints(".chart-line-right").length);
  doc.getElementById("btn-prev").dispatchEvent(new win.Event("click"));
  check("上一步把折线截断回 4 个点", chartPoints(".chart-line-left").length === 4,
    "left=" + chartPoints(".chart-line-left").length);
  doc.getElementById("btn-reset").dispatchEvent(new win.Event("click"));
  check("重置把折线截断回 1 个点", chartPoints(".chart-line-left").length === 1);

  /* ---------- 8. 重排：集合不变、顺序改变、回到第 1 步、播放中先暂停 ---------- */
  const reshuffleBtn = doc.getElementById("btn-reshuffle");
  check("重排按钮存在且文案来自 JSON",
    Boolean(reshuffleBtn) && reshuffleBtn.textContent === cfg.labels.reshuffle);
  check("重排说明来自 JSON", textOf(doc, "reshuffle-hint") === cfg.labels.reshuffleHint);

  const rngRange = { min: cfg.dataset.valueRange[0], max: cfg.dataset.valueRange[1] };
  ordered.value = "100";
  ordered.dispatchEvent(new win.Event("input"));
  check("重排前有序程度是 100", ordered.value === "100" && /^第 1 \/ 9 步$/.test(textOf(doc, "status")));

  reshuffleBtn.click();
  check("100% 时重排把有序程度降为 0", ordered.value === "0", ordered.value);
  check("重排后滑块读数同步为 0", ordered.parentNode.querySelector(".readout").textContent === "0");
  check("重排后回到第 1 / 9 步", /^第 1 \/ 9 步$/.test(textOf(doc, "status")), textOf(doc, "status"));
  check("重排后左右各 1 个节点",
    leftSvg.querySelectorAll("circle").length === 1 && rightSvg.querySelectorAll("circle").length === 1);
  check("重排后左图说明变成 0%",
    textOf(doc, "caption-left") === fmt(cfg.captions.left, { orderedness: 0 }),
    textOf(doc, "caption-left"));

  for (let i = 0; i < 8; i += 1) {
    doc.getElementById("btn-next").dispatchEvent(new win.Event("click"));
  }
  const salt1 = D3.makeCase(cfg.dataset.seed, 9, 0, rngRange, 1);
  const salt1Last = D3.stepState(salt1, 8);
  check("重排后仍是 9 个数（两边各 9 个节点）",
    leftSvg.querySelectorAll("circle").length === 9 && rightSvg.querySelectorAll("circle").length === 9,
    "left=" + leftSvg.querySelectorAll("circle").length);
  check("重排后左树高与 Node 侧 salt=1 计算一致",
    valueOf(doc, "height", "left") === "左 " + salt1Last.leftStats.height,
    valueOf(doc, "height", "left") + " vs 左 " + salt1Last.leftStats.height);
  check("重排后结论与 Node 侧 salt=1 计算一致",
    textOf(doc, "panel-conclusion") === fmt(cfg.conclusion, {
      n: 9,
      hLeft: salt1Last.leftStats.height,
      hRight: salt1Last.rightStats.height,
      aLeft: D3.fmtNumber(salt1Last.leftStats.avgSteps),
      aRight: D3.fmtNumber(salt1Last.rightStats.avgSteps),
    }), textOf(doc, "panel-conclusion"));

  reshuffleBtn.click();
  check("连续重排仍回到第 1 步", /^第 1 \/ 9 步$/.test(textOf(doc, "status")), textOf(doc, "status"));
  for (let i = 0; i < 8; i += 1) {
    doc.getElementById("btn-next").dispatchEvent(new win.Event("click"));
  }
  const salt2 = D3.makeCase(cfg.dataset.seed, 9, 0, rngRange, 2);
  const salt2Last = D3.stepState(salt2, 8);
  check("连续重排确实换了左树顺序",
    JSON.stringify(salt1.leftOrder) !== JSON.stringify(salt2.leftOrder));
  check("第二次重排后的结论与 Node 侧 salt=2 计算一致",
    textOf(doc, "panel-conclusion") === fmt(cfg.conclusion, {
      n: 9,
      hLeft: salt2Last.leftStats.height,
      hRight: salt2Last.rightStats.height,
      aLeft: D3.fmtNumber(salt2Last.leftStats.avgSteps),
      aRight: D3.fmtNumber(salt2Last.rightStats.avgSteps),
    }), textOf(doc, "panel-conclusion"));

  doc.getElementById("btn-reset").dispatchEvent(new win.Event("click"));
  doc.getElementById("btn-play").dispatchEvent(new win.Event("click"));
  check("重排前正在播放", textOf(doc, "status").includes(cfg.labels.playing), textOf(doc, "status"));
  reshuffleBtn.click();
  check("播放中点重排会先暂停",
    !textOf(doc, "status").includes(cfg.labels.playing), textOf(doc, "status"));
  check("播放中重排后回到第 1 / 9 步", /^第 1 \/ 9 步$/.test(textOf(doc, "status")), textOf(doc, "status"));

  console.log(pass + " 项通过" + (fails.length ? "，" + fails.length + " 项失败：" : "，全部通过"));
  fails.forEach((f) => console.log("  ✗ " + f));
  process.exit(fails.length ? 1 : 0);
}

main().catch((err) => {
  console.log("挂载测试异常：" + (err && err.stack ? err.stack : err));
  process.exit(1);
});
