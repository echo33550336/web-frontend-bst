# 二叉搜索树：有序性是怎么被维护的

> Web 前端开发课程项目 · 个人项目 · 第 9—16 周
> 仓库：https://gitee.com/AzureHyu/web-frontend-bst ｜ 在线访问（Gitee Pages）：https://azurehyu.gitee.io/web-frontend-bst/ —— 需先在仓库网页端开通 Pages，当前尚未开通，直接访问会 404；本地入口见「怎么跑起来」。

三个难点，三种交互，串成一条学习路径：

| 页面 | 难点 | 交互类型 |
| --- | --- | --- |
| `src/d1.html` | 插入时的比较路径 | 参数探索型（拖滑块，路径与区间实时重算） |
| `src/d2.html` | 删除双孩子节点为何用中序后继替换 | 步进推演型（第 5 步内嵌一次 A/B/C 操作判定） |
| `src/d3.html` | 插入顺序如何导致树退化 | 对照比较型（双画布同步插入 + 折线与统计读数） |

## 怎么跑起来

不能直接双击打开（浏览器会拦截 `fetch` 读取 `data/*.json`）。在仓库根目录起一个静态服务器：

```bash
npm run serve                 # 推荐：零依赖 Node 服务器（node tools/serve.js）
# 或者：
python -m http.server 8000    # 等价于 npm run serve:py
# 然后访问 http://localhost:8000/src/index.html
```

`tools/serve.js` 只做三件事：按路径读文件、给正确的 MIME、把 `/` 指到 `src/index.html`；不依赖任何 npm 包，也不需要构建。

## 部署到 Gitee Pages

站点是纯静态文件（HTML/CSS/JS/JSON），没有构建步骤，Pages 根目录直接指向仓库根即可：

1. 把 `master` 分支推到 Gitee（仓库地址见文首）。
2. 打开仓库网页 →「服务」→「Gitee Pages」。
3. 部署分支选 `master`，部署目录留空（根目录）；如页面要求实名认证，先完成认证。
4. 部署成功后入口是 `https://azurehyu.gitee.io/web-frontend-bst/`：根目录 `index.html` 会自动跳转到 `src/index.html`；也可以直接访问 `.../src/index.html`。
5. 之后每次更新代码，需要在 Pages 页面点一次「更新」才会重新发布。

> 注意：Gitee Pages 需要在网页端手动开通/更新，`git push` 本身不会触发部署；Gitee Pages 不涉及 Jekyll 构建，纯静态文件直接发布。

## 目录结构

```
web-frontend-bst/
├─ README.md
├─ index.html              根目录跳转页：GitHub/Gitee Pages 入口，自动进 src/index.html
├─ docs/
│  ├─ 开题说明.md          三个难点 + 三种交互 + 迭代计划
│  ├─ 选题自检.md          七问自查表
│  ├─ iteration-1.md       迭代进展报告 ①（第 12 周）
│  ├─ iteration-2.md       迭代进展报告 ②（第 14 周收尾 + 第 15—16 周记录）
│  ├─ 期末报告.md          项目概述、实现、测试、AI 使用与不足
│  ├─ 演示脚本.md          4—5 分钟演示分镜与备用方案
│  └─ img/                  截图与 Lighthouse 报告（home/d1/d2/d3、移动端与折线）
├─ tools/
│  ├─ serve.js             零依赖静态服务器（npm run serve）
│  └─ bench.js              Node 基准脚本（npm run bench）
├─ src/
│  ├─ index.html           首页：三个难点的入口 + 学习进度
│  ├─ d1.html / d2.html / d3.html
│  ├─ css/style.css
│  └─ js/
│     ├─ common.js         共用外壳：JSON 加载、播放控件、学习进度
│     ├─ tree.js           共用树模块：BST 纯函数 + 布局 + SVG 渲染
│     ├─ d1.js             难点 1：参数驱动的插入路径探索
│     ├─ d2.js             难点 2：删除三情形快照推演 + A/B/C 判定
│     └─ d3.js             难点 3：双画布同步插入 + 折线与统计
├─ data/
│  ├─ d1.json              难点 1 的讲解文字与步骤模板
│  ├─ d2.json              难点 2 的三情形、八步文案与 A/B/C 选项
│  └─ d3.json              难点 3 的参数、折线、读数与结论
├─ test/                   Node 下的纯函数测试 + jsdom 页面冒烟测试
│  ├─ d1.test.js / d2.test.js / d3.test.js
│  ├─ tree.test.js
│  └─ mount*.smoke.js
└─ assets/
```

