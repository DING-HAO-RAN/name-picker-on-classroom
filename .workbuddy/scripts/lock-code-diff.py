# 提取两个版本打包产物里的主进程 index.js 开头（对比单实例锁逻辑）
import os

root = r'D:\桌面\项目‘\抽取器'
out_lines = []

for version in ('release12', 'release14'):
    asar = os.path.join(root, version, 'win-unpacked', 'resources', 'app.asar')
    with open(asar, 'rb') as handle:
        content = handle.read()
    # 主进程 index.js 的代码里找单实例锁附近片段
    marker = b'requestSingleInstanceLock'
    index = content.find(marker)
    out_lines.append(f'=== {version} (marker at {index}) ===')
    if index >= 0:
        snippet = content[max(0, index - 400): index + 600].decode('utf-8', errors='replace')
        out_lines.append(snippet)
    out_lines.append('')

out_path = os.path.join(root, '.workbuddy', 'lock-code-diff.txt')
with open(out_path, 'w', encoding='utf-8') as handle:
    handle.write('\n'.join(out_lines))
print('done')
