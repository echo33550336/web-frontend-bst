# matrix/ —— 星际穿越（interstellar skin）

这是课程项目的一套**替代视觉方案**：页面结构、交互和数据与正式版 `src/` 相同，
只把 matrix 目录的视觉语言换成深空、星尘与导航线。正式版 `src/` 不受影响。

## 预览

```bash
node tools/serve.js 8000
# 打开 http://127.0.0.1:8000/matrix/index.html
```

`matrix/` 是自包含的：`css/`、`js/`、`data/` 都是 `src/` 与仓库 `data/` 的副本，
把 `matrix/` 单独作为站点根目录也能运行。页面需要 HTTP 访问，双击 HTML 不行。

## 设计说明

- **Lower 冷紫配色**：深靛底 `#05060f`，正文 `#ece9f7`，次级文字 `#a7a3c4`；
  冷紫 `#b89cff` 用于路径、操作和强调，青蓝 `#8fe3ff` 用于对照序列，粉色 `#ff9ed2`
  只用于新节点与状态点；整体降低光晕强度，只保留星尘和细线。
- **星尘与星系**：`galaxy.js` 在固定画布上画星点、尘埃和两个缓慢自转的旋涡星系：右上是吸积环，左下是正面旋涡；星点会闪烁，鼠标移动有轻微视差，滚动时整体缓慢上移。镜头以外只留暗星，不抢内容。
- **塔罗启幕**：每页载入先出现左右星空幕布与一张塔罗牌；点击/按键/滚轮后牌面 3D 翻开，随后幕布左右拉开。序章为「0 · THE FOOL」，三个难点分别为 I · THE MAGICIAN、XIII · DEATH、XVI · THE TOWER。`?intro=0` 关闭（截图/录屏用）。
- **滚动引导线**：`body.matrix::before` 画 8 条竖向细线，线上每 96px 一个冷紫刻度；
  刻度随页面滚动上下移动（由 `effects.js` 写入 `--scroll-y`，CSS 计算 `background-position`）。
  它只是背景层，不接收鼠标事件，也不遮挡内容。
- **金色描边**：视口一圈双层金线，四角藤蔓式角花，上下中央各一枚菱形饰件；卡片、画布、按钮带内嵌金线与金色细边，标题与页脚有金色饰线。角花与饰件是 `img/corner-gold.svg`、`img/divider-gold.svg`，由 `effects.js` 注入，纯装饰不挡点击。
- **HUD 面板**：画布与侧栏是半透明深色面板 + 1px 细线 + 内嵌细框，没有圆角、阴影和渐变；
  树节点白描边，比较路径青蓝，新节点粉；d3 左树/左折线青蓝、右树/右折线冷紫。
- **字体**：全站宋体（Songti SC / STSong / SimSun），标题 600 字重、字距略宽；
  正文 17px，最小 16px；数字、区间、读数用等宽字体。
- **动效**：塔罗翻牌启幕 + 滚动引导线 + 页面入场；`prefers-reduced-motion` 下停止入场与翻牌动画。

## 文件

```
matrix/
  index.html   d1.html   d2.html   d3.html    ← 页面
  home.css                                    ← 首页版式与入场动效
  matrix.css                                  ← 星际穿越主题与演示页覆盖
  transition.js                               ← 步骤文字的轻量转场
  intro.js                                    ← 舞台幕布启幕
  effects.js                                  ← 滚动变量（--scroll / --scroll-y）与指针光斑
  galaxy.js                                   ← 星尘、旋涡星系与视差动画
  css/style.css                               ← src/css/style.css 的副本
  js/common.js  tree.js  d1.js  d2.js  d3.js  ← src/js/* 的副本
  data/d1.json  d2.json  d3.json              ← 仓库 data/* 的副本
  img/*.png  img/corner-gold.svg  img/divider-gold.svg   ← 预览截图与金色饰件
  README.md
```

如果决定弃用这套皮肤，直接删除 `matrix/` 即可；`src/` 与仓库文档不受影响。

## 预览截图

`img/index.png`（首页）、`img/d1.png`、`img/d2.png`、`img/d3.png`、
`img/d2-choose.png`（判定步）、`img/d3-step10.png`、`img/d3-final.png`、
`img/home-390.png`、`img/d1-390.png`、`img/intro.png`（幕布）。

课程提交与演示默认仍用 `src/`；这套皮肤用于对比和展示另一种设计方向。




