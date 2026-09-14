# 校验 release14 包完整性：文件数、icudtl.dat 存在、exe 大小
import os

root = r'D:\桌面\项目‘\抽取器'
r14 = os.path.join(root, 'release14', 'win-unpacked')

lines = []
if os.path.isdir(r14):
    count = sum(len(files) for _, _, files in os.walk(r14))
    lines.append(f'release14/win-unpacked file count: {count}')
    icu = os.path.join(r14, 'icudtl.dat')
    lines.append(f'icudtl.dat exists: {os.path.isfile(icu)}')
    for name in os.listdir(os.path.join(root, 'release14')):
        full = os.path.join(root, 'release14', name)
        if name.endswith('.exe'):
            lines.append(f'{name} {os.path.getsize(full) / 1048576:.1f}MB')
else:
    lines.append('release14/win-unpacked missing')

out = os.path.join(root, '.workbuddy', 'r14-verify.txt')
with open(out, 'w', encoding='utf-8') as handle:
    handle.write('\n'.join(lines))
print('done')
