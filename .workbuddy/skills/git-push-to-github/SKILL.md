---
name: git-push-to-github
description: 把本地 Git 仓库完整推送到 GitHub（保留全部提交历史），并附最大附件近百 MB 的 Release 发布方法。当本机没有 gh、没有 SSH 密钥、GitHub MCP 又提示 403 或无推送历史能力时使用；也覆盖推送前的全历史隐私扫描、令牌清理，以及 Release 附件上传与文件名修正。
---

# 把本地仓库推上 GitHub

## 先判断走哪条路

| 条件 | 做法 |
|---|---|
| 本机装了 gh 且已登录 | `gh repo create <name> --public --source=. --push`，最省事 |
| 只有 GitHub MCP 连接器 | **不能用来做真正的推送**：它 `POST /user/repos` 建仓会 403（`Resource not accessible by integration`），且只有 `push_files` 这种「按文件内容提交」的能力，会把全部历史压成一个提交 |
| 两者都没有 | 让用户在 https://github.com/settings/tokens 生成令牌（classic 勾 `repo`，或 fine-grained 选目标仓库、Contents 读写），再用 `git push` |

仓库体积大时（几十 KB 以上）不要考虑 MCP 逐文件提交：文件内容要经过对话上下文搬运，且历史全丢。

## 用令牌推送（已验证）

URL 内嵌形式可用：

```bash
TOK="<令牌>"
git ls-remote "https://$TOK@github.com/<owner>/<repo>.git"   # 先验证令牌有效
git push --force-with-lease=refs/heads/<远端分支>:<远端 sha> \
  "https://$TOK@github.com/<owner>/<repo>.git" <本地分支>:<远端分支>
```

坑：

- `git -c "http.https://github.com/.extraheader=AUTHORIZATION: bearer $TOK"` 实测返回 `remote: invalid credentials`，别用。
- 远端若已有 GitHub 自动初始化提交（勾选了 README/LICENSE），它不在本地历史里，需要强制推送；用 `--force-with-lease=<ref>:<远端 sha>` 比 `--force` 稳妥，远端 sha 从 `git ls-remote` 拿。
- 远端默认分支常是 `main` 而本地是 `master`，用 `本地:远端` 映射，不必改本地分支名；想让后续 `git push` 免参数就写：
  `git config branch.<本地分支>.remote origin` 与 `git config branch.<本地分支>.merge refs/heads/<远端分支>`。
- 令牌只在命令行里用，不要写进 `remote.origin.url`；推完用 `git config --get remote.origin.url` 复核。

## 推送前：全历史隐私扫描（必做）

只看工作树不够，历史提交里可能夹带过本机路径或账号。一次 git 进程扫完所有提交：

```bash
git grep -I -E -n "<模式>" $(git rev-list --all)
```

模式要包含用户名、邮箱、盘符路径（`C:/Users`、`D:/桌面`）、项目目录名等。**注意别写太宽**：中文项目里单独写「桌面」会把「桌面应用」全命中成假警报，要写成 `桌面[\\/]` 这类带分隔符的形式。命中后先确认是误报还是真泄漏，真泄漏就得改写历史（`git filter-repo`）再推。

## 发布 Release 并上传大附件（Windows 产物已验证）

同样没有 `gh` 时可以直接用 REST API。流程：本地 `git tag -a v1.0.0 -m "..."` → 推标签（`git push <带令牌 URL> refs/tags/v1.0.0`）→ 建 Release → 传附件。

```python
# 1) 创建：POST /repos/{owner}/{repo}/releases，body 用 json 序列化即可
status, payload = request_json('POST', f'/repos/{OWNER}/{REPO}/releases',
    {'tag_name': TAG, 'name': ..., 'body': ..., 'draft': False, 'prerelease': False})
# 标签已存在会返回 422，先 GET /releases/tags/{tag} 复用现有 id

# 2) 上传：用返回的 upload_url（形如 https://uploads.github.com/repos/.../assets{?name,label}）
path = upload_url.split('{?')[0].split('uploads.github.com', 1)[1]
full = path + '?' + urllib.parse.urlencode({'name': os.path.basename(f), 'label': ...})
conn = http.client.HTTPSConnection('uploads.github.com', timeout=600)
conn.putrequest('POST', full)
conn.putheader('Authorization', f'Bearer {TOKEN}')
conn.putheader('Content-Type', 'application/octet-stream')
conn.putheader('Content-Length', str(os.path.getsize(f)))
conn.endheaders()
with open(f, 'rb') as h:                      # 分块 send，别把 88 MB 一次性读进内存
    while chunk := h.read(1024 * 1024):
        conn.send(chunk)
```

要点：

- 用 `http.client` 手动 `putrequest` / `endheaders` / 循环 `send` 最稳；`urllib` 传 file object 的 Content-Length 行为不确定，别赌。
- **附件名里的空格会被 GitHub 替换成点**（`NamePicker Setup-1.0.0.exe` → `NamePicker.Setup-1.0.0.exe`）。需要的话 `PATCH /repos/{owner}/{repo}/releases/assets/{asset_id}` 改 `name`；改完务必同步 Release 说明里的所有出现——代码块和表格里的文件名往往没有反引号，只替换反引号那处会漏。
- 复核附件可用性看 `assets[].state == "uploaded"` 和 `size`，别用 HEAD 打 `browser_download_url`（永远 302）。
- Release 说明里如实写限制：未签名会触发 SmartScreen、哪些产物没有运行时证据、只验证过哪些系统。

## 推送后

- 用 GitHub MCP 复核：`get_file_contents` 列根目录、`list_commits` 看历史是否完整。
- 提醒用户：提交里的作者姓名与邮箱会永久公开；不想公开邮箱就在 https://github.com/settings/emails 勾 "Keep my email addresses private"。
- 建议用户在用完后删除/轮换该令牌——令牌在对话与命令行里出现过。
- 仓库描述、主题这类元信息 MCP 改不了（无 update_repository 能力），只能让用户在网页改。
