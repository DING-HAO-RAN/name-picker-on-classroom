# 校验 release19：完整性 + 无悬浮球残留 + 版本号
import os

root = r'D:\桌面\项目‘\抽取器'
unpacked = os.path.join(root, 'release19', 'win-unpacked')
asar = os.path.join(unpacked, 'resources', 'app.asar')

lines = []
count = sum(len(files) for _, _, files in os.walk(unpacked))
lines.append(f'unpacked file count: {count}')
lines.append(f'icudtl.dat: {os.path.isfile(os.path.join(unpacked, "icudtl.dat"))}')
for name in os.listdir(os.path.join(root, 'release19')):
    if name.endswith('.exe'):
        lines.append(f'{name} {os.path.getsize(os.path.join(root, "release19", name)) / 1048576:.1f}MB')

with open(asar, 'rb') as handle:
    content = handle.read()
lines.append(f'floatingControl gone: {content.find(b"floatingControl") < 0}')
lines.append(f'floating-ball gone: {content.find(b"floating-ball") < 0}')
lines.append(f'showFloatingBall gone: {content.find(b"showFloatingBall") < 0}')
lines.append(f'cardFlipReveal present: {content.find(b"cardFlipReveal") >= 0}')

out = os.path.join(root, '.workbuddy', 'r19-verify.txt')
with open(out, 'w', encoding='utf-8') as handle:
    handle.write('\n'.join(lines))
print('done')
