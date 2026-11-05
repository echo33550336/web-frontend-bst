/**
 * d3.js —— 难点 3：插入顺序与树退化（对照比较型）
 *
 * 第 9 周：骨架。读 JSON、渲染参数与读数占位、播放控件可用。
 * 第 13—14 周要补：同一批数据的两种插入顺序、双画布同步推进、树高/平均步数实时计算与折线。
 */
(function (global) {
  "use strict";

  var App = global.App;

  function mount() {
    var paramsBox = document.getElementById("params");
    var metricsBox = document.getElementById("metrics");
    var stepBox = document.getElementById("panel-step");
    var statusEl = document.getElementById("status");

    App.loadJSON("../data/d3.json")
      .then(function (data) {
        document.getElementById("page-title").textContent = data.title;
        document.getElementById("page-subtitle").textContent = data.subtitle;
        document.getElementById("page-howto").textContent = data.howToUse;
        document.getElementById("page-status").textContent = data.status;

        // 参数区（从 JSON 渲染，改文案不用碰 JS）
        App.clear(paramsBox);
        data.params.forEach(function (p, i) {
          var row = App.el("div", { class: "param" });
          var label = App.el("label", { text: p.label, for: "param-" + p.key });
          if (p.type === "select") {
            var select = App.el("select", { id: "param-" + p.key });
            (p.options || []).forEach(function (o) {
              var opt = App.el("option", { value: o, text: o });
              if (o === p.default) opt.selected = true;
              select.appendChild(opt);
            });
            row.appendChild(label);
            row.appendChild(select);
          } else {
            var input = App.el("input", {
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
            });
            row.appendChild(label);
            row.appendChild(input);
            row.appendChild(readout);
          }
          if (p.note) row.appendChild(App.el("p", { class: "hint", text: p.note }));
          paramsBox.appendChild(row);
        });

        // 读数占位
        App.clear(metricsBox);
        data.metrics.forEach(function (m) {
          var card = App.el("div", { class: "metric" }, [
            App.el("span", { class: "metric-label", text: m.label }),
            App.el("span", { class: "metric-value", text: "—" }),
            App.el("span", { class: "metric-unit", text: m.unit }),
          ]);
          metricsBox.appendChild(card);
        });

        document.getElementById("canvas-left").setAttribute("viewBox", "0 0 360 260");
        document.getElementById("canvas-right").setAttribute("viewBox", "0 0 360 260");

        stepBox.textContent = data.status;
      })
      .catch(function (err) {
        App.showError(stepBox, err);
      });
  }

  global.D3 = { mount: mount };
})(typeof window !== "undefined" ? window : globalThis);
