/**
 * d2.js —— 难点 2：删除双孩子节点（步进推演型 + 一次操作判定）
 *
 * 第 9 周：只做到"读 JSON、按步骤渲染、播放控件可用"的骨架。
 * 第 13—14 周要补：候选 A/B/C 的判定逻辑、摘挂指针的改动与高亮、反例演示。
 */
(function (global) {
  "use strict";

  var App = global.App;

  function mount() {
    var stepBox = document.getElementById("panel-step");
    var listBox = document.getElementById("panel-steps");
    var statusEl = document.getElementById("status");

    App.loadJSON("../data/d2.json")
      .then(function (data) {
        document.getElementById("page-title").textContent = data.title;
        document.getElementById("page-subtitle").textContent = data.subtitle;
        document.getElementById("page-howto").textContent = data.howToUse;
        document.getElementById("page-status").textContent = data.status;

        App.clear(listBox);
        data.steps.forEach(function (s) {
          listBox.appendChild(App.el("li", { text: s.title + "：" + s.text }));
        });

        var playback = new App.Playback({
          onRender: function (step) {
            stepBox.textContent = step ? step.title + " —— " + step.text : "点「下一步」开始。";
          },
          onState: function (i, total, playing) {
            statusEl.textContent = "第 " + (i + 1) + " / " + total + " 步" + (playing ? " · 播放中" : "");
          },
        });
        playback.setSteps(data.steps);

        document.getElementById("btn-play").addEventListener("click", function () {
          playback.play();
        });
        document.getElementById("btn-pause").addEventListener("click", function () {
          playback.pause();
        });
        document.getElementById("btn-next").addEventListener("click", function () {
          playback.next();
        });
        document.getElementById("btn-prev").addEventListener("click", function () {
          playback.prev();
        });
        document.getElementById("btn-reset").addEventListener("click", function () {
          playback.reset();
        });
      })
      .catch(function (err) {
        App.showError(stepBox, err);
      });
  }

  global.D2 = { mount: mount };
})(typeof window !== "undefined" ? window : globalThis);
