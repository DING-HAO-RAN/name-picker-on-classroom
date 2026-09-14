# 检查 NamePicker 的 userData 目录：定位 state.json、权限与最近写入时间
import os
import glob

candidates = []
appdata = os.environ.get('APPDATA', '')
localappdata = os.environ.get('LOCALAPPDATA', '')
for base in (appdata, localappdata):
    if not base:
        continue
    for name in ('NamePicker', 'name-picker', 'namepicker', '名字抽取器'):
        path = os.path.join(base, name)
        candidates.append(path)

print('APPDATA =', appdata)
for path in candidates:
    if os.path.isdir(path):
        print('EXISTS :', path)
        for entry in os.scandir(path):
            print('   ', entry.name, entry.stat().st_size, entry.stat().st_mtime)
        state = os.path.join(path, 'state.json')
        if os.path.isfile(state):
            print('    state.json size:', os.path.getsize(state))
            # 只打印前 600 字符，避免泄露隐私内容
            with open(state, 'r', encoding='utf-8') as handle:
                print('    head:', handle.read(600))
            # 试写检测：目录是否可写
            try:
                probe = os.path.join(path, '.write-probe')
                with open(probe, 'w') as handle:
                    handle.write('x')
                os.remove(probe)
                print('    WRITABLE: yes')
            except OSError as error:
                print('    WRITABLE: NO ->', error)
    else:
        print('MISSING:', path)
