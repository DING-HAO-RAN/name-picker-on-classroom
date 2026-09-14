# 直接 spawn release13 解包版（剔除 ELECTRON_RUN_AS_NODE，--disable-gpu），
# 捕获 stdout/stderr 与退出码，定位启动失败原因
import os
import subprocess
import time

root = r'D:\桌面\项目‘\抽取器'
exe = os.path.join(root, 'release14', 'win-unpacked', 'NamePicker.exe')

env = dict(os.environ)
env.pop('ELECTRON_RUN_AS_NODE', None)
env['ELECTRON_ENABLE_LOGGING'] = '1'

proc = subprocess.Popen(
    [exe, '--no-sandbox', '--disable-gpu', '--disable-gpu-sandbox', '--disable-dev-shm-usage',
     '--user-data-dir=' + os.path.join(os.environ.get('TEMP', root), 'np-lockdiag-temp')],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    env=env,
)

time.sleep(8)
alive = proc.poll() is None
lines = [f'alive={alive}']
if not alive:
    lines.append(f'returncode={proc.returncode}')

# 关闭再取输出
try:
    if alive:
        proc.kill()
    out, err = proc.communicate(timeout=5)
    lines.append('STDOUT:')
    lines.append(out.decode('utf-8', errors='replace')[:3000])
    lines.append('STDERR:')
    lines.append(err.decode('utf-8', errors='replace')[:3000])
except Exception as error:
    lines.append(f'collect error: {error}')

out_path = os.path.join(root, '.workbuddy', 'r14-launch-tempdir-log.txt')
with open(out_path, 'w', encoding='utf-8') as handle:
    handle.write('\n'.join(lines))
print('done')
