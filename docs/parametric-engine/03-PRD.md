# PRD · 参数化图形引擎（Parametric Shape Engine）

| 项 | 内容 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-22 |
| 目标项目 | `~/Desktop/svg`（SVG Playground，SvelteKit + Svelte 3.57 + Vite 4 + adapter-static）|
| 交付形态 | 新模块（引擎库 + UI + 独立路由），与现有 Playground 互通 |
| 目标用户 | 平面设计师、网页/UI 设计师、视觉相关创意工作者 |
| 上游依据 | `docs/parametric-engine/01-reference-analysis.md`（14 张参考图识别与分类）|
| 验收时间 | 2026-09-23 08:00 |

---

## 1. 背景与目标

### 1.1 问题

现有 SVG Playground 的心智模型是「**写代码 → 看结果**」：用户面对 CodeMirror，靠编辑 CSS/SVG 源码来产出图形。这对工程师友好，但对**设计师**门槛过高——设计师想要的是「**拖参数 → 看结果**」。

同时，桌面 `参数化几何图形参考图` 里的 14 张图证明了另一件事：**高级的视觉复杂度来自「规则底场 × 参数调制」的组合，而不是手工绘制**。这类图形恰恰是设计师最想要、却最难手工产出的素材。

### 1.2 目标

构建一个**参数化图形引擎**，让设计师通过**实时调节参数**生成具备良好审美与复杂度的几何图形，并导出可用资产。

**成功 = 设计师不需要写一行代码，就能在 30 秒内产出一张可用的高级几何图形。**

### 1.3 非目标（v1 明确不做）

- 不做通用绘图/矢量编辑器（不是 Figma）
- 不做 AI 文生图（不接扩散模型）
- 不做 3D / WebGL 渲染
- 不做用户账号、云存储、协作

---

## 2. 目标用户与核心场景

### 2.1 用户画像

| 画像 | 特征 | 典型诉求 |
|---|---|---|
| **平面设计师** | 做海报/包装/品牌视觉 | 需要大幅面背景纹理、主视觉图形，要能导出高分辨率 |
| **网页/UI 设计师** | 做 Landing Page / Hero 区 / 空状态插画 | 需要轻量 SVG（体积小）、可控配色、能贴进设计稿 |
| **创意工作者** | 做生成艺术、社媒视觉 | 需要"随机到惊喜"的能力，且能复现某次随机结果 |

### 2.2 核心场景（用户故事）

1. **选一个预设 → 微调 → 导出**：设计师 30 秒拿到一张可用图形
2. **从零构建**：选定底场 → 选调制 → 选基元 → 调参数 → 得到全新图形
3. **随机探索**：点「随机」得到惊喜结果，锁住喜欢的参数，继续随机其余部分
4. **精确复现**：把参数存成预设 / 分享链接，下次打开一模一样
5. **进编辑器加工**：参数调出基础形态后，一键送到 Playground 编辑器继续手改源码

---

## 3. 产品定义

### 3.1 一句话

**参数化图形引擎 = 把「网格 × 调制 × 基元 × 变换 × 拓扑 × 配色」六个正交维度暴露成可调参数，并实时渲染为 SVG。**

### 3.2 与"预设图案列表"的本质区别

| | 预设图案库 | **参数化引擎（本方案）** |
|---|---|---|
| 实现 | N 个硬编码生成函数 | 1 条可组合管线 |
| 用户能做的 | 换图案 | 换维度组合 + 连续调参 |
| 可生成的图形数 | N | 组合爆炸，理论上无限 |
| 新增一种图形 | 写新函数 | 新增一个维度分支即可，自动获得全部组合 |

### 3.3 渲染管线（引擎核心）

```
Params (可序列化对象)
  │
  ├─ 1. Lattice.resolve(params)     → cells[]   位置场：网格/六角/极坐标/螺旋/叶序/簇
  ├─ 2. Modulator.evaluate(cell)    → m ∈ [0,1]  调制场：线性/径向/正弦/噪声/黄金角
  ├─ 3. Primitive.build(cell, m)    → pathData   基元：点/椭圆/条/胶囊/多边形/曲线多边形/弧
  ├─ 4. Topology.apply(paths)       → paths      拓扑：独立/连通(Truchet)/迷宫/反相/半调
  └─ 5. Compose(paths, palette)     → svgString  合成文档
```

