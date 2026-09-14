# 读取 roster-state.json 的结构摘要（不输出学生姓名等隐私内容）
import json
import os

state_path = os.path.join(
    os.environ.get('APPDATA', ''), 'name-picker', 'roster-state.json'
)

if not os.path.isfile(state_path):
    print('MISSING:', state_path)
else:
    print('size:', os.path.getsize(state_path))
    try:
        with open(state_path, 'r', encoding='utf-8') as handle:
            data = json.load(handle)
        print('top keys:', sorted(data.keys()))
        students = data.get('students', [])
        print('students:', len(students))
        if students:
            first = students[0]
            print('first student keys:', sorted(first.keys()))
            bad_star = [s for s in students if not isinstance(s.get('star'), int)]
            bad_count = [s for s in students if not isinstance(s.get('drawCount'), int)]
            print('students with non-int star:', len(bad_star))
            print('students with non-int drawCount:', len(bad_count))
        settings = data.get('settings', {})
        print('settings keys:', sorted(settings.keys()))
        branding = settings.get('branding')
        if isinstance(branding, dict):
            print('branding keys:', sorted(branding.keys()))
            print('iconData length:', len(branding.get('iconData') or ''))
        sound = settings.get('soundDrawnData')
        print('soundDrawnData length:', len(sound) if isinstance(sound, str) else None)
        pity = settings.get('pityPool')
        print('pityPool:', pity if not isinstance(pity, dict) else {k: (v if k != 'studentIds' else len(v)) for k, v in pity.items()})
        print('pityCounter:', settings.get('pityCounter'))
        presets = settings.get('weightPresets')
        print('weightPresets:', [p.get('name') for p in presets] if isinstance(presets, list) else None)
        print('history:', len(data.get('history', [])))
    except Exception as error:
        print('PARSE ERROR:', error)

# 目录可写探测
directory = os.path.dirname(state_path)
try:
    probe = os.path.join(directory, '.write-probe')
    with open(probe, 'w') as handle:
        handle.write('x')
    os.remove(probe)
    print('directory writable: yes')
except OSError as error:
    print('directory writable: NO ->', error)
