/**
 * 参数化引擎 · 验收入口
 * 运行：node spike/parametric-accept.mjs
 *
 * 只做机械可验证的部分；浏览器端到端另由人（主代理）用截图取证。
 * 退出码 0 = 全部通过。
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const results = [];
const run = (label, fn) => {
  try {
    const note = fn();
    results.push({ label, pass: true, note: note || '' });
    console.log(`  PASS  ${label}${note ? `  — ${note}` : ''}`);
  } catch (err) {
    results.push({ label, pass: false, note: err.message });
    console.log(`  FAIL  ${label}  — ${err.message}`);
  }
};
const sh = (cmd, opts = {}) => execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
const need = (cond, msg) => { if (!cond) throw new Error(msg); };

console.log('\n═══ 参数化图形引擎 · 验收 ═══\n');

console.log('【A. 引擎核心】');

run('A1 selfCheck 14 个预设全部通过', () => {
  const out = sh(`node -e "import('./src/lib/parametric/index.js').then(m=>console.log(JSON.stringify(m.selfCheck())))"`).trim();
  const r = JSON.parse(out);
  need(r.ok, `selfCheck 失败: ${JSON.stringify(r.failures)}`);
  return `14/14 预设，failures=[]`;
});

run('A2 引擎零 npm 依赖', () => {
  let out = '';
  try {
    out = sh(`grep -rn "from '[^.]" src/lib/parametric/ || true`).trim();
  } catch { out = ''; }
  need(!out, `发现外部依赖:\n${out}`);
  return '仅相对 import';
});

run('A3 确定性：同参数两次生成逐字节一致', () => {
  const out = sh(`node -e "
    import('./src/lib/parametric/index.js').then(m=>{
      const a=m.generate(m.PRESETS[0].params).svg, b=m.generate(m.PRESETS[0].params).svg;
      const c=m.generate(m.PRESETS[13].params).svg, d=m.generate(m.PRESETS[13].params).svg;
      console.log(a===b && c===d ? 'ok' : 'differ');
    })"`).trim();
  need(out === 'ok', `不一致: ${out}`);
  return '2 组各 2 次一致';
});

run('A4 随机参数不产出空白（120 组，要求 ≥15 个元素）', () => {
  const out = sh(`node -e "
    import('./src/lib/parametric/index.js').then(m=>{
      let bad=0, min=1e9;
      for(let i=0;i<120;i++){
        const r=m.generate(m.randomize(m.PRESETS[i%14].params, i*7919+3));
        if(r.stats.elements<15) bad++;
        min=Math.min(min,r.stats.elements);
      }
      console.log(JSON.stringify({bad,min}));
    })"`).trim();
  const { bad, min } = JSON.parse(out);
  need(bad === 0, `${bad}/120 组元素过少，最少 ${min}`);
  return `0 组过少，最少元素数 ${min}`;
});

run('A5 参数编解码往返一致（30 组）', () => {
  const out = sh(`node -e "
    import('./src/lib/parametric/index.js').then(m=>{
      let bad=0;
      for(let i=0;i<30;i++){
        const p=m.randomize(m.PRESETS[i%14].params, i*104729+11);
        if(JSON.stringify(m.decodeParams(m.encodeParams(p)))!==JSON.stringify(p)) bad++;
      }
      console.log(String(bad));
    })"`).trim();
  need(out === '0', `${out}/30 往返不一致`);
  return '30/30 一致';
});

run('A6 非法规格被 normalize 修正', () => {
  const out = sh(`node -e "
    import('./src/lib/parametric/index.js').then(m=>{
      const bad={'lattice.cols':9999,'lattice.type':'不存在','modulator.type':null,'shape.sizeMax':-50,'palette':'坏值','invert':'x'};
      const p=m.normalize(bad);
      const ok = p['lattice.cols']<=80 && p['lattice.type']==='grid' && p['modulator.type']==='none'
        && p['shape.sizeMax']>=0 && Array.isArray(p.palette) && p.bg===p.palette[0] && p.invert===true;
      console.log(ok?'ok':'bad:'+JSON.stringify({t:p['lattice.type'],mx:p['shape.sizeMax'],pal:p.palette,bg:p.bg}));
    })"`).trim();
  need(out === 'ok', out);
  return '越界/未知枚举/坏类型均回落';
});

console.log('\n【B. 单元测试】');
run('B1 node --test 全部通过', () => {
  const f = join(ROOT, 'src/lib/parametric/parametric.test.mjs');
  if (!existsSync(f)) throw new Error('未找到 parametric.test.mjs（加固代理未产出）');
  let out = '';
  try {
    out = sh(`node --test src/lib/parametric/parametric.test.mjs 2>&1`);
  } catch (e) {
    out = `${e.stdout || ''}${e.stderr || ''}`;
    const m = out.match(/# fail (\d+)/);
    throw new Error(`有失败用例: fail=${m ? m[1] : '?'}`);
  }
  const m = out.match(/# pass (\d+)/);
  return `pass=${m ? m[1] : '?'}`;
});

console.log('\n【C. 集成（静态检查）】');

run('C1 systems.js 注册了 parametric', () => {
  const s = readFileSync(join(ROOT, 'src/systems.js'), 'utf8');
  need(/export const parametric/.test(s), '没有 export const parametric');
  need(/^\s*parametric[,}]?\s*$/m.test(s) || /systems\s*=\s*\{[^}]*parametric/s.test(s), '没有注册进 systems 对象');
  return '已注册';
});

run('C2 catalog.js 有 parametric family 与 14 个 variants', () => {
  const s = readFileSync(join(ROOT, 'src/catalog.js'), 'utf8');
  need(/id:\s*'parametric'/.test(s), '没有 parametric family');
  const presets = readFileSync(join(ROOT, 'src/lib/parametric/presets.js'), 'utf8');
  const ids = [...presets.matchAll(/id:\s*'(p-[a-z-]+)'/g)].map((m) => m[1]);
  need(ids.length === 14, `预设数不是 14：${ids.length}`);
  for (const id of ids) need(s.includes(id), `catalog 里缺少 variant ${id}`);
  return `14 个 variant 齐备`;
});

run('C3 +page.svelte 有 parametric 渲染分支', () => {
  const s = readFileSync(join(ROOT, 'src/routes/+page.svelte'), 'utf8');
  need(/isParametric/.test(s), '没有 isParametric 判定');
  need(/isParametric\s*\?\s*code\s*:\s*svg\(code\)/.test(s), 'rendered 分支写法不符');
  return 'rendered 分支正确';
});

console.log('\n【D. 构建】');
run('D1 npm run build 成功', () => {
  let out = '';
  try {
    out = sh('npm run build 2>&1', { timeout: 300000 });
  } catch (e) {
    out = `${e.stdout || ''}${e.stderr || ''}`;
    throw new Error(`构建失败:\n${out.split('\n').slice(-18).join('\n')}`);
  }
  // 只看真正的错误行。注意不要用宽泛的 /error/i —— 构建日志里 SvelteKit 的
  // fallback 文件名就叫 error.svelte.js，会被误判成错误。
  const errLines = out.split('\n').filter(
    (l) => /^\s*(error|Error)[:\s]/.test(l) || /\bError:/.test(l) || /✗/.test(l),
  );
  need(errLines.length === 0, `构建输出含错误:\n${errLines.slice(0, 6).join('\n')}`);
  return '无错误';
});

run('D2 静态产物存在', () => {
  need(existsSync(join(ROOT, 'build/index.html')), 'build/index.html 不存在');
  return 'build/index.html 已生成';
});

console.log('\n【E. 导出产物】');
run('E1 14 个预设 SVG 结构合法', () => {
  const bad = [];
  for (const p of JSON.parse(sh(`node -e "
    import('./src/lib/parametric/index.js').then(m=>console.log(JSON.stringify(m.PRESETS.map(x=>x.id))))"`))) {
    const svg = sh(`node -e "
      import('./src/lib/parametric/index.js').then(m=>{
        const p=m.PRESET_BY_ID['${p}'];process.stdout.write(m.generate(p.params).svg);
      })"`);
    if (!svg.startsWith('<svg') || !svg.endsWith('</svg>')) bad.push(`${p}: 首尾标签`);
    if (!svg.includes('xmlns="http://www.w3.org/2000/svg"')) bad.push(`${p}: 缺 xmlns`);
    if (!/viewBox="0 0 \d+ \d+"/.test(svg)) bad.push(`${p}: 缺 viewBox`);
    const open = (svg.match(/<(circle|ellipse|rect|path|line|g)\b/g) || []).length;
    const close = (svg.match(/\/>|<\/(circle|ellipse|rect|path|line|g)>/g) || []).length;
    if (open !== close) bad.push(`${p}: 标签不配对 ${open}/${close}`);
  }
  need(bad.length === 0, bad.join('; '));
  return '14/14 通过';
});

const failed = results.filter((r) => !r.pass);
console.log(`\n═══ 结果：${results.length - failed.length}/${results.length} 通过 ═══`);
if (failed.length) {
  console.log('\n未通过项：');
  for (const f of failed) console.log(`  - ${f.label}: ${f.note}`);
}
console.log('');
process.exit(failed.length ? 1 : 0);