**架构铁律**

1. **纯函数**：`generate(params) → svgString`。无 DOM、无副作用、无全局态 → 可快照、可复现、可服务端渲染、可测试
2. **参数即状态**：全部参数是**扁平可序列化的普通对象**（dotted key）→ 天然支持预设、撤销、URL 分享、localStorage
3. **Schema 单一真相源**：参数面板 UI **由 schema 自动生成**，不手写控件。新增参数 = 改 schema 一处
4. **渲染与导出解耦**：引擎只输出字符串；预览与导出各自消费

---

## 4. API 契约（冻结 · 两个实现方必须严格遵守）

### 4.1 目录结构

```
src/lib/parametric/
  index.js        — 公共 API（唯一对外的门面）
  schema.js       — 参数 schema（单一真相源）+ defaults() + 校验
  hash.js         — 确定性哈希 + 值噪声 + fBm
  lattice.js      — 底场解析器
  modulator.js    — 调制场求值
  primitive.js    — 基元 → SVG 片段
  topology.js     — 拓扑变换
  compose.js      — 合成完整 SVG 文档
  presets.js      — 预设库（含 14 张参考图还原）
src/components/parametric/
  ParametricStudio.svelte   — 主容器（三栏）
  ParamControl.svelte       — 通用控件（按 schema 渲染）
  ParamGroup.svelte         — 可折叠分组
  PresetGallery.svelte      — 预设缩略图墙
  PreviewStage.svelte       — 实时预览
  ExportBar.svelte          — 导出栏
src/routes/parametric/+page.svelte  — 路由页
```

### 4.2 公共 API（`src/lib/parametric/index.js`）

```js
/** 主入口：参数 → SVG 文档字符串 */
export function generate(params) 
// → { svg: string, stats: { cells: number, elements: number, ms: number }, warnings: string[] }

/** 默认参数（合法且能渲染出好图形） */
export function defaults() // → Params

/** 参数合法性修正（未知值回落到默认，数字夹到合法区间） */
export function normalize(params) // → Params

/** 基于种子的确定性随机（部分字段随机，保留 locked 字段） */
export function randomize(params, seed, lockedKeys = []) // → Params

/** 参数 → URL-safe 字符串（分享/持久化） */
export function encodeParams(params) // → string
export function decodeParams(str)    // → Params

/** 参数 schema（UI 自动生成的依据） */
export const SCHEMA // → Field[]
export const GROUPS // → [{ id, label, icon }]

/** 预设库 */
export const PRESETS // → Preset[]
```

### 4.3 参数对象（Params）

扁平对象，**key 为 dotted string**，与现有 LookPanel 的 `dispatch('change', { ...params, [key]: value })` 模式兼容。

