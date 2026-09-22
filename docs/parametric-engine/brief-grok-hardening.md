# Task: 加固参数化图形引擎 + 补齐单元测试（API 已冻结）

## Repo
`/Users/huazi/Desktop/svg` — SvelteKit 项目，Node 22，无测试框架、无 lint。
引擎位于 `src/lib/parametric/`，**零 npm 依赖**（只用标准 JS），可被 Node 直接 import。

## 你的角色：加固者 + 测试者，不是重写者

**公共 API 已冻结，不得更改任何函数签名、导出名、参数 key 名或语义：**

```js
// src/lib/parametric/index.js
generate(params) → { svg, stats: { cells, elements, ms }, warnings }   // svg 为完整 SVG 文档字符串
toSvg(params) → string
SCHEMA, GROUPS, DEFAULTS, defaults(), normalize(params)
randomize(params, seed, lockedKeys) → params
randomSeed()
encodeParams(params) / decodeParams(str)
PRESETS, PRESET_BY_ID
selfCheck() → { ok, failures }
ASPECTS, canvasSize(params)
VERSION

// 内部模块（同样冻结导出名）
hash.js:      hash2, hash1, noise2, fbm, mulberry32
lattice.js:   grid, hex, iso, oblique, ring, phyllotaxis, spiral, cluster, LATTICES, resolve, clampNum, clampInt, gridIndex, TAU
modulator.js: evaluate, cellRandom, fieldValue, MODULATORS, AXES
primitive.js: build, sizeAt, rotationAt, SHAPES, ROT_MODES
topology.js:  apply, TOPOLOGIES
compose.js:   compose, emptyDoc, canvasSize, ASPECTS
presets.js:   PRESETS, PRESET_BY_ID
```

参数对象是**扁平 dotted-key** 对象，见 `src/lib/parametric/schema.js` 的 `DEFAULTS`。
`params.palette = [bg, fg, accent]`，且 `params.bg` 必须等于 `palette[0]`（项目主题判定依赖）。

## 已完成、不要推翻的部分
- 14 个预设全部渲染成功（元素数 64~2350，耗时 0~3ms）
- 同参数两次生成**逐字节一致**
- `randomize` + `encodeParams/decodeParams` 往返一致
- 50 组随机参数压力测试：0 崩溃、0 空白
- 已有冒烟脚本：`spike/parametric-smoke.mjs`（`node spike/parametric-smoke.mjs`，退出码非 0 表示失败）

## 你要做的事

### 1. 写单元测试
新建 `src/lib/parametric/parametric.test.mjs`，**只用 Node 内置 `node:test` + `node:assert/strict`**，不引入任何 npm 包。用 `node --test src/lib/parametric/parametric.test.mjs` 能跑。

必须覆盖：
- **hash**：`hash2` 的确定性（同输入同输出）、分布均匀性（10k 采样，每个十进制十分位桶落在 5%~15% 之间）、`noise2` 值域在 [0,1]、`fbm` 值域在 [0,1]、`mulberry32` 序列确定性且同种子同序列。**特别回归测试**：`hash2` 必须真的散开——对 (0..99 × 0..99) 采样，不同取值的数量必须 > 900（这是曾经踩过的坑：用大整数乘法导致位运算失效、整片噪声退化为常量）。
- **lattice**：8 种底场各自的 `resolve()` 都返回非空数组、每个 cell 都有 `{x,y,u,v,r,theta,i,j,n,unit}` 且 `unit > 0`。**回归测试**：`lattice.gap` 取最大值时 `unit` 仍 > 0（曾经 `(1-gap)` 变负数导致图形消失）。`phyllotaxis` 的 `divergence=137.5` 时点数等于 `count`。
- **modulator**：7 种调制类型返回值都落在 [0,1]；`invert=true` 时结果等于 `1-原值`；同 cell 同参数两次求值相同。
- **primitive**：8 种基元各自输出以 `<` 开头且非空的 SVG 片段；尺寸为 0 时返回空串；`sizeAt` 在 `scaleToUnit=false` 时按像素、`=true` 时按单元百分比（100 → 一个单元）。
- **topology**：5 种拓扑都能返回数组；`isolated` 的元素数等于有效 cell 数；`truchet`/`maze` 在 `density` 提高时元素数不减少；`maze` 在不同 seed 下产出不同结果（确定性随机生效）。
- **compose**：输出以 `<svg` 开头、以 `</svg>` 结尾、含 `xmlns` 与 `viewBox`；`params.invert=true` 时背景色与前景色互换。
- **index**：`selfCheck()` 通过；`generate` 对 14 个预设逐个断言 `stats.elements > 8` 且 `warnings.length === 0`；`normalize` 能把非法值（越界数字、未知枚举、缺字段）修正为合法值；`randomize` 在 200 个不同种子下**都不产生空白**（`stats.elements >= 8`）；`encodeParams/decodeParams` 往返 20 组随机参数均一致。
- **性能**：`generate` 生成 20000 元素规模的参数，耗时 < 2000ms（用 `performance.now()`，断言宽松些避免 CI 抖动）。

### 2. 修 bug
跑测试，**修掉测试暴露的真实 bug**。修的时候：
- 保持所有导出签名与参数 key 不变
- 在改动处加一行注释说明原因（用英文）
- 不要改 `presets.js` 里任何预设的参数数值（视觉已验收过，改动会破坏还原度）——除非某个预设在测试中确实产出空白

### 3. 边界与兼容
- 确认引擎在 **Node 18** 语法下可用（不要用 Node 20+ 才有的 API，例如 `Array.prototype.toSorted`、`Object.groupBy`）
- 确认 `src/lib/parametric/**` 不 import 任何 npm 包（用 `grep -rn "from '[^.]"` 自查并且报告结果）
- 确认没有 `console.log` 残留在生产代码里

## 硬性禁止
- **不要**改 `src/systems.js`、`src/catalog.js`、`src/routes/**`、`src/components/**`（另一个 agent 正在做集成）
- **不要**改 `presets.js` 的预设数值
- **不要**改任何导出名 / 函数签名 / 参数 key 名 / 默认值语义
- **不要** git add / commit / push

## 必须真跑的验证（把原始输出贴进报告）
1. `node --test src/lib/parametric/parametric.test.mjs` → 全文输出，必须 0 fail
2. `node spike/parametric-smoke.mjs` → 全文输出，退出码 0
3. `grep -rn "from '[^.]" src/lib/parametric/` → 必须为空（证明零 npm 依赖）
4. `npm run build` → 必须成功（证明没弄坏构建）

## 报告契约
最终回复里给出：
- 测试文件路径 + 测试用例总数 + 通过数
- 你**修掉的每个 bug**：现象、根因、修法、涉及文件行号
- 上面 4 项验证的**原始命令与原始输出**
- 任何你**没能修掉**的问题，以及为什么
- 不要提交 git
