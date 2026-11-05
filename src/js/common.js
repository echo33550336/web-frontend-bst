/**
 * common.js —— 三个难点共用的外壳
 * 只放三样东西：数据加载、播放控件、SVG 小工具。
 * 这里不允许出现任何一个难点专属的交互逻辑（难点逻辑在 d1.js / d2.js / d3.js）。
 */
(function (global) {
  "use strict";

  /** 读取 data/ 下的 JSON。所有知识内容都必须从这里来，页面里不写死文案。 */
  async function loadJSON(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error("载入 " + path + " 失败：" + res.status);
    return res.json();
  }

  /** 极简 DOM 构造器 */
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  /** SVG 元素必须用命名空间创建，否则浏览器不认 */
  function svg(tag, attrs) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        node.setAttribute(k, attrs[k]);
      });
    }
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  /** 把 "区间从 {from} 变成 {to}" 这类模板填成真实文字 */
  function format(template, vars) {
    return String(template).replace(/\{(\w+)\}/g, function (m, key) {
      return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : m;
    });
  }

  /**
   * 播放控件：播放 / 暂停 / 单步前进 / 单步后退 / 重置 / 调速。
   * 三个页面共用同一个实现，但每一步"画什么"由各页自己决定。
   */
  function Playback(opts) {
    opts = opts || {};
    this.steps = [];
    this.index = 0;
    this.speed = 1;
    this.timer = null;
    this.onRender = opts.onRender || function () {};
    this.onState = opts.onState || function () {};
  }

  /**
   * 换一套步骤。silent = true 时只登记、不渲染 ——
   * 用于"拖动滑块实时预览"这种场景：预览由页面自己画，不该被第 1 步覆盖掉。
   */
  Playback.prototype.setSteps = function (steps, silent) {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.steps = steps || [];
    this.index = 0;
    if (!silent) this.emit();
  };

  Playback.prototype.current = function () {
    return this.steps[this.index] || null;
  };

  Playback.prototype.playing = function () {
    return this.timer !== null;
  };

  Playback.prototype.emit = function () {
    this.onRender(this.current(), this.index);
    this.onState(this.index, this.steps.length, this.playing());
  };

  Playback.prototype.next = function () {
    if (this.index < this.steps.length - 1) {
      this.index += 1;
      this.emit();
      return true;
    }
    this.pause();
    this.emit();
    return false;
  };

  Playback.prototype.prev = function () {
    if (this.index > 0) {
      this.index -= 1;
      this.emit();
      return true;
    }
    return false;
  };

  Playback.prototype.play = function () {
    const self = this;
    if (this.playing() || this.steps.length === 0) return;
    if (this.index >= this.steps.length - 1) this.reset();
    this.timer = setInterval(function () {
      if (!self.next()) self.pause();
    }, 900 / this.speed);
    this.emit();
  };

  Playback.prototype.pause = function () {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.emit();
  };

  Playback.prototype.reset = function () {
    this.pause();
    this.index = 0;
    this.emit();
  };

  Playback.prototype.goto = function (i) {
    if (i < 0 || i >= this.steps.length) return;
    this.index = i;
    this.emit();
  };

  Playback.prototype.setSpeed = function (x) {
    this.speed = Math.max(0.25, Number(x) || 1);
    if (this.playing()) {
      this.pause();
      this.play();
    }
  };

  /** 三个页面共用的错误提示：JSON 加载失败时不要把页面卡死 */
  function showError(node, err) {
    if (!node) return;
    clear(node);
    node.appendChild(el("p", { class: "error", text: "出错了：" + (err && err.message ? err.message : err) }));
    node.appendChild(
      el("p", {
        class: "hint",
        text: "如果是直接双击打开的网页，浏览器会拦截 fetch。请用本地服务器启动：python -m http.server 8000",
      })
    );
  }

  global.App = {
    loadJSON: loadJSON,
    el: el,
    svg: svg,
    clear: clear,
    format: format,
    Playback: Playback,
    showError: showError,
  };
})(typeof window !== "undefined" ? window : globalThis);
