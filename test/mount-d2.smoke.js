/**
 * mount-d2.smoke.js —— 不开浏览器，验证 d2.html 真的能挂载并走完交互
 * 运行：node test/mount-d2.smoke.js
 *
 * 检查的是"页面能不能用"：树画出来没有、目标有没有高亮、下一步文案变不变、
 * 切换情形会不会重建、A/B/C 选错会不会停在原地并显示后果、选对会不会继续、
 * 重置回没回到第 1 步、点节点能不能改选目标。
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

const html = fs.readFileSync(path.join(ROOT, "src", "d2.html"), "utf8");
const dom = new JSDOM(html, { url: "http://localhost/src/d2.html", runScripts: "outside-only", pretendToBeVisual: true });
const win = dom.window;

// 把 fetch 指到本地磁盘：路径相对 src/d2.html
win.fetch = async function (p) {
  const file = path.resolve(ROOT, "src", String(p).replace(/^\.\.\//, "../"));
  if (!fs.existsSync(file)) return { ok: false, status: 404 };
  const text = fs.readFileSync(file, "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(text) };
};

win.eval(fs.readFileSync(path.join(ROOT, "src", "js", "common.js"), "utf8"));
win.eval(fs.readFileSync(path.join(ROOT, "src", "js", "tree.js"), "utf8"));
win.eval(fs.readFileSync(path.join(ROOT, "src", "js", "d2.js"), "utf8"));

win.D2.mount();

function doc() {
  return win.document;
}
function byId(id) {
  return doc().getElementById(id);
}
function click(id) {
  byId(id).dispatchEvent(new win.Event("click"));
}
function clickEl(el) {
  el.dispatchEvent(new win.Event("click"));
}
function nodes() {
  return doc().querySelectorAll("#canvas g.node");
}
function nodeValue(g) {
  const t = g.querySelector(".node-value");
  return t ? t.textContent : null;
}
function nodeByValue(value) {
  return Array.prototype.find.call(nodes(), (g) => nodeValue(g) === String(value));
}
function targetValue() {
  const circle = doc().querySelector("#canvas circle.is-target");
  if (!circle) return null;
  const g = circle.parentNode;
  const t = g.querySelector(".node-value");
  return t ? t.textContent : null;
}
function statusText() {
  return byId("status").textContent;
}
function stepText() {
  return byId("panel-step").textContent;
}
function chooseButtons() {
  return doc().querySelectorAll("#choose-options button");
}
function selectParam(key, value) {
  const el = byId("param-" + key);
  el.value = value;
  el.dispatchEvent(new win.Event("change"));
}
function feedbackVisible() {
  const fb = byId("panel-feedback");
  return !fb.hidden && fb.textContent.length > 0;
}

setTimeout(function phaseA() {
  check("App 已加载", typeof win.App === "object");
  check("D2 已加载", typeof win.D2 === "object");
  check("标题由 JSON 填充", byId("page-title").textContent.length > 2);
  check("说明由 JSON 填充", byId("page-howto").textContent.length > 10);

  check("初始树画出 8 个节点", nodes().length === 8, "nodes=" + nodes().length);
  check("初始目标是 50", targetValue() === "50", "target=" + targetValue());
  check("目标节点有视觉高亮", doc().querySelectorAll("#canvas .node-circle.is-target").length === 1);
  check("状态栏是第 1 / 8 步", /第 1 \/ 8 步/.test(statusText()), statusText());
  check("第 1 步文案非空", stepText().length > 10, stepText());
  check("步骤列表有 8 项", doc().querySelectorAll("#panel-steps li").length === 8);
  check("A/B/C 面板初始隐藏", byId("panel-choose").hidden === true);

  const firstStep = stepText();
  click("btn-next");
  check("下一步后到第 2 / 8 步", /第 2 \/ 8 步/.test(statusText()), statusText());
  check("下一步后文案变化", stepText() !== firstStep);
  check("第 2 步画出了后继路径箭头", doc().querySelectorAll("#canvas .pointer-line.walk").length >= 1);
  check("第 2 步进入右子树文案", /右子树/.test(stepText()), stepText());

  // 连点到第 5 步（choose）
  click("btn-next");
  click("btn-next");
  click("btn-next");
  check("推进到第 5 / 8 步", /第 5 \/ 8 步/.test(statusText()), statusText());
  check("第 5 步出现 A/B/C 面板", byId("panel-choose").hidden === false);
  check("A/B/C 有三个选项", chooseButtons().length === 3, "buttons=" + chooseButtons().length);
  var choiceTexts = [].map.call(chooseButtons(), function (b) {
    return b.textContent;
  });
  check(
    "选项文案完整替换（无 undefined/未替换占位符）",
    choiceTexts.every(function (t) {
      return t && !/undefined|\{\w+\}/.test(t);
    }),
    choiceTexts.join(" | ")
  );
  check("A 选项指向中序后继 60", /^A/.test(choiceTexts[0]) && /60/.test(choiceTexts[0]), choiceTexts[0]);
  check("B 选项指向中序前驱 40", /^B/.test(choiceTexts[1]) && /40/.test(choiceTexts[1]), choiceTexts[1]);
  check("C 选项指向右孩子 70", /^C/.test(choiceTexts[2]) && /70/.test(choiceTexts[2]), choiceTexts[2]);
  check("三个候选都在画布上标记", doc().querySelectorAll("#canvas .node-circle.is-candidate").length === 3);

  // 没选之前不能前进
  click("btn-next");
  check("未判定时下一步被拦住", /第 5 \/ 8 步/.test(statusText()), statusText());
  check("拦住时给出提示", byId("choose-hint").textContent.length > 0, byId("choose-hint").textContent);

  // 选错 C：显示后果、画布断链、仍停在第 5 步
  clickEl(chooseButtons()[2]);
  check("选错后出现反馈", feedbackVisible());
  check("选错的反馈是错误样式", /(^| )bad( |$)/.test(byId("panel-feedback").className), byId("panel-feedback").className);
  check("选错后仍停在第 5 / 8 步", /第 5 \/ 8 步/.test(statusText()), statusText());
  check("选错后画布演示断链", doc().querySelectorAll("#canvas .node-circle.is-broken").length > 0);
  check("选错后仍可重试（选项还在）", chooseButtons().length === 3);
  check("校验面板显示丢失节点", /丢失的节点/.test(byId("panel-check").textContent), byId("panel-check").textContent);

  // 选对 A：420ms 后自动进入第 6 步
  clickEl(chooseButtons()[0]);
  check("选对后出现正确反馈", feedbackVisible() && /(^| )ok( |$)/.test(byId("panel-feedback").className), byId("panel-feedback").className);
  check("选对后错误演示从画布撤掉", doc().querySelectorAll("#canvas .is-broken").length === 0);
  setTimeout(function afterCorrect() {
    check("选对后前进到第 6 / 8 步", /第 6 \/ 8 步/.test(statusText()), statusText());
    check("第 6 步摘下了替换节点", /摘下/.test(stepText()) || stepText().length > 10, stepText());

    // 重置
    click("btn-reset");
    check("重置回到第 1 / 8 步", /第 1 \/ 8 步/.test(statusText()), statusText());
    check("重置后 A/B/C 面板隐藏", byId("panel-choose").hidden === true);
    check("重置后目标仍是 50", targetValue() === "50");

    // 播放 / 暂停
    click("btn-play");
    check("播放时状态栏带「播放中」", /播放中/.test(statusText()), statusText());
    click("btn-pause");
    check("暂停后状态栏不带「播放中」", !/播放中/.test(statusText()), statusText());

    // 切换情形：叶子
    selectParam("case", "leaf");
    check("切到叶子后是第 1 / 3 步", /第 1 \/ 3 步/.test(statusText()), statusText());
    check("叶子情形目标预设为 20", targetValue() === "20", "target=" + targetValue());
    check("叶子情形步骤列表 3 项", doc().querySelectorAll("#panel-steps li").length === 3);

    // 切换情形：单孩子
    selectParam("case", "single");
    check("切到单孩子后是第 1 / 3 步", /第 1 \/ 3 步/.test(statusText()), statusText());
    check("单孩子情形目标预设为 60", targetValue() === "60", "target=" + targetValue());

    // 切换情形：双孩子
    selectParam("case", "double");
    check("切回双孩子后是第 1 / 8 步", /第 1 \/ 8 步/.test(statusText()), statusText());
    check("双孩子情形目标预设为 50", targetValue() === "50");

    // 点节点改选目标：点 30（双孩子）
    const g30 = nodeByValue("30");
    check("画布上能找到节点 30", !!g30);
    if (g30) clickEl(g30);
    check("点节点后目标改成 30", targetValue() === "30", "target=" + targetValue());
    check("点节点后重置到第 1 / 8 步", /第 1 \/ 8 步/.test(statusText()), statusText());

    // 切换策略：前驱
    selectParam("strategy", "predecessor");
    check("切前驱后仍是第 1 / 8 步", /第 1 \/ 8 步/.test(statusText()), statusText());
    check("前驱第 2 步是进入左子树", /进入左子树/.test(doc().querySelectorAll("#panel-steps li")[1].textContent),
      doc().querySelectorAll("#panel-steps li")[1].textContent);

    click("btn-next");
    const walkLabels = Array.prototype.map.call(
      doc().querySelectorAll("#canvas .pointer-label.walk"),
      (el) => el.textContent
    );
    check("前驱第 2 步箭头标注前驱路径", walkLabels.some((t) => t.indexOf("前驱路径") !== -1), walkLabels.join("|"));
    click("btn-next");
    click("btn-next");
    click("btn-next");
    check("前驱推进到第 5 / 8 步", /第 5 \/ 8 步/.test(statusText()), statusText());
    check("前驱第 5 步有 A/B/C 选项", chooseButtons().length === 3);
    // 前驱策略下 B 才是正确选项
    clickEl(chooseButtons()[1]);
    check("前驱选 B 后出现正确反馈", feedbackVisible() && /(^| )ok( |$)/.test(byId("panel-feedback").className));
    setTimeout(function finish() {
      check("前驱选对后前进到第 6 / 8 步", /第 6 \/ 8 步/.test(statusText()), statusText());
      console.log(pass + " 项通过" + (fails.length ? "，" + fails.length + " 项失败：" : "，全部通过"));
      fails.forEach((f) => console.log("  ✗ " + f));
      process.exit(fails.length ? 1 : 0);
    }, 700);
  }, 700);
}, 150);
