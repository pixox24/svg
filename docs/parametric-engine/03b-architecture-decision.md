# 架构决策记录：从「独立路由模块」改为「接入既有 system 机制」

| 项 | 内容 |
|---|---|
| 状态 | **已采纳**（取代 `03-PRD.md` 第 5、7 节关于"新增独立路由 + 自建三栏 UI"的规定）|
| 日期 | 2026-09-22 |
| 决策人 | 主代理（依据架构侦察报告）|
| 影响 | 引擎核心 API 不变；UI 层实现方式完全改变；工作量大幅下降、集成度大幅提升 |

---

## 1. 背景

`03-PRD.md` 在缺乏架构侦察的情况下冻结了这样一个实现方案（PRD §4.1 / §5 / §7）：

- 新增独立路由 `src/routes/parametric/+page.svelte`
- 自建 6 个 Svelte 组件（`ParametricStudio` / `ParamControl` / `ParamGroup` / `PresetGallery` / `PreviewStage` / `ExportBar`）
- 自建三栏布局（预设墙 + 预览 + 参数面板）
- 自行接管导出

之后派出的架构侦察子代理读完项目全部源码后，报告了一个**关键事实**：

> 本项目已有一套成熟的可扩展机制：`src/systems.js` 中的 `system` 接口
> `{ schema: Field[], compile(params) → string, shuffle(params) → params }`，
> 已有 8 个引擎（marks / crystal / textile / pebble / spiral / orb / halo / tide）使用它。
> 新引擎只要按此接口注册，即可自动获得参数面板、实时预览、三种导出、侧栏条目与标签检索、
> `?id` 分享链接、变体切换、缩略图生成 —— **`+page.svelte` / `Sidebar` / `LookPanel` / `export.js` 全部无需改动。**

同时确认：`LookPanel` 已经是一个 **schema 驱动的参数面板**（`{#if field.type}` 链，支持
`range / color / palette / toggle / select / icon / seed`），并已实现 `showIf` 条件显示与
`shuffle` 随机按钮 —— 与 PRD 里"由 SCHEMA 自动生成面板"的要求**完全同构**。

## 2. 决策

**放弃自建三栏 UI，改为把引擎接入既有 `system` 机制。**

具体落地（仅改动 3~4 个文件）：

| 文件 | 改动 | 说明 |
|---|---|---|
| `src/lib/parametric/**` | 新增（已提交 `71ee509`）| 引擎核心，零 npm 依赖，纯函数 |
| `src/systems.js` | 追加 `parametric` system + 注册 | `compile: (p) => toSvg(p)`、`shuffle: (p) => randomize(p, randomSeed())` |
| `src/catalog.js` | 追加 1 个 family + 14 个 variants | variants 由 `PRESETS` 生成，一图一预设 |
| `src/routes/+page.svelte` | **改 1 行** | `rendered` 增加 parametric 分支：引擎直出 SVG，不再过 css-doodle 的 `svg()` 包装 |
| `scripts/generate-thumbs.mjs` | 可选适配 | 服务于侧栏封面 |

## 3. 为什么这是更好的方案

| 维度 | 独立路由方案（原 PRD） | 接入 system 方案（已采纳） |
|---|---|---|
| 新增 Svelte 组件 | 6 个 | **0 个** |
| 新增路由 | 1 个 | **0 个** |
| 改动的既有文件 | 导航入口 + 面板复用若干处 | **1 行**（+2 个追加式注册） |
| 与现有功能联动 | 需要自己实现"送到编辑器"等桥接 | **天然共享**：同一套调色板、画布、DPI、导出、`?id`、变体切换、键盘 ←/→ |
| 用户能否在侧栏发现它 | 需要额外做入口 | **自动出现在侧栏**，可被标签检索 |
| 参数面板一致性 | 需手工对齐视觉语言 | **复用同一个 LookPanel**，不可能不一致 |
| 未来维护 | 两套面板逻辑并行演化 | 单一来源 |
| 对 `LookPanel` 扩展字段类型的依赖 | 无 | 有（若新增字段类型需改 `LookPanel` 的 `{#if}` 链）|

**决定性理由**：用户的需求原文是「**最好也能够跟项目中现有的功能能够连接起来，相互配合**」。
自建一套平行的三栏 Studio，即使做得更华丽，也是在项目里长出一个**平行的第二产品**——
用户在侧栏发现不了它，调色板/画布/导出都要重新适配，长期会有两套面板逻辑各自演化。
而接入既有机制后，新引擎和现有 8 个引擎**共享同一套基础设施**，这才是"连接起来、相互配合"。

## 4. 代价与遗留

1. **字段类型受限于 `LookPanel` 现有链**（`range/color/palette/toggle/select/icon/seed`）。
   本引擎的 schema 已按这 7 种类型设计（`02-research.md` 里"参数分组折叠"的愿望未能完全实现，
   面板是扁平长列表，靠 `showIf` 控制可见数量来缓解）。
2. **13 个参考图预设不再各有独立缩略图**（除非适配 `generate-thumbs.mjs`），
   侧栏可能回退到默认样式。
3. **`kind: 'parametric'` 是新增的 family 种类**。已确认 `isTabbied` 判定为
   `family?.kind === 'tabbied'`，新增值不影响既有分支；但需实测构建与渲染。
4. **参数标签的语言**：引擎 schema 的标签为中文，而项目既有 system 的标签为英文。
   这是一处风格不一致，取舍是"面向中文设计师用户"优先。

## 5. 保留不变的部分

- **引擎核心 API 完全冻结**（PRD §4.2 / §4.3 仍然有效，逐字遵守）：这是两个实现方并行的前提
- **配色契约**：`params.palette = [bg, fg, accent]` 且 `params.bg === palette[0]`（`stageFromBg` 依赖）
- **引擎零 npm 依赖、纯函数、可在 Node 下 import** 这些非功能要求全部保留
- **验收标准**（PRD §9）除"参数面板分组"降级为"`showIf` 控制可见性"外，其余逐条有效

---

*本文档为对 `03-PRD.md` 的修正案，优先级高于 PRD 第 5、7 节。其余章节仍然有效。*
