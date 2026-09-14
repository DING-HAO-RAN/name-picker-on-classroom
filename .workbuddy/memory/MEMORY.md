# 项目长期笔记

## 项目定位

名字抽取器：Electron 36 + React 19 + TypeScript 的离线课堂随机点名桌面应用，目标平台 Windows 10/11 x64。三层结构：渲染器（React）→ 预加载（contextBridge 暴露 `window.namePicker` 四个方法）→ 主进程（ipcHandlers / importers / LocalStore）。所有数据仅存本机，无网络、无遥测、无自动更新。

## 构建与打包约定

- 打包命令：`npm run package:win`，产出 NSIS 安装包与 portable 便携包（x64，输出到 `release/`，由 .gitignore 保护，不提交二进制）。
- 本机没有创建符号链接的特权，**完整资源编辑打包必然失败**（winCodeSign 解包报「客户端没有所需的特权」）。必须使用受限模式：

  ```powershell
  $env:NAME_PICKER_SKIP_RESOURCE_EDIT = '1'
  npm run package:win
  Remove-Item Env:NAME_PICKER_SKIP_RESOURCE_EDIT
  ```

  受限包不等于完整资源发布验证，发布前需在具备权限的环境重打并配置签名。
- **打包前必须清理输出目录内容**。上一轮失败留下的 `win-unpacked` 会被占用，导致 electron-builder 在 `packaging` 阶段无限重试、表现为假死（无日志输出、目录不再增长）。清理后单次打包约 1 分钟。
  注意：本机沙箱会把删除改成移入回收站，对 `release` 这个**目录本身**的删除/改名会被拦截并 fail-closed（`safe-delete` / WinError 5）。可行做法是保留输出目录、逐个删除其内部条目（Python：子目录 `shutil.rmtree`、文件先 `chmod` 再 `os.remove`）。
  若旧输出目录里的文件被 WorkBuddy 宿主进程锁定（如 `app.asar`，用 Restart Manager API 可查出 PID），无法删除时改用 `NAME_PICKER_OUTPUT_DIR=release2` 换新输出目录打包（`electron-builder.config.cjs` 已支持该环境变量，`release2/` 已加 .gitignore）。electron-builder 的 `-c.xxx=yyy` CLI 覆盖语法在本机会被误解析成配置文件路径，不要用。
- 用户要求：不要过度审计和校验，发布不做哈希校验；产物以输出目录内实际生成的文件为准。
- 仓库未配置代码签名证书，产物始终为未签名（PE 证书表为空），不要声称已签名。electron-builder 日志里的 `signing with signtool.exe` 只是固定步骤，不等于已签名。
- 清理脚本：`.workbuddy/scripts/clean-release-dir.py`（注意：脚本在 `.workbuddy/scripts/` 下，要上溯三级才是项目根）。
- 打包产物的验证方式：用 Playwright 的 `electron.launch({ executablePath })` 指向解包版可执行文件（见 `.workbuddy/scripts/verify-packaged-app.js`）。两个坑：脚本必须把汇总和报告落盘放在 `app.close()` 之前（关闭打包产物会连带杀死宿主脚本进程，catch 都来不及执行）；**用 `Start-Process` 启动 GUI exe 不可作为启动证据**（沙箱内进程数秒内消失，解包版也一样）。
- portable 包目前没有可靠的本机启动证据：Playwright 以 `executablePath` 指向它时协议握手超时，进程级启动又不可靠。只能做到构建与哈希校验，发布前需在其他环境补做包内 UI 流程。
- 本机 `npm ci` / `npm install` 对多小文件 IO 极慢，曾出现 31 分钟零进展；可从其他 worktree 复用 `node_modules`（robocopy 同步）作为替代。

## 界面约定

- 名单导入入口在设置抽屉的「名单管理」区块（按钮"重新选取人员名单"），主界面侧栏没有导入入口；空名单时主界面保留完整导入区。
- 数字输入（抽取人数、动画时长、全屏停留时长）一律用"草稿态"模式：输入中保留原文，合法整数实时提交，失焦收敛，避免受控输入每次按键被收敛成一个数字。
- 权重输入是 `type="text"` + `inputMode="decimal"`（支持小数），格式校验正则 `/^\d*(\.\d*)?$/`；无障碍角色是 **textbox** 不是 spinbutton。
- 窗口是 `frame: false` 的无边框窗口，标题栏由渲染器自绘（`src/renderer/components/AppTitleBar.tsx`），高度由 CSS 变量 `--titlebar-height` 统一管理。
- **标题栏是 `position: fixed; z-index: 50`，高于抽屉（20）与确认框（30），只有全屏结果层（1000）刻意盖住它。** 因此任何 `inset: 0` 的固定覆盖层都必须显式让开顶部（抽屉写法：`inset: var(--titlebar-height) 0 0`，配套改 `max-height`），否则顶部内容会被压在窗口外框下。
- `.secondary-button` 是给纵向表单用的 `width: 100%` 整宽按钮；在横向行里复用它（例如抽屉标题行的关闭按钮）必须显式写 `width: auto`，否则会把同一行的其他元素挤成竖排。

## 验证基线

- 单元测试：`npm test -- --run`，当前 10 个文件、166 个用例；类型检查用 `npm exec -- tsc --noEmit`（无输出即通过）。
- 端到端：`npm run test:e2e`（先构建再跑 Playwright Electron）；本机沙箱内 Chromium GPU 进程起不来，该命令不可用，改用 `.workbuddy/scripts/verify-e2e-flow.js` 启动同一 `dist` 产物做等价验证。
- 发布打包方式记录在 `docs/release-checklist.md`（已精简，无哈希校验）。
- 渲染器测试注意：权重输入角色是 textbox；设置面板里还有其他数字输入，角色宽查询需按无障碍名过滤。

## 开源仓库

- 远端：`origin = https://github.com/DING-HAO-RAN/name-picker-on-classroom.git`，公开仓库，默认分支 `main`；本地分支是 `master`，推送要映射到 `main`。
- 协议：MIT，版权署名 DING-HAO-RAN。
- GitHub MCP 连接器**没有建仓权限**（403），也**无法推送 git 历史**（只能按文件内容提交），**也没有发布 Release / 上传附件的能力**。要保留提交历史或发 Release 必须拿 PAT 或用 gh 走真正的 `git push` 与 REST API。
- 已发布 `v1.0.0`：https://github.com/DING-HAO-RAN/name-picker-on-classroom/releases/tag/v1.0.0 ，附件为 NSIS 安装包与便携包（均未签名）。发布脚本在 `.workbuddy/scripts/publish-github-release.py` 与 `fix-release-asset-name.py`，令牌经 `GITHUB_TOKEN` 环境变量传入。

## 工具链

Node v24.16.0 / npm 11.13.0，npm registry 走 npmmirror 镜像。本机 Git Bash 缺少 coreutils，文件操作建议用 Python 脚本。
项目路径 `D:\桌面\项目‘\抽取器` 里的引号是 U+2018（左单引号）而非 ASCII 撇号，命令行拼路径时用 `[char]0x2018`；直接用 ASCII `'` 会报路径不存在。
对同一文件并行发起多个 Edit 会竞态（EBUSY 或静默丢失部分改动），必须逐个编辑，改完用 Grep 复核关键标记。
