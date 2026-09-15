# 尝试从 Windows 凭据管理器读取 github.com 的已存凭据（非交互，5 秒超时）
import subprocess

query = 'url=https://github.com\n\n'
try:
    result = subprocess.run(
        ['git', 'credential', 'fill'],
        input=query,
        capture_output=True,
        text=True,
        timeout=8,
        cwd=r'D:\桌面\项目‘\抽取器',
    )
    has_password = 'password=' in result.stdout
    username = ''
    for line in result.stdout.splitlines():
        if line.startswith('username='):
            username = line.split('=', 1)[1]
    out = f'exit={result.returncode} has_password={has_password} username={username[:4]}***'
except subprocess.TimeoutExpired:
    out = 'TIMEOUT: credential manager tried to open interactive UI'
except Exception as error:
    out = f'ERROR: {error}'

with open(r'D:\桌面\项目‘\抽取器\.workbuddy\cred-fill.txt', 'w', encoding='utf-8') as handle:
    handle.write(out)
print('done')
