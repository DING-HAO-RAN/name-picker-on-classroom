# 对比 release12（好包）与 release13（坏包）的 win-unpacked 文件清单差异
import os

root = r'D:\桌面\项目‘\抽取器'
r12 = os.path.join(root, 'release12', 'win-unpacked')
r13 = os.path.join(root, 'release13', 'win-unpacked')

def listing(base):
    items = {}
    for dirpath, dirnames, filenames in os.walk(base):
        for name in filenames:
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, base)
            items[rel] = os.path.getsize(full)
    return items

m12 = listing(r12) if os.path.isdir(r12) else {}
m13 = listing(r13) if os.path.isdir(r13) else {}

lines = [f'release12 files: {len(m12)}', f'release13 files: {len(m13)}', '']
missing = sorted(set(m12) - set(m13))
lines.append(f'missing in release13 ({len(missing)}):')
for item in missing[:40]:
    lines.append(f'  {item} ({m12[item]} bytes)')

out = os.path.join(root, '.workbuddy', 'pkg-diff.txt')
with open(out, 'w', encoding='utf-8') as handle:
    handle.write('\n'.join(lines))
print('done')
