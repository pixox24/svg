# Task: 对抗性评审一次集成改动（只读，不要改任何文件）

## 你的角色
你**不是**实现者。你要**挑毛病**。请抱着"这段代码有问题，我要找出来"的心态逐行读。

## 背景
`/Users/huazi/Desktop/svg` 是一个 SvelteKit（Svelte 3.57 / Vite 4 / adapter-static）的设计工具 "SVG Playground"。
刚把一个**新引擎**接进了它，改动如下（最近两个 commit：`ae63830`、`a9806e5`）：

```bash
git log --oneline -6
git diff ae63830^..HEAD -- src/systems.js src/catalog.js src/routes/+page.svelte src/components/LookPanel.svelte scripts/generate-thumbs.mjs
git show --stat HEAD
```

新引擎在 `src/lib/parametric/`（`index.js` / `schema.js` / `hash.js` / `lattice.js` / `modulator.js` / `primitive.js` / `topology.js` / `compose.js` / `presets.js`）。
架构决策记录在 `docs/parametric-engine/03b-architecture-decision.md`。
验收脚本是 `spike/parametric-accept.mjs`（当前 16/16 通过）。

## 关键设计契约（判断改动的依据）
1. 引擎的 `compile(params)` **直接返回完整 SVG 文档字符串**，不是 css-doodle 的 DSL。
   页面里 `$: rendered = isTabbied ? '' : (isParametric ? code : svg(code));` 靠 `family.kind === 'parametric'` 跳过 css-doodle 包装。
2. `params.palette = [bg, fg, accent]`，且 `params.bg === palette[0]`（项目的 `stageFromBg(params.bg)` 用它定 paper/ink 舞台）。
3. 引擎必须零 npm 依赖、纯函数、可在 Node 下 import。

## 请重点攻击这些地方

### A. 集成是否真的完整（这是最可能出问题的地方）
项目里一切走 `family.compile` + `svg(code)` 的路径，是否都被正确处理了？
逐条去**读代码**确认，不要猜：
- `Source` 标签页（inspectorTab === 'source'）：编辑器里显示的 `code` 对 parametric 是什么？用户改了源码之后（`handleChange`）预览会不会更新？`ejected` / `Reset to Look` 流程还正确吗？
- `matchingPreset(family, params)` 能否正确识别 parametric 的 variant？它用 `family.schema.map(item => item.key)` 且排除 `'seed'` —— 而 parametric 的 seed 字段 key 是 `'modulator.seed'`，真的会被排除吗？如果不能，会不会导致 `dirty` 永远为 true？
- 键盘 ←/→ 切换 variant、`?id=` 深链、`Save URL` 对 parametric 是否可用？
- 从 parametric 切到 css-doodle family（或反向）时，`svg(code)` 与直通两条路径会不会互相污染？（注意 `rendered` 是响应式派生）
- Sidebar 缩略图、tags 过滤（'pattern' / 'code'）对 parametric 是否正常？
- `scripts/generate-thumbs.mjs` 改动后，**其它 family 的缩略图还生成得出来吗**？（注意它对 catalog.js 用了动态 import + try/catch）

### B. 引擎本身的正确性
- `src/lib/parametric/topology.js` 的 `maze()`：我新加了 iso / hex 两套墙体渲染。读它，找几何错误、越界、以及"某些 cell 画不出墙"的情况。
- `Lattice.resolve()` 对 `cols`/`rows` 越界值、`count=1`、`turns=0.5` 等极端的处理。
- `randomize()` 的约束逻辑有没有自相矛盾或漏掉的组合（例如导致 sizeMin > sizeMax）。
- `compose()` 对 `palette` 只有 2 项、`accent` 为空串、`invert=true` 的处理。

### C. 工程风险
- `catalog.js` 在模块加载时就对 14 个 variant 调 `compile()`。parametric 的 `toSvg()` 是同步纯计算，量级 0~3ms × 14。这会不会拖慢首屏或 SSG 预渲染？有没有更稳的做法？
- 新增的 `kind: 'parametric'` 有没有可能撞上别处对 `kind` 的假设？（全仓搜 `kind ===` 与 `sketch.kind`）
- 有没有引入无障碍问题（新面板的按钮/滑杆）。

## 输出要求
在最终回复里给出 markdown 报告：
1. **P0（阻断上线）/ P1（应该修）/ P2（建议）** 三级问题清单，每条给出 **`文件:行号` + 现象 + 最小复现 + 建议修法**。没有就写"无"。
2. **"我验证过的事实"** 一节：列出你**实际运行**的命令与原始输出（例如 `npm run build`、`node --test`、`node spike/parametric-accept.mjs`、以及任何你自己写的探测脚本）。**不要凭读代码就断言"能跑"**。
3. **"我无法验证/不确定"** 一节：诚实列出你没搞清楚的。
4. 对集成方案的**总体判断**：这个"1 行改动"的接法有没有本质缺陷？

## 硬性约束
- **只读**。不要修改、创建、删除任何文件（除了在 /tmp 下写你自己的临时探测脚本）。
- **不要** git add / commit / push。
- 不要跑 `npm run dev`（我来跑）。
- 可以跑 `npm run build`、`node --test`、`node spike/*.mjs`、`git diff`、`grep`。
