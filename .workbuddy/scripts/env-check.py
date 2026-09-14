# 打印 ELECTRON/CHROME 相关环境变量（写入文件供读取）
import os

lines = []
for key, value in os.environ.items():
    if 'ELECTRON' in key.upper() or 'CHROME' in key.upper():
        lines.append(f'{key}={value}')
out = r'D:\桌面\项目‘\抽取器\.workbuddy\env-check-clean.txt'
with open(out, 'w', encoding='utf-8') as handle:
    handle.write('\n'.join(lines) if lines else 'NONE')
print('done')
