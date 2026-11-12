/**
 * d2.test.js —— 难点 2 纯函数的回归测试
 * 运行：node test/d2.test.js
 *
 * 重点验证 planDeletion() 的「步骤序列」与「每一步的快照树」：
 * 画面可以重画，但只要步骤 key、快照中序、最终树这三样是对的，
 * 页面上「上一步 / 重置 / 跳步」就不会露出破绽。
 */
"use strict";

const D2 = require("../src/js/d2.js");
const Tree = require("../src/js/tree.js");

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

const INITIAL = [50, 30, 70, 20, 40, 60, 80, 65];
const FINAL = [20, 30, 40, 60, 65, 70, 80];

function keysOf(plan) {
  return plan.steps.map((s) => s.key);
}

function inorderOf(root) {
  return Tree.inorder(root);
}

/* 1. 三种情形识别：0 / 1 / 2 个孩子 */
eq("叶子情形", D2.caseOf(INITIAL, 20), "leaf");
eq("单孩子情形", D2.caseOf(INITIAL, 60), "single");
eq("双孩子情形", D2.caseOf(INITIAL, 50), "double");
eq("目标不存在", D2.caseOf(INITIAL, 999), null);
eq("普通叶子 65", D2.caseOf(INITIAL, 65), "leaf");
eq("内部双孩子 30", D2.caseOf(INITIAL, 30), "double");
eq("计划不接受不存在的目标", D2.planDeletion(INITIAL, 999, "successor"), null);

/* 2. 叶子：pick → detachLeaf → verify */
const leaf = D2.planDeletion(INITIAL, 20, "successor");
eq("叶子情形", leaf.case, "leaf");
eq("叶子步骤", keysOf(leaf), ["pick", "detachLeaf", "verify"]);
eq("叶子最终中序", leaf.finalInorder, [30, 40, 50, 60, 65, 70, 80]);
check("叶子最终树不含 20", leaf.finalInorder.indexOf(20) === -1);
check("叶子最终树仍是 BST", D2.isBST(leaf.finalRoot));
eq(
  "叶子最终树与 Tree.removeNode 一致",
  JSON.stringify(leaf.finalRoot),
  JSON.stringify(Tree.removeNode(Tree.buildTree(INITIAL), 20).root)
);

/* 3. 单孩子：pick → attachOnlyChild → verify */
const single = D2.planDeletion(INITIAL, 60, "successor");
eq("单孩子情形", single.case, "single");
eq("单孩子步骤", keysOf(single), ["pick", "attachOnlyChild", "verify"]);
eq("单孩子最终中序", single.finalInorder, [20, 30, 40, 50, 65, 70, 80]);
check("单孩子最终树不含 60", single.finalInorder.indexOf(60) === -1);
check("单孩子最终树仍是 BST", D2.isBST(single.finalRoot));
eq(
  "单孩子最终树与 Tree.removeNode 一致",
  JSON.stringify(single.finalRoot),
  JSON.stringify(Tree.removeNode(Tree.buildTree(INITIAL), 60).root)
);

/* 4. 双孩子（中序后继）：8 步序列 */
const succ = D2.planDeletion(INITIAL, 50, "successor");
eq("后继情形", succ.case, "double");
eq("后继 8 步", keysOf(succ), [
  "pick",
  "enterRight",
  "walkLeft",
  "found",
  "choose",
  "detach",
  "attach",
  "verify",
]);
eq("后继节点", succ.successor, 60);
eq("前驱节点", succ.predecessor, 40);
eq("后继策略答案", succ.choose.answer, "A");
eq("后继策略错误答案", succ.choose.wrongKey, "B");
eq(
  "后继策略三个选项角色",
  succ.choose.options.map((o) => o.role),
  ["successor", "predecessor", "child"]
);
eq(
  "后继策略三个选项值",
  succ.choose.options.map((o) => o.value),
  [60, 40, 70]
);
eq("后继最终中序", succ.finalInorder, FINAL);
check("后继最终树不含 50", succ.finalInorder.indexOf(50) === -1);
check("后继最终树仍是 BST", D2.isBST(succ.finalRoot));
eq(
  "后继最终树与 Tree.removeNode 一致",
  JSON.stringify(succ.finalRoot),
  JSON.stringify(Tree.removeNode(Tree.buildTree(INITIAL), 50).root)
);

