# 二叉搜索树：有序性是怎么被维护的

> Web 前端开发课程项目 · 个人项目 · 第 9—16 周
> 仓库：https://gitee.com/AzureHyu/web-frontend-bst ｜ 在线访问：https://azurehyu.gitee.io/web-frontend-bst/ （第 16 周上线）

三个难点，三种交互，串成一条学习路径：

| 页面 | 难点 | 交互类型 |
| --- | --- | --- |
| `src/d1.html` | 插入时的比较路径 | 参数探索型（拖滑块，路径与区间实时重算） |
| `src/d2.html` | 删除双孩子节点为何用中序后继替换 | 步进推演型（第 5 步内嵌一次 A/B/C 操作判定） |
| `src/d3.html` | 插入顺序如何导致树退化 | 对照比较型（双画布同步插入 + 折线与统计读数） |

## 怎么跑起来

不能直接双击打开（浏览器会拦截 `fetch` 读取 `data/*.json`）。在仓库根目录起一个静态服务器：

```bash
python -m http.server 8000
# 然后访问 http://localhost:8000/src/index.html
```

部署到 Gitee Pages 后直接访问 `src/index.html` 即可。

## 目录结构

```
web-frontend-bst/
├─ README.md
├─ docs/
│  ├─ 开题说明.md          三个难点 + 三种交互 + 迭代计划
│  ├─ 选题自检.md          七问自查表
│  ├─ iteration-1.md       迭代进展报告 ①（第 12 周）
│  └─ iteration-2.md       迭代进展报告 ②（第 14 周）
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

## 两条设计约束

1. **知识内容与代码分离**：所有讲解文字、步骤说明、参数定义、A/B/C 选项、结论模板都在 `data/*.json`。改文案只改 JSON，不碰 JS。
2. **三个难点的交互互相独立**：`d1.js` / `d2.js` / `d3.js` 各自负责一页；只共用 `common.js`（导航、播放控件、进度）与 `tree.js`（BST 纯函数、布局、渲染器），改一页不影响另外两页。

## 当前进度（第 12—14 周功能已就位）

- [x] 开题说明、七问自查
- [x] 仓库骨架、数据分离（`data/*.json` 已可被读取渲染）
- [x] 共用树模块 `tree.js`：插入/删除/查找/区间/布局/渲染，全部纯函数
- [x] 难点 1：树渲染、区间标注、候选位置计数、播放控件、过渡动画与响应式
- [x] 难点 2：叶子 / 单孩子 / 双孩子三种删除情形，八步推演，A/B/C 判定（选错演示断链与丢节点）、指针高亮、快照式前进/后退/重置
- [x] 难点 3：双画布同步插入、规模与有序程度双滑块、树高/平均/最坏查找步数、折线对比、结论
- [x] 学习进度持久化（localStorage，首页显示已探索的难点）
- [ ] Lighthouse 体检与性能对比截图（第 14 周报告）
- [ ] 部署到 Gitee Pages（第 16 周）
- [ ] 三页串成一条学习路径的期末演示脚本（第 16 周）

## 测试

`test/` 下分两层：纯函数测试在 Node 里直接跑，页面测试用 jsdom 加载真实 HTML 并断言 DOM。先装依赖：

```bash
npm install
npm test        # d1 / tree / d2 / d3 的纯函数测试
npm run smoke   # 三个页面的 jsdom 冒烟测试
npm run test:all
```

也可以单独跑，例如：

```bash
node test/d1.test.js
node test/mount-d2.smoke.js
```
