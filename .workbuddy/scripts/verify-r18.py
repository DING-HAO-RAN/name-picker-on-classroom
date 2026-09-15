# 校验 release18 完整性与版本号
import os
import zipfile

root = r'D:\桌面\项目‘\抽取器'
unpacked = os.path.join(root, 'release18', 'win-unpacked')

lines = []
count = sum(len(files) for _, _, files in os.walk(unpacked))
lines.append(f'unpacked file count: {count}')
lines.append(f'icudtl.dat: {os.path.isfile(os.path.join(unpacked, "icudtl.dat"))}')
for name in os.listdir(os.path.join(root, 'release18')):
    full = os.path.join(root, 'release18', name)
    if name.endswith('.exe'):
        lines.append(f'{name} {os.path.getsize(full) / 1048576:.1f}MB')

asar = os.path.join(unpacked, 'resources', 'app.asar')
with open(asar, 'rb') as handle:
    content = handle.read()
lines.append(f'back-mark in asar: {content.find(b"card-draw__back-mark") >= 0}')
lines.append(f'cardFlipReveal in asar: {content.find(b"cardFlipReveal") >= 0}')
lines.append(f'old back-name gone: {content.find(b"card-draw__back-name") < 0}')

out = os.path.join(root, '.workbuddy', 'r18-verify.txt')
with open(out, 'w', encoding='utf-8') as handle:
    handle.write('\n'.join(lines))
print('done')