/* 5. 双孩子（中序前驱）：8 步序列，walk 方向相反 */
const pred = D2.planDeletion(INITIAL, 50, "predecessor");
eq("前驱 8 步", keysOf(pred), [
  "pick",
  "enterLeft",
  "walkRight",
  "found",
  "choose",
  "detach",
  "attach",
  "verify",
]);
eq("前驱策略答案", pred.choose.answer, "B");
eq("前驱策略错误答案", pred.choose.wrongKey, "A");
eq(
  "前驱策略三个选项值",
  pred.choose.options.map((o) => o.value),
  [60, 40, 30]
);
eq("前驱最终中序", pred.finalInorder, FINAL);
check("前驱最终树仍是 BST", D2.isBST(pred.finalRoot));
eq(
  "前驱删除与 removeByStrategy 一致",
  JSON.stringify(pred.finalRoot),
  JSON.stringify(D2.removeByStrategy(Tree.buildTree(INITIAL), 50, "predecessor"))
);
eq(
  "前驱删除的最终中序与 Tree.removeNode 相同",
  pred.finalInorder,
  Tree.inorder(Tree.removeNode(Tree.buildTree(INITIAL), 50).root)
);

/* 6. 每一步快照都必须是合法的 BST，且步骤/快照元信息自洽 */
[leaf, single, succ, pred].forEach((plan) => {
  const label = plan.case + "/" + plan.strategy;
  plan.steps.forEach((step, i) => {
    eq(label + " 第 " + (i + 1) + " 步 index", step.index, i);
    eq(label + " 第 " + (i + 1) + " 步 snapshot.key", step.snapshot.key, step.key);
    eq(label + " 第 " + (i + 1) + " 步 case", step.snapshot.case, plan.case);
    check(label + " 第 " + (i + 1) + " 步中序递增", D2.isSorted(step.snapshot.inorder), step.snapshot.inorder.join(","));
    check(label + " 第 " + (i + 1) + " 步区间成立", step.snapshot.intervalOk, step.snapshot.inorder.join(","));
    check(label + " 第 " + (i + 1) + " 步树是 BST", D2.isBST(step.snapshot.root));
  });
});

/* 7. 快照互不污染：第 0 步的树始终是初始树，且不是同一个对象 */
eq("第 1 步快照是初始中序", succ.steps[0].snapshot.inorder, [20, 30, 40, 50, 60, 65, 70, 80]);
check("第 1、2 步快照不是同一棵树", succ.steps[0].snapshot.root !== succ.steps[1].snapshot.root);
eq(
  "第 1 步快照结构冻结",
  JSON.stringify(succ.steps[0].snapshot.root),
  JSON.stringify(succ.initialRoot)
);

/* 8. 确定性：同样的输入两次生成完全一样的结果 */
eq(
  "后继计划可重复",
  JSON.stringify(D2.planDeletion(INITIAL, 50, "successor")),
  JSON.stringify(D2.planDeletion(INITIAL, 50, "successor"))
);
eq(
  "前驱计划可重复",
  JSON.stringify(D2.planDeletion(INITIAL, 50, "predecessor")),
  JSON.stringify(D2.planDeletion(INITIAL, 50, "predecessor"))
);

/* 9. 错误选项 C 的演示：另一侧子树整块断链、节点丢失 */
check("后继 C 是断链演示", succ.wrongDemos.C.kind === "broken");
eq("后继 C 可达中序", succ.wrongDemos.C.reachableInorder, [60, 65, 70, 80]);
eq("后继 C 丢失节点", succ.wrongDemos.C.lostValues, [20, 30, 40, 50]);
check("后继 C 丢失节点非空", succ.wrongDemos.C.lostValues.length > 0);
check("前驱 C 是断链演示", pred.wrongDemos.C.kind === "broken");
eq("前驱 C 可达中序", pred.wrongDemos.C.reachableInorder, [20, 30, 40]);
eq("前驱 C 丢失节点", pred.wrongDemos.C.lostValues, [50, 60, 65, 70, 80]);

