# 修正 v1.1.0 Release 附件名：NamePicker.Setup-1.1.0.exe -> NamePicker Setup-1.1.0.exe
import http.client
import json
import os

TOKEN = os.environ.get('GITHUB_TOKEN', '')
OWNER, REPO, TAG = 'DING-HAO-RAN', 'name-picker-on-classroom', 'v1.1.0'

conn = http.client.HTTPSConnection('api.github.com', timeout=60)
conn.request(
    'GET',
    f'/repos/{OWNER}/{REPO}/releases/tags/{TAG}',
    headers={
        'Authorization': f'Bearer {TOKEN}',
        'User-Agent': 'name-picker-publish',
        'Accept': 'application/vnd.github+json',
    },
)
resp = conn.getresponse()
release = json.loads(resp.read())
conn.close()

asset_id = None
for asset in release.get('assets', []):
    if asset.get('name') == 'NamePicker.Setup-1.1.0.exe':
        asset_id = asset.get('id')
        break

lines = []
if asset_id is None:
    lines.append('target asset not found')
else:
    conn = http.client.HTTPSConnection('api.github.com', timeout=60)
    body = json.dumps({'name': 'NamePicker Setup-1.1.0.exe'}).encode('utf-8')
    conn.request(
        'PATCH',
        f'/repos/{OWNER}/{REPO}/releases/assets/{asset_id}',
        body=body,
        headers={
            'Authorization': f'Bearer {TOKEN}',
            'User-Agent': 'name-picker-publish',
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'Content-Length': str(len(body)),
        },
    )
    resp = conn.getresponse()
    conn.close()
    lines.append(f'PATCH status={resp.status}')

out = r'D:\桌面\项目‘\抽取器\.workbuddy\asset-rename.txt'
with open(out, 'w', encoding='utf-8') as handle:
    handle.write('\n'.join(lines))
print('done')
