# matrix/ —— 暗色极光主题（对照皮肤）

这是课程项目的**另一套视觉设计**，用于演示「同一份交互、不同视觉语言」的对照版本。
正式版本仍在仓库根目录的 `src/`，本目录不会替换、也不会被正式页面引用。

## 预览

```bash
node tools/serve.js 8000
# 打开 http://127.0.0.1:8000/matrix/index.html
```

`matrix/` 是**自包含**的：`css/`、`js/`、`data/` 都是 `src/` 与仓库 `data/` 的副本，
所以把 `matrix/` 单独部署（或直接把它的目录作为站点根目录）也能运行，页面仍需要 HTTP 访问，双击 HTML 不行。

预览截图见 `matrix/img/`：`index.png`、`d1.png`、`d2.png`、`d3.png`；
交互态还有 `d2-choose.png`（A/B/C 判定）、`d3-step10.png`、`d3-final.png`。

## 设计要点

- 近黑绿底（`#070f0b`）+ 中性玻璃卡片，主色收敛为低饱和薄荷绿（`--accent: #49dc9b`），
  绿色主要出现在数据可视化、主按钮和焦点态，避免整页霓虹。
- 背景是一层**纯 CSS 的动态极光**：4 条大尺寸模糊色带（薄荷 / 青 / 蓝紫 / 暖金），
  以 20–31 秒的周期漂移、旋转和缩放，并整体做 36 秒的色相往返；叠加缓慢漂移的细网格与顶部暗角，
  营造类似 codepen.io 首页的动态底纹。
- 卡片使用半透明渐变 + `backdrop-filter` 磨砂、1px 低对比描边和柔和投影；
  按钮、下拉框、区间条、步骤列表统一为 8–12px 圆角和克制的 hover 过渡；顶栏/页脚链接的点击区域不小于 24px。
- 三个难点的语义颜色沿用正式版：路径/后继 = 亮绿，新节点 = 青色，错误/断链 = 珊瑚红，
  候选项 A/B/C = 薄荷绿 / 紫 / 珊瑚红；d3 左树与左折线统一青色，右树与右折线亮绿。
- 尊重 `prefers-reduced-motion`：开启减少动态时，极光、入场与转场动画全部停止。
- 转场：页面间使用 View Transitions（淡出上移 / 淡入上浮），页面内 `.wrap` 与卡片有依次入场动画，步骤文字变化时由 `transition.js` 触发一次 300ms 的淡入上浮。\n- 参考 awwwards / 21st.dev / onepagelove / siteinspire 等站点加入：英雄区局部光晕、放大主标题、画布「浮窗」化（顶部三色圆点 + 发丝线）、首页 bento 不对称卡片、细颗粒质感、卡片 hover 上浮、顶部阅读进度，以及画布内的跟随光斑（`effects.js`，仅在桌面且未开启减少动态时启用）。

## 与正式版的差别（只有视觉层）

| 项目 | 正式版 `src/` | 本目录 `matrix/` |
| --- | --- | --- |
| 结构 / DOM | 同一套页面结构 | 复制后仅增加装饰层 `<div class="aurora">` |
| 交互 / 数据 | `src/js/*` + `data/*.json` | 独立副本 `matrix/js/*` + `matrix/data/*`（加载路径已改为 `data/…`） |
| 公共样式 | `src/css/style.css` | 独立副本 `matrix/css/style.css`，再由 `matrix.css` 覆盖配色/字体/边框/阴影 |
| 背景 | 浅色纸面 | 纯 CSS 极光色带 + 漂移网格 + 顶部暗角 |

因此本目录的文件是：

```
matrix/
  index.html   d1.html   d2.html   d3.html    ← 由 src/ 复制并替换资源路径
  matrix.css                                  ← 主题覆盖层（含背景动效与转场）
  transition.js                               ← 步骤文字变化的轻量转场（可选）\n  effects.js                                  ← 阅读进度与画布跟随光斑（装饰，可删除）
  css/style.css                               ← src/css/style.css 的副本
  js/common.js  tree.js  d1.js  d2.js  d3.js  ← src/js/* 的副本
  data/d1.json  d2.json  d3.json              ← 仓库 data/* 的副本
  img/*.png                                   ← 本皮肤的预览截图
  README.md                                   ← 本说明
```

`matrix.css` 只使用选择器覆盖，不改 `src/css/style.css`；背景动效不依赖任何脚本。
如果决定弃用本皮肤，直接删除 `matrix/` 即可，正式版不受影响。
如果正式版的 `src/js` 或 `data` 后续有改动，需要手动同步到 `matrix/` 对应副本。

## 已知取舍

- 极光是 4 个 `filter: blur()` 的大色带，桌面端很轻；低端移动设备上模糊会略耗 GPU，
  已在 `prefers-reduced-motion` 下停用动画。
- 深色主题下截图/打印建议用浅色正式版；正式提交与演示默认仍用 `src/`。