/* C 的断链演示在非根目标上也要准确：只把目标在父指针里换成孩子，
   另一侧子树原样留在画布外侧，可达的中序必须是「剩下的那部分树」。 */
const c30 = D2.planDeletion(INITIAL, 30, "successor").wrongDemos.C;
eq("非根后继 C 可达中序", c30.reachableInorder, [40, 50, 60, 65, 70, 80]);
eq("非根后继 C 丢失节点", c30.lostValues, [20, 30]);
eq("非根后继 C 的断链子树", c30.orphanRootValue, 20);
check("非根后继 C 的残树仍有序", D2.isSorted(c30.reachableInorder));
const c70 = D2.planDeletion(INITIAL, 70, "predecessor").wrongDemos.C;
eq("非根前驱 C 可达中序", c70.reachableInorder, [20, 30, 40, 50, 60, 65]);
eq("非根前驱 C 丢失节点", c70.lostValues, [70, 80]);
eq("非根前驱 C 的断链子树", c70.orphanRootValue, 80);

/* 10. 选错「另一种也成立」的方案：中序仍然有序，只是不符合当前策略 */
check("后继策略选 B 是方案不符", succ.wrongDemos.B.kind === "wrong-strategy");
eq("后继策略的对照中序", succ.wrongDemos.B.alternativeInorder, FINAL);
check("对照中序仍然递增", D2.isSorted(succ.wrongDemos.B.alternativeInorder));
check("前驱策略选 A 是方案不符", pred.wrongDemos.A.kind === "wrong-strategy");
eq("前驱策略的对照中序", pred.wrongDemos.A.alternativeInorder, FINAL);

/* 11. 边界：单节点树删根、单孩子树删根、空树判定 */
const onlyRoot = D2.planDeletion([10], 10, "successor");
eq("单节点树情形", onlyRoot.case, "leaf");
eq("单节点树删除后中序", onlyRoot.finalInorder, []);
check("单节点树删除后为空", onlyRoot.finalRoot === null);
eq("空树仍是 BST", D2.isBST(null), true);

const rootSingle = D2.planDeletion([50, 30], 50, "successor");
eq("单孩子删根步骤", keysOf(rootSingle), ["pick", "attachOnlyChild", "verify"]);
eq("单孩子删根最终中序", rootSingle.finalInorder, [30]);
eq("单孩子删根后 30 是根", rootSingle.finalRoot.value, 30);

/* 12. 合法性判断本身：手工构造一棵破坏 BST 的树应被识别 */
const bad = Tree.buildTree([50, 30, 70]);
bad.left.value = 90;
check("isBST 能识别破坏有序性的树", !D2.isBST(bad));
check("isSorted 能识别非严格递增", !D2.isSorted([1, 2, 2, 3]));

