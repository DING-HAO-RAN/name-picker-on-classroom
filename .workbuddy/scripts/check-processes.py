# 列出正在运行的 NamePicker / Electron 相关进程与窗口标题
import os

lines = []
for pid_entry in os.scandir('C:/Users/17819/AppData/Local/Temp'):
    pass  # 占位避免空循环警告

import ctypes
import ctypes.wintypes

# 简单方式：用 tasklist
result = os.popen('tasklist /FI "IMAGENAME eq NamePicker.exe" /FO CSV').read()
lines.append('--- NamePicker.exe processes ---')
lines.append(result)

result2 = os.popen('tasklist /FO CSV | findstr /I "NamePicker"').read()
lines.append('--- any NamePicker rows ---')
lines.append(result2)

out_path = r'D:\桌面\项目‘\抽取器\.workbuddy\process-check.txt'
with open(out_path, 'w', encoding='utf-8') as handle:
    handle.write('\n'.join(lines))
print('written')
