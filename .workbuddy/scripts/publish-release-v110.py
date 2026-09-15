"""发布 NamePicker v1.1.0 GitHub Release（复用 v1.0.0 发布脚本的结构）。

用法（令牌只经环境变量传入，不写入任何文件）：
    $env:GITHUB_TOKEN = 'ghp_xxx'
    python .workbuddy/scripts/publish-release-v110.py
"""

import http.client
import json
import os
import sys
import time
import urllib.parse

OWNER = 'DING-HAO-RAN'
REPO = 'name-picker-on-classroom'
TAG = 'v1.1.0'

project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
output_dir = os.path.join(project_root, os.environ.get('NAME_PICKER_OUTPUT_DIR', 'release18'))
log_path = os.path.join(project_root, '.workbuddy', 'publish-log-v110.txt')
log_lines = []

ASSETS = [
    ('NamePicker Setup-1.1.0.exe', 'NSIS 安装包'),
    ('NamePicker-1.1.0.exe', 'portable 便携包'),
]

RELEASE_BODY = """名字抽取器 v1.1.0：新增抽卡式抽取动画、星级系统与多项抽取能力。

## 下载哪个？

| 文件 | 说明 |
| --- | --- |
| `NamePicker Setup-1.1.0.exe`（安装包） | 大多数情况选这个。可选择安装位置、创建快捷方式，可在「应用和功能」里卸载。 |
| `NamePicker-1.1.0.exe`（便携包） | 不需要安装权限，双击即可运行，可放进 U 盘随堂携带。 |

两者功能完全一致，装一个即可。

## v1.1.0 新增

### 抽卡式抽取动画
- 星穹夜幕舞台：卡牌先从牌堆飞出落位，点击翻面揭晓（抬升-翻转-落定完整动作）
- **卡背与卡面同为该学生的星级配色**（1 白 / 2 蓝 / 3 紫 / 4 红 / 5 金），翻开前即见稀有度颜色；翻面前不显示名字与星星
- 卡面展示姓名与金色星星图案（细白描边），按星星个数区分等级
- 命中保底池的卡牌带「保底」标记与金色流光

### 星级系统
- 可在设置中为每个学生设定 1-5 星；导入名单时也可直接携带（TXT 名字后空格跟数字，表格写在第二列）
- 自动升星（可关闭）：学生每被抽中 5 次自动升 1 星（上限 4 星）
- 在设置中修改星级后，若名单文件仍在导入时的位置，**自动同步回源文件**（TXT/CSV/XLSX）；文件被移动后静默忽略

### 抽取能力
- **按星级抽取**（可选开启）：勾选参与的星级，抽取范围限定其中
- **一键统一权重**：输入一个百分比，把全部学生恢复为等概率
- **保底池**：勾选重点同学组成保底池，连续达到保底次数后下次必中
- **权重预设**：保存当前权重方案，随时套用或删除

### 其它
- 5 套配色主题 + 深浅色模式，结果展示弹窗改为浅色调
- 品牌自定义：主界面标题、窗口标题、程序名、标题栏文字与窗口图标
- 关闭行为可选后台运行（悬浮球可关）或直接退出；悬浮球默认关闭
- 单实例启动修复：程序已在后台运行时再次双击图标，直接唤起主界面，不再误报「保存失败」

## 使用前请阅读

- **没有代码签名**：本仓库未配置签名证书，SmartScreen 会提示「未知发布者」，点「更多信息 → 仍要运行」即可启动。
- **名单与设置只存本机**：不联网、无遥测、无自动更新。
- **验证环境**：Windows 11 x64 实测；Windows 10 未逐一实测。

## 系统要求

Windows 10 / 11 x64，无需额外安装运行时。

## 源码

README 里有完整的开发、测试与打包步骤。
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
    except Exception:  # noqa: BLE001
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
                'name': '名字抽取器 v1.1.0',
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
