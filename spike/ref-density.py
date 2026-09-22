#!/usr/bin/env python3
"""
参考图 vs 引擎产出的客观比对 —— v2

修正了两个方法论错误：
  1. 极性错：一律取"深/浅中较小的当墨"是错的。必须按引擎预设的配色判断
     前景是深色还是浅色（bg 深 → 前景是浅色）。
  2. 白边污染：参考图多为截图，四周常有纯色留白，会把占比算歪。
     改为裁掉四周 5% 再统计。

用法： uv run --with pillow python3 spike/ref-density.py
"""
import json
import os
import sys

try:
    from PIL import Image
except ImportError:
    print("需要 pillow：uv run --with pillow python3 spike/ref-density.py")
    sys.exit(2)

HOME = os.path.expanduser("~")
REFS = os.path.join(HOME, "Desktop", "参数化几何图形参考图")
HERE = os.path.dirname(os.path.abspath(__file__))

MAP = {
    "ref-01": "12782d6d72a27ca3ae18b763e3e9e632.jpg",
    "ref-02": "2155cb61359ba356980da44ba4aa3580.jpg",
    "ref-03": "350342e75cea9c83a97a7034596e4ba1.jpg",
    "ref-04": "36c4f9ee2831686aae0adb0ad04dba4e.jpg",
    "ref-05": "406823e4ac2619330bcf814d0f3fbd5c.jpg",
    "ref-06": "51d528cd6c7bcdf3f6a7fe9b1cd6b12f.jpg",
    "ref-07": "7c61a21bafd07cded9ca4b2c6558ea5a.jpg",
    "ref-08": "8b7c5dee042e0459a57827fa4030be68.jpg",
    "ref-09": "a12ba5d1a1d57bd782dd13dfc6fef345.jpg",
    "ref-10": "a4df17a494194f5ae1ad6533680c5f5d.jpg",
    "ref-11": "a96d68e757514ba14435c225537e4c35.jpg",
    "ref-12": "bfba7ef89fbb61824a493a97c8859763.jpg",
    "ref-13": "cf6b94d95fb9b19e311670a77aed31f0.jpg",
    "ref-14": "d6c9147f2abda54fc4e4c71f015abfa2.jpg",
}

# 每个预设的背景色（取自 presets.js 的 palette[0]）→ 决定参考图的"墨"是深还是浅
PRESET_BG = {
    "ref-01": "light", "ref-02": "dark", "ref-03": "dark", "ref-04": "dark",
    "ref-05": "light", "ref-06": "light", "ref-07": "dark", "ref-08": "dark",
    "ref-09": "dark", "ref-10": "light", "ref-11": "light", "ref-12": "light",
    "ref-13": "light", "ref-14": "light",
}

with open(os.path.join(HERE, "engine-out", "coverage.json"), encoding="utf-8") as f:
    ENGINE = json.load(f)

TRIM = 0.05  # 裁掉四周 5%，消除截图白边


def fractions(path):
    """返回 (深色占比, 浅色占比)，已裁边。"""
    im = Image.open(path).convert("L")
    w, h = im.size
    dx, dy = int(w * TRIM), int(h * TRIM)
    im = im.crop((dx, dy, w - dx, h - dy))
    w2, h2 = im.size
    scale = 240 / max(w2, h2)
    if scale < 1:
        im = im.resize((max(1, int(w2 * scale)), max(1, int(h2 * scale))))
    px = im.getdata()
    n = len(px)
    dark = sum(1 for v in px if v < 128) / n
    return dark * 100, (1 - dark) * 100


print(f"{'ref':7s} {'背景':>5s} {'深色':>7s} {'浅色':>7s} {'参考前景':>8s} {'引擎覆盖':>8s} {'差异':>8s}  判定")
print("-" * 74)
rows = []
for ref, name in MAP.items():
    p = os.path.join(REFS, name)
    if not os.path.exists(p):
        print(f"{ref:7s} 缺文件")
        continue
    dark, light = fractions(p)
    bg = PRESET_BG.get(ref, "light")
    # 背景浅 → 前景是深色；背景深 → 前景是浅色
    ink = dark if bg == "light" else light
    eng = ENGINE.get(ref)
    if eng is None:
        continue
    diff = ink - eng
    if abs(diff) <= 6:
        verdict = "一致 ✓"
    elif abs(diff) <= 18:
        verdict = "接近 ~"
    elif diff > 0:
        verdict = "偏稀 ✗"
    else:
        verdict = "偏密 ✗"
    rows.append((ref, ink, eng, diff, verdict))
    print(f"{ref:7s} {bg:>5s} {dark:6.1f}% {light:6.1f}% {ink:7.1f}% {eng:7.1f}% {diff:+7.1f}  {verdict}")

if rows:
    print("-" * 74)
    ok = [r for r in rows if abs(r[3]) <= 6]
    close = [r for r in rows if 6 < abs(r[3]) <= 18]
    bad = [r for r in rows if abs(r[3]) > 18]
    print(f"一致 {len(ok)} 组 · 接近 {len(close)} 组 · 偏差大 {len(bad)} 组")
    if bad:
        print("\n需要修的（|差异| > 18 个百分点）：")
        for ref, ink, eng, diff, v in bad:
            direction = "偏稀，要加大/加密" if diff > 0 else "偏密，要减小/减疏"
            print(f"  {ref}: 参考 {ink:.1f}% vs 引擎 {eng:.1f}%  ({diff:+.1f}) → {direction}")
