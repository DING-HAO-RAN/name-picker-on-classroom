"""发布后的收尾修正：统一附件文件名并同步 Release 说明。

GitHub 会把附件名里的空格替换成点（`NamePicker.Setup-1.0.0.exe`）。
这里把安装包附件改名为 `NamePicker-Setup-1.0.0.exe`，并把 Release 说明与
产物表格里的旧文件名一并替换，避免页面上的下载链接与说明不一致。
"""

import http.client
import json
import os
import sys

OWNER = 'DING-HAO-RAN'
REPO = 'name-picker-on-classroom'
TAG = 'v1.0.0'
OLD_NAME = 'NamePicker.Setup-1.0.0.exe'
NEW_NAME = 'NamePicker-Setup-1.0.0.exe'


def request_json(method, path, payload=None, host='api.github.com'):
    conn = http.client.HTTPSConnection(host, timeout=120)
    headers = {
        'Authorization': f'Bearer {TOKEN}',
        'User-Agent': 'name-picker-publish',
        'Accept': 'application/vnd.github+json',
    }
    body = None
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        headers['Content-Type'] = 'application/json; charset=utf-8'
    conn.request(method, path, body=body, headers=headers)
    response = conn.getresponse()
    raw = response.read()
    conn.close()
    try:
        parsed = json.loads(raw.decode('utf-8'))
    except Exception:  # noqa: BLE001 - 报错时原文足够诊断
        parsed = raw.decode('utf-8', 'replace')
    return response.status, parsed


def main():
    global TOKEN
    TOKEN = os.environ.get('GITHUB_TOKEN')
    if not TOKEN:
        print('缺少 GITHUB_TOKEN')
        return 1

    status, release = request_json('GET', f'/repos/{OWNER}/{REPO}/releases/tags/{TAG}')
    if status != 200:
        print('取 Release 失败 status=', status, release)
        return 1

    target = next((a for a in release.get('assets', []) if a.get('name') == OLD_NAME), None)
    if target:
        status, payload = request_json(
            'PATCH',
            f'/repos/{OWNER}/{REPO}/releases/assets/{target["id"]}',
            {'name': NEW_NAME, 'label': 'NSIS 安装包'},
        )
        print('重命名附件 status=', status, '->', payload.get('name') if isinstance(payload, dict) else payload)
    else:
        print('未找到待重命名附件，跳过')

    body = release.get('body', '')
    # 代码块、表格、反引号里的文件名都要替换，不能只处理带反引号的一处
    updated_body = body.replace('NamePicker Setup-1.0.0.exe', NEW_NAME)
    if updated_body != body:
        status, payload = request_json(
            'PATCH',
            f'/repos/{OWNER}/{REPO}/releases/{release["id"]}',
            {'body': updated_body},
        )
        print('更新说明 status=', status)

    status, published = request_json('GET', f'/repos/{OWNER}/{REPO}/releases/tags/{TAG}')
    if status == 200:
        print('Release 页面:', published.get('html_url'))
        for asset in published.get('assets', []):
            print(f'  - {asset.get("name")} | {asset.get("size"):,} 字节')
    return 0


if __name__ == '__main__':
    sys.exit(main())
