"""把打包产物发布为 GitHub Release（一次性脚本，保留作发布痕迹）。

用法（令牌只经环境变量传入，不写入任何文件）：
    set GITHUB_TOKEN=xxxx
    python .workbuddy/scripts/publish-github-release.py

脚本会：创建 tag 对应的 Release → 逐个上传 NSIS 安装包与 portable 包 →
把 Release 页面地址与附件清单写入 .workbuddy/publish-log.txt。
"""

import http.client
import json
import os
import sys
import time
import urllib.parse

OWNER = 'DING-HAO-RAN'
REPO = 'name-picker-on-classroom'
TAG = 'v1.0.0'

project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
output_dir = os.path.join(project_root, os.environ.get('NAME_PICKER_OUTPUT_DIR', 'release3'))
log_path = os.path.join(project_root, '.workbuddy', 'publish-log.txt')
log_lines = []

ASSETS = [
    ('NamePicker Setup-1.0.0.exe', 'NSIS 安装包'),
    ('NamePicker-1.0.0.exe', 'portable 便携包'),
]

RELEASE_BODY = """名字抽取器首个公开发布版本，面向课堂离线随机点名，适配学校多媒体大屏的触摸操作。

## 下载哪个？

| 文件 | 说明 |
| --- | --- |
| `NamePicker Setup-1.0.0.exe`（安装包） | 大多数情况选这个。可选择安装位置、创建桌面/开始菜单快捷方式，能在「应用和功能」里卸载。 |
| `NamePicker-1.0.0.exe`（便携包） | 不需要安装权限，双击即可运行，可直接放进 U 盘随堂携带。 |

两者功能完全一致，装一个即可。

## SHA-256 校验

下载后可核对下面这组哈希：

```text
NamePicker Setup-1.0.0.exe  6f34a811caa913c4b0b16c1fe63974174747f172b845afd0c0f909b99fd884e3
NamePicker-1.0.0.exe        723b5d6c615c63ae1f72b446ee5069338d29ccac2f4ca39df603c548458f3da4
```

Windows 校验命令：

```powershell
certutil -hashfile "NamePicker Setup-1.0.0.exe" SHA256
```

## 本版本包含

- 自绘标题栏：窗口无原生边框，最小化 / 最大化 / 关闭三个按钮跟随当前主题，浅色深色都适配
- 抽取结果全屏停留时长默认 3 秒，可在设置中调整为 1.5～10 秒
- 设置抽屉里的「学生权重」和「最近抽取」默认折叠，打开时不至于铺满整屏
- 抽取动画改为缓出节奏加随机抖动：名字切换由快到慢且间隔不均匀，落定前更有悬念
- 名单导入支持 TXT / CSV / XLSX，支持抽取人数、学生权重、排除本轮、最近抽取记录
- 名单、权重与历史记录只写本机磁盘，不联网、无遥测、无自动更新

## 使用前请阅读

- **没有代码签名**：本仓库没有配置签名证书，两个 exe 的 Authenticode 状态都是 `NotSigned`。Windows SmartScreen 会提示「未知发布者」，需要点「更多信息 → 仍要运行」才能启动；有内网分发需求的话建议自行签名后重打包。
- **便携包缺少运行时验证证据**：安装包对应的解包版已通过 7 项启动检查（标题、无边框、预加载未暴露 Node 对象、标题栏按钮可用、抽屉布局、停留时长默认值），但当前开发环境无法稳定启动便携包验证 UI 流程，这部分需要在使用环境中补验。
- **验证环境单一**：只在 Windows 11 x64（内部版本 26200）上验证过，Windows 10 未实测。
- **受限模式打包**：打包环境缺少资源编辑所需的符号链接权限，跳过了可执行文件的资源改写（版本号、图标元数据），不影响功能。

## 系统要求

Windows 10 / 11 x64，无需额外安装运行时。

## 源码

README 里有完整的开发、测试与打包步骤，界面改动的验收证据记录在 `docs/release-checklist.md`。
"""