```js
{
  'canvas.width': 1000,        // 100..4000
  'canvas.height': 1000,       // 100..4000

  'palette.bg': '#f2eee6',
  'palette.fg': '#101216',
  'palette.accent': '',        // 空串 = 不用强调色
  'palette.invert': false,

  'lattice.type': 'grid',      // grid|hex|iso|oblique|polar|spiral|phyllotaxis|ring|cluster
  'lattice.cols': 12,          // 1..60
  'lattice.rows': 12,          // 1..60
  'lattice.gap': 0,            // -0.9..1.5  单元间隙（负数=重叠）
  'lattice.angle': 0,          // 0..360     底场旋转
  'lattice.skew': 0,           // -60..60    斜切（oblique 用）
  'lattice.count': 800,        // polar/spiral/phyllotaxis 的点数
  'lattice.turns': 5,          // spiral 圈数
  'lattice.spiralKind': 'archimedean', // archimedean|logarithmic
  'lattice.divergence': 137.5, // 90..180   叶序发散角
  'lattice.clusterSize': 4,    // cluster 每簇点数
  'lattice.clusterSpread': 2.4,// cluster 簇间距

  'modulator.type': 'none',    // none|linear|radial|sine|noise|golden|ripple
  'modulator.axis': 'y',       // x|y|both|diag|radius|angle
  'modulator.freq': 1,         // 0.1..8
  'modulator.amp': 1,          // 0..2
  'modulator.phase': 0,        // 0..1
  'modulator.bias': 0.5,       // 0..1
  'modulator.seed': 1,         // 1..999
  'modulator.invert': false,

  'shape.type': 'dot',         // dot|ellipse|bar|capsule|polygon|curvePoly|arc|ring
  'shape.sizeMin': 4,          // 0..400   对应调制值 0
  'shape.sizeMax': 40,         // 0..400   对应调制值 1
  'shape.aspect': 1,           // 0.1..6   长宽比
  'shape.aspectMode': 'fixed', // fixed|modulated  随调制值从 1/aspect 渐变到 aspect
  'shape.corner': 0.5,         // 0..1     圆角率
  'shape.sides': 6,            // 3..12
  'shape.curvature': 0.35,     // 0..0.9   边内凹/外凸
  'shape.rotation': 0,         // 0..360
  'shape.rotMode': 'none',     // none|grid|alternate|tangent|radial|noise
  'shape.stroke': false,       // true = 描边模式
  'shape.strokeWidth': 8,      // 0.5..80  描边宽度（占单元尺寸比例时用 strokeScale）

  'topology.mode': 'isolated', // isolated|truchet|maze|invert|halftone
  'topology.jitter': 0,        // 0..1     位置抖动
  'topology.density': 0.5,     // 0..1     truchet/maze 的边密度
}
```

### 4.4 Schema Field 形状

```js
{
  key: 'modulator.freq',      // 必须与 Params 的 key 一致
  label: '频率',               // 中文标签
  labelEn: 'Frequency',
  type: 'range',              // range|select|color|toggle|number
  min: 0.1, max: 8, step: 0.05,   // range/number 用
  options: [{ value, label }],    // select 用
  group: 'modulator',         // 属于哪个折叠分组
  hint: '波形疏密',            // 可选：悬浮提示
  when: (p) => p['modulator.type'] !== 'none',  // 可选：条件显示
}
```

`GROUPS`：
```js
[ { id:'canvas', label:'画布' }, { id:'palette', label:'配色' },
  { id:'lattice', label:'底场' }, { id:'modulator', label:'调制' },
  { id:'shape', label:'基元' }, { id:'topology', label:'拓扑' } ]
```

### 4.5 Preset 形状

```js
{
  id: 'circle-pulse',
  name: 'Circle Pulse',
  nameZh: '圆脉',
  family: 'grid',              // 用于分组展示
  ref: 'ref-02',               // 可选：还原自哪张参考图
  params: { ...Partial<Params> }  // 只需写与 defaults 不同的字段
}
```

**PRESETS 必须包含 14 个还原预设**，id 与 `docs/parametric-engine/01-reference-analysis.md` 的表格一一对应：
`iso-maze`, `circle-pulse`, `capsule-noise`, `curved-hex`, `phyllotaxis`, `diagonal-weave`, `sine-warp`, `polar-spiral`, `sine-weave`, `decay-grid`, `hex-clusters`, `hex-triangles`, `spiral-gallery`, `hex-meander`

---

## 5. UI / 交互规格

### 5.1 布局（复用现有三栏 grid 语言）

```
┌──────────────┬────────────────────────────┬─────────────────────┐
│  预设库       │        实时预览             │     参数面板         │
│  (侧栏)       │                            │   (inspector)       │
│              │   ┌──────────────────┐     │                     │
│ 搜索框        │   │                  │     │  ▸ 画布              │
│ ─────────    │   │   SVG 实时渲染     │     │  ▸ 配色              │
│ ● 圆脉        │   │                  │     │  ▾ 底场              │
│ ● 曲边六边    │   │                  │     │    类型 [网格 ▾]     │
│ ● 叶序螺旋    │   └──────────────────┘     │    列数 ──●──── 12   │
│ ...          │                            │    ...              │
│ [+ 我的预设]  │   [SVG] [PNG] [复制] [随机] │  ▸ 调制 / 基元 / 拓扑 │
└──────────────┴────────────────────────────┴─────────────────────┘
```

