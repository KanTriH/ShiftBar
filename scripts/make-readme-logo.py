"""生成 README 用的 logo：docs/assets/shiftbar-logo-{light,dark}.svg

为什么需要它：public/brand/shiftbar-logo-*.svg 里的 "ShiftBar" 字标是用 Fredoka 字体写的"文字"，
GitHub 显示 SVG 图片时不会加载网页字体，字标会退回成别的字体，和设计稿不一样。
这个脚本把字标用 Fredoka 的真实字形转成矢量路径，图形部分保持不变，所以在哪里显示都一样。
public/brand 里的原文件不会被修改。

用法（在仓库根目录）：
    pip install fonttools
    python scripts/make-readme-logo.py
"""
import os
import re
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, 'node_modules', '@fontsource', 'fredoka', 'files', 'fredoka-latin-600-normal.woff')
if not os.path.exists(FONT):
    sys.exit('找不到 Fredoka 字体文件，请先在仓库根目录运行 npm install')

font = TTFont(FONT)
cmap = font.getBestCmap()
glyphs = font.getGlyphSet()
units_per_em = font['head'].unitsPerEm


def outline(text, x, y, size):
    """把一行文字转成 SVG 路径。返回 (路径 d, 文字宽度)。不处理字距调整（kerning），ShiftBar 这个词影响很小。"""
    scale = size / units_per_em
    cursor = x
    parts = []
    for ch in text:
        name = cmap[ord(ch)]
        pen = SVGPathPen(glyphs, ntos=lambda v: ('%.2f' % v).rstrip('0').rstrip('.'))
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, cursor, y)))
        parts.append(pen.getCommands())
        cursor += glyphs[name].width * scale
    return ''.join(parts), cursor - x


os.makedirs(os.path.join(ROOT, 'docs', 'assets'), exist_ok=True)
for variant in ('light', 'dark'):
    src = open(os.path.join(ROOT, 'public', 'brand', f'shiftbar-logo-{variant}.svg'), encoding='utf-8').read()
    src = re.sub(r'<metadata>.*?</metadata>', '', src, flags=re.S)  # 内容来源凭证元数据，改过文件后它也就失效了
    src = src.replace(' xmlns:c2pa="http://c2pa.org/manifest"', '')
    m = re.search(r'<text x="76" y="45"[^>]*fill="(#[0-9a-fA-F]+)"[^>]*>ShiftBar</text>', src)
    if not m:
        sys.exit('原 logo 里没找到 ShiftBar 字标，logo 的结构变了，需要调整这个脚本')
    d, width = outline('ShiftBar', 76, 45, 40)
    out = src.replace(m.group(0), f'<path d="{d}" fill="{m.group(1)}"/>')
    canvas = int(76 + width + 4)  # 画布收紧到字标的实际宽度，放在 README 里居中才不会偏
    out = out.replace('width="248"', f'width="{canvas}"').replace('viewBox="0 0 248 60"', f'viewBox="0 0 {canvas} 60"')
    out = out.replace('><', '>\n<')
    target = os.path.join(ROOT, 'docs', 'assets', f'shiftbar-logo-{variant}.svg')
    open(target, 'w', encoding='utf-8', newline='\n').write(out + '\n')
    print('已生成', os.path.relpath(target, ROOT))
