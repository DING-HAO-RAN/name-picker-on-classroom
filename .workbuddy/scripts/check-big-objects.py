# 检查全部提交历史中是否有超过 100MB 的对象（GitHub 限制）
import subprocess

root = r'D:\桌面\项目‘\抽取器'
result = subprocess.run(
    ['git', 'rev-list', '--objects', '--all'],
    capture_output=True, text=True, cwd=root,
)
lines = result.stdout.splitlines()

# 用 git cat-file --batch-check 查对象大小
objs = {}
for line in lines:
    parts = line.split(' ', 1)
    if len(parts) == 2:
        objs[parts[0]] = parts[1]

batch_input = '\n'.join(objs.keys()) + '\n'
result2 = subprocess.run(
    ['git', 'cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'],
    input=batch_input, capture_output=True, text=True, cwd=root,
)

big = []
for line in result2.stdout.splitlines():
    parts = line.split(' ')
    if len(parts) == 3 and parts[1] == 'blob':
        size = int(parts[2])
        if size > 90 * 1024 * 1024:
            big.append((parts[0], objs.get(parts[0], '?'), size))

out = r'D:\桌面\项目‘\抽取器\.workbuddy\big-objects.txt'
with open(out, 'w', encoding='utf-8') as handle:
    if big:
        for sha, path, size in big:
            handle.write(f'{path} {size / 1048576:.1f}MB\n')
    else:
        handle.write('NO objects over 90MB in history')
print('done')