### 5.2 关键交互

| 功能 | 规格 |
|---|---|
| **实时预览** | 参数变化后 **≤150ms** 更新（rAF 节流；参数拖拽过程中不阻塞输入）|
| **参数控件** | 滑杆 + 数字输入**并存**（滑杆粗调、数字精确输入）；双击标签恢复该项默认值 |
| **参数锁定** | 每项参数可「锁」；点「随机」时锁定的项不被改动 |
| **随机** | 全量随机 / 仅随机未锁定项；显示种子号；可输入种子复现 |
| **预设** | 缩略图墙（缩略图由引擎实时生成 SVG）；点击即应用；可保存当前参数为新预设（localStorage）|
| **撤销/重做** | 参数栈，至少 50 步；⌘Z / ⌘⇧Z |
| **分享** | 复制含参数的 URL；打开 URL 自动还原 |
| **送到编辑器** | 「Open in Studio」按钮 → 把生成的 SVG 源码送进现有 Playground 编辑器继续手改 |

### 5.3 视觉语言

必须与现有 Playground 一致：
- 复用现有 CSS 变量 / 主题 token（`--sheet-bg`、`--ar` 等已存在）
- 面板宽度、圆角、边框、字号沿用 inspector 现有规格
- 不引入新的 UI 框架、不引入 CSS-in-JS 库
- 中文标签为主，可带英文副标

---

## 6. 导出规格

| 格式 | 说明 | 复用 |
|---|---|---|
| **SVG 下载** | 输出干净 SVG（含 xmlns、viewBox），文件名含预设名+种子 | `svgBlob` + `downloadFile` |
| **PNG 下载** | 可选 1x / 2x / 4x（2000/4000/8000px 长边） | `svgToPngBlob` |
| **复制 SVG 代码** | 到剪贴板 | `copyText` |
| **复制 PNG** | 到剪贴板 | `copyPng` |
| **复制参数链接** | URL 含编码参数 | `encodeParams` |
| **导出为预设 JSON** | 方便跨设备迁移 | 新增，简单 JSON 下载 |

**禁止**：另起一套导出实现。必须复用 `src/lib/export.js`。

---

## 7. 与现有项目的集成

| 集成点 | 要求 |
|---|---|
| 路由 | `src/routes/parametric/+page.svelte`，静态预渲染（adapter-static 要求）|
| 导航 | 在现有界面上提供入口（顶部/侧栏一处，不破坏现有布局）|
| 导出模块 | 复用 `src/lib/export.js` 全部函数 |
| 调色板 | 复用现有颜色 token；引擎默认配色取自现有 `INK`/`PAPER` |
| 编辑器互通 | 「Open in Studio」把 SVG 源码送入现有 CodeMirror（通过 URL 参数或 localStorage 传递）|
| 反向引用 | 引擎的 14 个预设与现有 look 并列展示（若成本低）|
| 服务端渲染 | 引擎必须能在 Node 下无 DOM 运行（`generate()` 只用字符串拼接）|

---

## 8. 非功能需求

| 项 | 指标 |
|---|---|
| 性能 | 1000 元素以下 60fps 预览；10000 元素 < 1s 生成 |
| 体积 | 引擎库 gzip 后 < 15KB（不含 Svelte）|
| 确定性 | 相同参数 + 相同种子 → **逐字节相同**的 SVG |
| 无依赖 | 引擎核心 `src/lib/parametric/` **不得引入任何 npm 依赖**（纯手写数学）|
| 可测试 | 核心纯函数可被 Node 直接 import 测试，无需浏览器 |
| 兼容 | 现代浏览器（Chrome/Safari/Firefox 最新两个版本）；macOS Safari 必须可用 |
| 可访问性 | 控件有 label、可键盘操作、对比度达 AA |
| 代码风格 | 遵循现有：2 空格缩进、单引号、ESM、无分号偏好按现有文件（看现有文件：有分号）|

---

## 9. 验收标准（可测）

### 9.1 功能验收

