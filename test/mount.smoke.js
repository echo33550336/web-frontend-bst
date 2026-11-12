/**
 * mount.smoke.js —— 不开浏览器，验证 d1.html 真的能挂载起来
 * 运行：node test/mount.smoke.js
 *
 * 它检查的是"页面能不能用"这件事，不是 BST 算法（算法在 d1.test.js 里测）：
 * 1. fetch 能否读到 data/*.json；2. 树是否画出来；3. 拖滑块后路径是否变化；
 * 4. 播放/单步/重置是否改变状态；5. 插入后中序是否仍递增。
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const fails = [];
let pass = 0;
function check(name, cond, extra) {
  if (cond) pass += 1;
  else fails.push(name + (extra ? "  ← " + extra : ""));
}

const html = fs.readFileSync(path.join(ROOT, "src", "d1.html"), "utf8");
const dom = new JSDOM(html, { url: "http://localhost/src/d1.html", runScripts: "outside-only", pretendToBeVisual: true });
const win = dom.window;

// 把 fetch 指到本地磁盘：路径相对 src/d1.html
win.fetch = async function (p) {
  const file = path.resolve(ROOT, "src", String(p).replace(/^\.\.\//, "../"));
  if (!fs.existsSync(file)) return { ok: false, status: 404 };
  const text = fs.readFileSync(file, "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(text) };
};

win.eval(fs.readFileSync(path.join(ROOT, "src", "js", "common.js"), "utf8"));
win.eval(fs.readFileSync(path.join(ROOT, "src", "js", "tree.js"), "utf8"));
win.eval(fs.readFileSync(path.join(ROOT, "src", "js", "d1.js"), "utf8"));

win.D1.mount();

setTimeout(() => {
  const doc = win.document;
  check("App 已加载", typeof win.App === "object");
  check("D1 已加载", typeof win.D1 === "object");

  const circles = doc.querySelectorAll("#canvas circle");
  check("树被画出来了（7 个节点）", circles.length === 7, "circles=" + circles.length);

  const intervals = doc.querySelectorAll("#canvas .node-interval");
  check("每个节点都有区间标注", intervals.length === 7, "labels=" + intervals.length);
  const hasRootInterval = Array.prototype.some.call(intervals, (n) => n.textContent === "(−∞, +∞)");
  check("根节点区间是 (−∞, +∞)", hasRootInterval);

  const candidateEl = doc.getElementById("panel-candidates");
  check("载入时按默认值 65 直接预览（候选位置已收窄到 1）", candidateEl.textContent === "1", candidateEl.textContent);

  check("参数控件由 JSON 渲染（待插入值 / 树规模 / 演示速度）", doc.querySelectorAll("#params input[type=range]").length === 3);
  check("中序序列已显示", doc.getElementById("panel-inorder").textContent === "20 · 30 · 40 · 50 · 60 · 70 · 80",
    doc.getElementById("panel-inorder").textContent);
  check("中序校验结果已上屏", /✓/.test(doc.getElementById("inorder-check").textContent),
    doc.getElementById("inorder-check").textContent);
  check("面板标题来自 JSON", doc.getElementById("card-interval-title").textContent === "允许区间",
    doc.getElementById("card-interval-title").textContent);
  check("操作说明来自 JSON（提到树规模）", doc.getElementById("page-howto").textContent.indexOf("树规模") > -1);

  // 拖滑块到 65
  const slider = doc.getElementById("param-value");
  slider.value = "65";
  slider.dispatchEvent(new win.Event("input"));

  const pathCircles = doc.querySelectorAll("#canvas circle.on-path");
  check("拖动后路径被高亮（50 → 70 → 60 共 3 个）", pathCircles.length === 3, "on-path=" + pathCircles.length);
  check("候选位置收窄到 1", candidateEl.textContent === "1", candidateEl.textContent);

  const chain = doc.querySelectorAll("#panel-interval li");
  check("区间链有 4 层", chain.length === 4, "chain=" + chain.length);

  // 播放控件
  const status = doc.getElementById("status");
  doc.getElementById("btn-next").dispatchEvent(new win.Event("click"));
  check("下一步后状态栏更新", /第 2 \/ \d+ 步/.test(status.textContent), status.textContent);
  doc.getElementById("btn-reset").dispatchEvent(new win.Event("click"));
  check("重置回到第 1 步", /第 1 \/ \d+ 步/.test(status.textContent), status.textContent);

  // 插入：把速度拉满，推到最后一格
  const speed = doc.getElementById("param-speed");
  speed.value = "5";
  speed.dispatchEvent(new win.Event("input"));
  doc.getElementById("param-value").value = "65";
  doc.getElementById("param-value").dispatchEvent(new win.Event("input"));
  doc.getElementById("btn-insert").dispatchEvent(new win.Event("click"));

  setTimeout(() => {
    const inorder = doc.getElementById("panel-inorder").textContent;
    check("插入后中序仍递增且含 65", inorder === "20 · 30 · 40 · 50 · 60 · 65 · 70 · 80", inorder);
    check("插入后画布有 8 个节点", doc.querySelectorAll("#canvas circle").length === 8,
      "circles=" + doc.querySelectorAll("#canvas circle").length);

    // 回退到 attach 之前再走一遍：不应该二次插入 65
    doc.getElementById("btn-prev").click();
    check("回到上一步（land）后画面回到挂接前", doc.querySelectorAll("#canvas circle").length === 7,
      "circles=" + doc.querySelectorAll("#canvas circle").length);
    doc.getElementById("btn-next").click();
    check("再次 attach 仍只有 8 个节点（不重复插入）", doc.querySelectorAll("#canvas circle").length === 8,
      "circles=" + doc.querySelectorAll("#canvas circle").length);
    check("重播后中序仍正确", doc.getElementById("panel-inorder").textContent === "20 · 30 · 40 · 50 · 60 · 65 · 70 · 80",
      doc.getElementById("panel-inorder").textContent);

    // 树规模滑块：改到 11 后随机重生成，节点数应立刻变成 11
    const size = doc.getElementById("param-size");
    size.value = "11";
    size.dispatchEvent(new win.Event("input"));
    check("树规模滑块重生成 11 个节点", doc.querySelectorAll("#canvas circle").length === 11,
      "circles=" + doc.querySelectorAll("#canvas circle").length);
    check("重生成后中序仍递增", /✓/.test(doc.getElementById("inorder-check").textContent),
      doc.getElementById("inorder-check").textContent);

    console.log(pass + " 项通过" + (fails.length ? "，" + fails.length + " 项失败：" : "，全部通过"));
    fails.forEach((f) => console.log("  ✗ " + f));
    process.exit(fails.length ? 1 : 0);
  }, 2000);
}, 120);
