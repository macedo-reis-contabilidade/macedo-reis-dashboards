import re, sys
MAP = {
 # texto
 '#E6EBF2':'var(--text)','#D7DEE8':'var(--text)','#D6DCE6':'var(--text)','#C9D3E0':'var(--text)',
 '#B9C2D0':'var(--text-2)','#B6C7DA':'var(--text-2)','#A9B2C2':'var(--text-2)','#9AA8BE':'var(--text-2)',
 '#8A93A6':'var(--text-muted)','#6E7787':'var(--text-dim)','#6B7385':'var(--text-dim)',
 # marca
 '#8AAEC8':'var(--brand-light)','#C5D8E8':'var(--brand-pale)','#5B82A6':'var(--brand-primary)',
 # estado
 '#E06C6C':'var(--err)','#E06C75':'var(--err)','#3FB07A':'var(--ok)','#7FBF8E':'var(--ok)','#5FC698':'var(--ok)','#E3B341':'var(--warn)',
 # superfícies escuras
 '#141A22':'var(--surface)','#0F1620':'var(--surface)','#10161F':'var(--surface)','#0D131C':'var(--surface)','#0B0F14':'var(--bg)',
}
RGBA = [
 (r'rgba\(255,\s*255,\s*255,\s*\.?0?\.?(025|03|035|04|045)\)', 'var(--fill-1)'),
 (r'rgba\(255,\s*255,\s*255,\s*\.?0?\.?(05|06|07|08)\)', 'var(--line)'),   # .08 é a borda fina mais usada
 (r'rgba\(255,\s*255,\s*255,\s*\.?0?\.?(10|1|12|13|14)\)', 'var(--fill-3)'),
 (r'rgba\(255,\s*255,\s*255,\s*\.?0?\.?(22|25)\)', 'var(--line-strong)'),
 (r'rgba\((8,12,18|6,10,16|4,8,14),\s*\.?0?\.?(72|78|8)\)', 'var(--overlay)'),
 (r'rgba\(15,\s*22,\s*32,\s*\.92\)', 'var(--pop)'),
]
def conv(s):
    for k,v in MAP.items(): s = re.sub(re.escape(k)+r'\b', v, s, flags=re.I)
    for pat,v in RGBA: s = re.sub(pat, v, s)
    return s
for f in sys.argv[1:]:
    s=open(f).read(); n=conv(s); open(f,'w').write(n)
    rest = re.findall(r'#[0-9A-Fa-f]{6}\b|rgba\(255,\s*255,\s*255[^)]*\)|rgba\((?:8,12,18|6,10,16|4,8,14)[^)]*\)', n)
    print(f, 'restantes:', len(rest), sorted(set(rest))[:12])