/* 13. 全量组合：8 个目标 × 后继/前驱两种策略 */
INITIAL.forEach((target) => {
  ["successor", "predecessor"].forEach((strategy) => {
    const plan = D2.planDeletion(INITIAL, target, strategy);
    const label = "目标 " + target + "/" + strategy;
    const expected = INITIAL.slice().sort((a, b) => a - b).filter((v) => v !== target);
    check(label + " 能生成计划", !!plan);
    if (!plan) return;
    eq(label + " 情形识别", plan.case, D2.caseOf(INITIAL, target));
    eq(label + " 最终中序", plan.finalInorder, expected);
    check(label + " 最终树不含目标", plan.finalInorder.indexOf(target) === -1);
    check(label + " 最终树是 BST", D2.isBST(plan.finalRoot));
    check(
      label + " 每一步都是 BST",
      plan.steps.every((s) => D2.isBST(s.snapshot.root) && D2.isSorted(s.snapshot.inorder))
    );
    eq(label + " 第 1 步是初始中序", plan.steps[0].snapshot.inorder, [20, 30, 40, 50, 60, 65, 70, 80]);
    if (strategy === "successor") {
      eq(
        label + " 最终树与 Tree.removeNode 一致",
        JSON.stringify(plan.finalRoot),
        JSON.stringify(Tree.removeNode(Tree.buildTree(INITIAL), target).root)
      );
    }
    if (plan.case === "double") {
      const demo = plan.wrongDemos.C;
      check(label + " C 演示丢了节点", demo.lostValues.length > 0);
      check(label + " C 演示丢失的节点含目标", demo.lostValues.indexOf(target) !== -1);
      eq(
        label + " C 演示可达 + 丢失 = 原节点",
        demo.reachableInorder.concat(demo.lostValues).sort((a, b) => a - b),
        INITIAL.slice().sort((a, b) => a - b)
      );
      check(label + " C 演示残树仍有序", D2.isSorted(demo.reachableInorder));
      check(
        label + " C 演示孤立子树根不在可达中序里",
        demo.reachableInorder.indexOf(demo.orphanRootValue) === -1
      );
      check(label + " C 演示残树结构合法", D2.isBST(demo.root));
    }
  });
});

/* 14. JSON 文案占位符：每个步骤 / 选项 / 后果里的 {xxx} 都必须由 vars 填上
       （界面上的文案全在 data/d2.json，漏一个就会在页面上露出 {target} 或 undefined） */
const fs = require("fs");
const path = require("path");
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "d2.json"), "utf8"));

function placeholders(template) {
  const out = [];
  String(template || "").replace(/\{(\w+)\}/g, function (m, key) {
    out.push(key);
    return m;
  });
  return out;
}

function missingKeys(template, vars) {
  return placeholders(template).filter(function (key) {
    return typeof vars[key] === "undefined";
  });
}

INITIAL.forEach(function (target) {
  ["successor", "predecessor"].forEach(function (strategy) {
    const plan = D2.planDeletion(INITIAL, target, strategy);
    if (!plan) return;
    plan.steps.forEach(function (step) {
      const tpl = DATA.steps[step.key] || {};
      const vars = D2.textVars(DATA, plan, step);
      const label = "文案 " + target + "/" + strategy + "/" + step.key;
      const missTitle = missingKeys(tpl.title, vars);
      const missText = missingKeys(tpl.text, vars);
      check(label + " 标题占位符齐全", missTitle.length === 0, missTitle.join(","));
      check(label + " 正文占位符齐全", missText.length === 0, missText.join(","));
    });
    const chooseStep = plan.steps.filter(function (s) {
      return s.key === "choose";
    })[0];
    if (!chooseStep) return;
    const chooseVars = D2.textVars(DATA, plan, chooseStep);
    DATA.choose.options.forEach(function (opt) {
      const miss = missingKeys(opt.text, chooseVars);
      check("文案 " + target + "/" + strategy + "/选 " + opt.key + " 占位符齐全", miss.length === 0, miss.join(","));
    });
    const missCorrect = missingKeys(DATA.choose.correct[strategy], chooseVars);
    check("文案 " + target + "/" + strategy + "/正确反馈占位符齐全", missCorrect.length === 0, missCorrect.join(","));
    const consequence = DATA.choose.consequences[strategy][plan.choose.wrongKey];
    const withLost = Object.assign({}, chooseVars, { lostText: "" });
    const missCons = missingKeys(consequence, withLost);
    check("文案 " + target + "/" + strategy + "/错误后果占位符齐全", missCons.length === 0, missCons.join(","));
  });
});

console.log(pass + " 项通过" + (fails.length ? "，" + fails.length + " 项失败：" : "，全部通过"));
fails.forEach((f) => console.log("  ✗ " + f));
process.exit(fails.length ? 1 : 0);