def log(line):
    log_lines.append(line)
    with open(log_path, 'w', encoding='utf-8') as handle:
        handle.write('\n'.join(log_lines) + '\n')
    print(line, flush=True)


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
    except Exception:  # noqa: BLE001 - 报错时原文已足够诊断
        parsed = raw.decode('utf-8', 'replace')
    return response.status, parsed


def find_existing_release():
    status, payload = request_json('GET', f'/repos/{OWNER}/{REPO}/releases/tags/{TAG}')
    return payload if status == 200 else None


def upload_asset(upload_template, file_path, label):
    base_url = upload_template.split('{?')[0]
    path = base_url.split('uploads.github.com', 1)[1]
    name = os.path.basename(file_path)
    full_path = f'{path}?{urllib.parse.urlencode({"name": name, "label": label})}'
    size = os.path.getsize(file_path)

    conn = http.client.HTTPSConnection('uploads.github.com', timeout=600)
    conn.putrequest('POST', full_path)
    conn.putheader('Authorization', f'Bearer {TOKEN}')
    conn.putheader('User-Agent', 'name-picker-publish')
    conn.putheader('Accept', 'application/vnd.github+json')
    conn.putheader('Content-Type', 'application/octet-stream')
    conn.putheader('Content-Length', str(size))
    conn.endheaders()

    sent = 0
    with open(file_path, 'rb') as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            conn.send(chunk)
            sent += len(chunk)
    response = conn.getresponse()
    raw = response.read()
    conn.close()
    return response.status, sent, raw


def main():
    global TOKEN
    TOKEN = os.environ.get('GITHUB_TOKEN')
    if not TOKEN:
        log('缺少 GITHUB_TOKEN 环境变量，退出')
        return 1

    for file_name, _label in ASSETS:
        target = os.path.join(output_dir, file_name)
        if not os.path.isfile(target):
            log(f'产物缺失：{target}')
            return 1
        log(f'待上传 {file_name} | {os.path.getsize(target):,} 字节')

    release = find_existing_release()
    if release:
        log(f'Release 已存在，复用 id={release.get("id")}')
    else:
        status, payload = request_json(
            'POST',
            f'/repos/{OWNER}/{REPO}/releases',
            {
                'tag_name': TAG,
                'name': '名字抽取器 v1.0.0',
                'body': RELEASE_BODY,
                'draft': False,
                'prerelease': False,
            },
        )
        if status < 200 or status >= 300:
            log(f'创建 Release 失败 status={status}')
            log(json.dumps(payload, ensure_ascii=False)[:800])
            return 1
        release = payload
        log(f'Release 已创建 id={release.get("id")}')

    upload_template = release.get('upload_url')
    log(f'Release 页面：{release.get("html_url")}')

    failures = 0
    for file_name, label in ASSETS:
        target = os.path.join(output_dir, file_name)
        started = time.time()
        status, sent, raw = upload_asset(upload_template, target, label)
        elapsed = time.time() - started
        if status >= 200 and status < 300:
            log(
                f'UPLOAD OK | {file_name} | {sent:,} 字节 | {elapsed:.1f}s '
                f'| {sent / elapsed / 1024 / 1024:.2f} MB/s'
            )
        else:
            failures += 1
            log(f'UPLOAD FAIL | {file_name} | status={status} | {raw.decode("utf-8", "replace")[:300]}')

    status, published = request_json('GET', f'/repos/{OWNER}/{REPO}/releases/tags/{TAG}')
    if status == 200:
        log('远端附件清单：')
        for asset in published.get('assets', []):
            log(f'  - {asset.get("name")} | {asset.get("size"):,} 字节 | 下载数 {asset.get("download_count")}')
    log('SUMMARY | failures=' + str(failures))
    return 0 if failures == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
