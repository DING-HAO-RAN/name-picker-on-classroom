# 校验 release16 完整性与新功能代码
import os

root = r'D:\桌面\项目‘\抽取器'
unpacked = os.path.join(root, 'release16', 'win-unpacked')
asar = os.path.join(unpacked, 'resources', 'app.asar')

lines = []
count = sum(len(files) for _, _, files in os.walk(unpacked))
lines.append(f'unpacked file count: {count}')
lines.append(f'icudtl.dat: {os.path.isfile(os.path.join(unpacked, "icudtl.dat"))}')
for name in os.listdir(os.path.join(root, 'release16')):
    full = os.path.join(root, 'release16', name)
    if name.endswith('.exe'):
        lines.append(f'{name} {os.path.getsize(full) / 1048576:.1f}MB')

with open(asar, 'rb') as handle:
    content = handle.read()
for marker in (b'card-draw__back-name', b'autoStarUpgrade', b'star-filter-button'):
    lines.append(f'{marker.decode()}: {content.find(marker) >= 0}')

out = os.path.join(root, '.workbuddy', 'r16-verify.txt')
with open(out, 'w', encoding='utf-8') as handle:
    handle.write('\n'.join(lines))
print('done')
