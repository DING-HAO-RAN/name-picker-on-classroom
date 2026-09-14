# 检查 release13 打包状态：退出标记文件、产物 exe、目录文件数
import os

root = r'D:\桌面\项目‘\抽取器'
exit_file = os.path.join(root, '.workbuddy', 'package-r13-exit.txt')
release13 = os.path.join(root, 'release13')

lines = []
if os.path.isfile(exit_file):
    with open(exit_file, 'r', encoding='utf-8', errors='replace') as handle:
        lines.append('EXIT FILE: ' + handle.read().strip())
else:
    lines.append('EXIT FILE: not written (still running?)')

if os.path.isdir(release13):
    count = sum(len(files) for _, _, files in os.walk(release13))
    lines.append(f'release13 file count: {count}')
    for name in os.listdir(release13):
        if name.endswith('.exe') and 'unpacked' not in name:
            size = os.path.getsize(os.path.join(release13, name))
            lines.append(f'  {name} {size / 1048576:.1f}MB')
else:
    lines.append('release13 dir missing')

out = os.path.join(root, '.workbuddy', 'pkg-r13-status.txt')
with open(out, 'w', encoding='utf-8') as handle:
    handle.write('\n'.join(lines))
print('done')
