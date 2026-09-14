# 列出 NamePicker 相关进程
import subprocess

result = subprocess.run(
    ['tasklist', '/FI', 'IMAGENAME eq NamePicker.exe', '/FO', 'CSV'],
    capture_output=True, text=True,
)
out = r'D:\桌面\项目‘\抽取器\.workbuddy\proc-list-clean.txt'
with open(out, 'w', encoding='utf-8') as handle:
    handle.write(result.stdout)
    handle.write('\nSTDERR:\n')
    handle.write(result.stderr)
print('done', result.returncode)