- [ ] **A1** `npm run build` 成功，无新增报错
- [ ] **A2** `npm run dev` 启动，`/parametric` 路由可访问
- [ ] **A3** 14 个参考图预设全部能渲染出**与参考图结构一致**的图形（人工比对通过）
- [ ] **A4** 参数面板由 `SCHEMA` 自动生成，覆盖全部 6 个分组
- [ ] **A5** 任意参数改动后 ≤150ms 预览更新
- [ ] **A6** 随机 + 锁定功能正常；同种子可复现
- [ ] **A7** 撤销/重做 ≥50 步
- [ ] **A8** SVG / PNG / 复制 导出全部可用，导出文件能在浏览器/设计软件中打开
- [ ] **A9** URL 分享可完整还原参数
- [ ] **A10** 「Open in Studio」能把 SVG 送进现有编辑器
- [ ] **A11** 引擎核心零 npm 依赖
- [ ] **A12** Node 环境下可直接 `generate()`（无需浏览器）

### 9.2 质量验收（多模型交叉评审）

- [ ] **Q1** 代码评审：由 2 个不同厂商模型（Grok / Codex）独立评审，无 P0 缺陷
- [ ] **Q2** 视觉评审：14 个预设的还原度由视觉模型独立打分，平均 ≥ 7/10
- [ ] **Q3** 可用性：新用户（模型扮演）在无说明情况下能完成"选预设→调参→导出"
- [ ] **Q4** 无硬编码：面板无写死控件，全部由 schema 驱动

### 9.3 交付物

- [ ] PRD（本文档）
- [ ] 参考图分析与调研文档
- [ ] 引擎源码 + UI 源码
- [ ] 单元测试（引擎核心纯函数）
- [ ] 验收报告（含截图证据、构建日志、评审结论）

---

## 10. 任务分解与里程碑

| 阶段 | 任务 | 负责 | 产出 |
|---|---|---|---|
| P0 | 参考图识别与分类 | 主代理 | `01-reference-analysis.md` |
| P0 | 技术调研（谱系/竞品/交互惯例）| 子代理 | `02-research.md` |
| P0 | 抽象可行性 spike（14 图还原验证）| 主代理 | `spike/parametric-spike.mjs` ✅ |
| P1 | **引擎核心生产化**（schema/hash/lattice/modulator/primitive/topology/compose/presets）| 实现代理 A | `src/lib/parametric/**` |
| P1 | **UI 模块**（Studio/控件/预设墙/预览/导出栏/路由）| 实现代理 B | `src/components/parametric/**` + 路由 |
| P2 | 集成（导航入口、Open in Studio、构建验证）| 主代理 | 可运行的应用 |
| P2 | 交叉评审 + 迭代修复 | 评审代理 C/D + 主代理 | `04-review.md` |
| P3 | 验收（构建/预览/导出/截图实测）| 主代理 | `05-acceptance.md` |

---

## 11. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| 两个代理并行改动同一仓库 | 冲突/互相覆盖 | **文件集合严格不重叠**：A 只写 `src/lib/parametric/**`，B 只写 `src/components/parametric/**` 与 `src/routes/parametric/**`。API 契约在本文档冻结 |
| 高元素数导致预览卡顿 | 体验崩坏 | 预览层按元素数自动降采样（>4000 元素时预览降分辨率，导出仍全量）；可提供「预览质量」开关 |
| 视觉还原度不达标 | 产品价值不足 | 已有 spike 证明 14/14 结构可还原；还原阈值设为「结构一致」而非「像素一致」|
| Svelte 3 语法误用（写成 Svelte 5 runes）| 构建失败 | 明确约束：`export let` / `on:event` / `createEventDispatcher` / `$:`，禁用 `$state`/`$props`/`$derived` |
| 面板控件硬编码 | 后续扩展困难 | Q4 验收项：面板必须由 SCHEMA 驱动 |
| 构建失败（adapter-static 预渲染）| 无法上线 | 路由页避免浏览器专属 API 在顶层执行；`onMount` 内访问 window |

---

*本文档为唯一需求真相源。实现方与评审方的一切分歧以本文档为准。*
