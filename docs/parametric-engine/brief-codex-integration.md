# Task: 把「参数化图形引擎」接入 SVG Playground（最小侵入）

## Repo
`/Users/huazi/Desktop/svg` — SvelteKit + Svelte 3.57 + Vite 4 + adapter-static。无测试框架、无 lint。

## 背景：引擎已完成并通过自检
新引擎位于 `src/lib/parametric/`，`src/lib/parametric/index.js` 导出：

```js
import {
  generate, toSvg, SCHEMA, GROUPS, defaults, normalize,
  randomize, randomSeed, encodeParams, decodeParams,
  PRESETS, PRESET_BY_ID, selfCheck, ASPECTS, canvasSize,
} from '../lib/parametric/index.js';

generate(params) // → { svg: string, stats: { cells, elements, ms }, warnings: string[] }
toSvg(params)    // → string   完整 SVG 文档（含 xmlns / viewBox / 背景 rect）
PRESETS          // → [{ id, name, nameZh, family, ref, params }]  共 14 个，还原 14 张参考图
SCHEMA           // → 字段数组，type ∈ range|select|color|palette|toggle|seed，条件显示用 showIf(p)
randomize(params, seed, lockedKeys) // → 新参数（确定性）
```

已实测：14 个预设全部渲染成功、同参数两次生成逐字节一致、encode/decode 往返一致、50 组随机参数 0 崩溃 0 空白。

## 目标：接入项目既有的 system 机制

项目里 `src/systems.js` 的 `system` 接口正是为扩展设计的：
```js
{ schema: Field[], compile(params) → string, shuffle(params) → params }
```
接进去即可**免费获得**：参数面板（LookPanel 按 schema 自动渲染）、实时预览、Copy SVG / PNG / SVG 下载三种导出、侧栏条目与标签检索、`?id` 分享链接、变体切换、缩略图。

### 要做的事（严格只改这 3~4 个文件）

**1. `src/systems.js`**
在文件末尾（`export const systems = {…}` 之前）新增：
```js
const PARAMETRIC = await import('./lib/parametric/index.js')  // ← 用普通静态 import，不要用 await import
export const parametric = {
  schema: PARAMETRIC.SCHEMA,
  compile: (params) => PARAMETRIC.toSvg(params),
  shuffle: (params) => PARAMETRIC.randomize(params, PARAMETRIC.randomSeed()),
};
```
并把 `parametric` 追加进 `export const systems` 对象（**追加**，不要改动其他 system）。

**2. `src/catalog.js`**
在 `families` 数组**末尾追加**一个 family（不要改动已有 family）：
```js
{
  id: 'parametric',
  label: 'Parametric',
  blurb: '英文一句话，描述"参数化图形：底场 × 调制 × 基元 × 拓扑"',
  tags: ['pattern', 'code'],
  kind: 'parametric',
  ...systems.parametric,
  variants: /* 由 PRESETS 生成 */ [
    { id: preset.id, name: `${preset.nameZh} · ${preset.name}`, params: preset.params },
    ...
  ],
}
```
⚠️ 关键约束：每个 variant 的 `params` 必须含 `bg` 或 `palette[0]` —— `stageFromBg()` 用它判定 paper/ink 主题。引擎的 `normalize()` 已保证 `params.bg === params.palette[0]`，直接透传 `preset.params` 即可，不要删字段。

**3. `src/routes/+page.svelte`**（只改渲染管线一处）
现在是：
```js
$: rendered = isTabbied ? '' : svg(code);
```
改为：
```js
$: isParametric = family?.kind === 'parametric';
$: rendered = isTabbied ? '' : (isParametric ? code : svg(code));
```
理由：parametric family 的 `compile()` 直接返回完整 SVG 文档字符串，**不能再**经过 css-doodle 的 `svg()` 包装。

**4. `scripts/generate-thumbs.mjs`**（可选）
让缩略图脚本也能处理 parametric family。如果无法在不影响其他 family 的前提下适配，就**跳过**并在报告里说明（侧栏会回退到默认样式，不影响功能）。

## 硬性禁止
- **不要**新增页面分支、不要新增组件、不要改 LookPanel / Sidebar / CanvasBar / lib/export.js / app.html
- **不要**碰 `src/lib/parametric/**`（另一个 agent 正在加固它）
- **不要** git add / commit / push（我会自己评审后提交）
- Svelte 3 语法：`on:click`、`export let`、`createEventDispatcher`、`bind:`。**禁止** Svelte 5 runes（`$state`/`$props`/`$derived`/`$effect`）
- 代码风格与现有文件一致：2 空格缩进、单引号、分号、英文注释

## 必须真跑的验证（把原始输出贴进报告，不要只说"通过了"）
1. `node -e "import('./src/lib/parametric/index.js').then(m=>console.log(JSON.stringify(m.selfCheck())))"` → 必须 `{"ok":true,"failures":[]}`
2. `npm run build` → 必须成功，且**没有新增的**报错/警告
3. `npm run dev` 起服务，确认首页能打开、`parametric` family 出现在侧栏、至少 2 个变体能正常渲染
4. `git status --porcelain` 与 `git diff --stat` 全文

## 报告契约
在最终回复里给出：
- 改了哪些文件、每个文件的改动摘要（含关键行号）
- 上面 4 项验证的**原始命令与原始输出**
- 任何你做过的设计判断（例如缩略图适配方案），以及任何你没做到/不确定的地方
- 不要提交 git