## 三条设计约束

1. **知识内容与代码分离**：所有讲解文字、步骤说明、参数定义、A/B/C 选项、结论模板都在 `data/*.json`。改文案只改 JSON，不碰 JS。
2. **三个难点的交互互相独立**：`d1.js` / `d2.js` / `d3.js` 各自负责一页；只共用 `common.js`（JSON 加载、播放控件、学习进度）、`tree.js`（BST 纯函数、布局、渲染器）与 `style.css`（共享版式；每页另有少量页内样式），改一页不影响另外两页。
3. **无构建、零运行时依赖**：原生 ES5 + SVG + `fetch`，`tools/serve.js` 也是零依赖的；克隆后 `npm install` 只装测试用的 jsdom。

## 当前进度（第 12—16 周）

- [x] 开题说明、七问自查
- [x] 仓库骨架、数据分离（`data/*.json` 已可被读取渲染）
- [x] 共用树模块 `tree.js`：插入/删除/查找/区间/布局/渲染，全部纯函数
- [x] 难点 1：树渲染、区间标注、候选位置计数、播放控件、过渡动画与响应式
- [x] 难点 2：叶子 / 单孩子 / 双孩子三种删除情形，八步推演，A/B/C 判定（选错演示断链与丢节点）、指针高亮、快照式前进/后退/重置
- [x] 难点 3：双画布同步插入、规模与有序程度双滑块、树高/平均/最坏查找步数、折线对比、结论
- [x] 学习进度持久化（localStorage，首页显示已探索的难点）
- [x] 三页串成一条学习路径的期末演示脚本（`docs/演示脚本.md`，含分镜与备用方案）与期末报告（`docs/期末报告.md`）
- [x] 折线读数切换（树高 / 平均查找步数 / 最坏查找步数，仍由 JSON 配置）
- [x] Lighthouse 体检（移动模拟）：首页 100/100/100/100（CLS 0，FCP/LCP 0.9s），d1 99/100/100/100（CLS 0.063），d2 97/100/100/100（CLS 0.107），d3 99/100/100/100（CLS 0.05）；报告在 `docs/img/lh-*.report.json`，截图在 `docs/img/`
- [ ] 部署到 Gitee Pages（操作步骤已写入上节，需在仓库网页端手动开通/更新；当前尚未开通，线上地址暂为 404）

站点体积约 172 KiB（`src/` 156.4 KB + `data/` 19.9 KB），无构建、无运行时依赖。`npm run bench` 可复现关键路径的 Node 基准（最慢项为 2000 次树查找合计约 0.98 ms，远低于一帧 16.7 ms）。

## 测试

`test/` 下分两层：纯函数测试在 Node 里直接跑，页面测试用 jsdom 加载真实 HTML 并断言 DOM。先装测试依赖（仓库同时提供 `pnpm-lock.yaml`，用 npm 或 pnpm 均可）：

```bash
npm install     # 或 pnpm install（pnpm-lock.yaml 已提交；本机没装 pnpm 时用 npm）
npm test        # d1 / tree / d2 / d3 的纯函数测试：14 + 28 + 549 + 154 项
npm run smoke   # 三个页面的 jsdom 冒烟测试：28 + 80 + 131 项
npm run test:all
npm run bench   # 可选：Node 基准，输出关键路径耗时
```

## 期末材料

- 期末报告：`docs/期末报告.md`（含测试计数、Lighthouse 结果与截图索引）
- 演示脚本（4—5 分钟）：`docs/演示脚本.md`
- 迭代报告：`docs/iteration-1.md`、`docs/iteration-2.md`
- 截图与 Lighthouse 报告：`docs/img/`
- 部署入口：`https://azurehyu.gitee.io/web-frontend-bst/`（Gitee Pages 开通后生效，当前尚未开通）
- 演示视频：待录制（按 `docs/演示脚本.md` 的分镜；沙箱内无录屏能力，需在有图形界面的环境完成）

也可以单独跑，例如：

```bash
node test/d1.test.js
node test/mount-d2.smoke.js
```
