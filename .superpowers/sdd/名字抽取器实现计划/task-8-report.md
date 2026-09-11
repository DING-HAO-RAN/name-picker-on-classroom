# Task 8 验收与发布检查报告

## 范围与结论

- 任务：名字抽取器计划 Task 8，完成验收与发布检查。
- 验收基线：`a8312eb`（Task 1–7 已有独立审查记录）。
- 应用版本：`1.0.0`。
- 本次只修改发布文档，不修改功能源码，不新增网络、更新或遥测，不把二进制加入提交。
- 结论：**有条件通过**。单元测试、生产构建、Electron E2E、离线触摸事件仿真、Windows x64 受限打包、产物哈希、自包含归档和本机启动检查均有证据；完整资源编辑验证、代码签名、独立 Windows 10 验证和实体触摸硬件验证仍未完成，因此不能称为完整生产发布通过。

为避免把本机信息写入文档，本报告中的命令输出将工作树、用户缓存和临时目录统一替换为 `<WORKTREE>`、`<USER_CACHE>`、`<TEMP>`。版本、数量、哈希、签名状态、退出码和错误文本保持实际值；完整输出中的外部下载地址也不写入报告。重复的同一解包错误合并记录，并注明重复次数。

## 环境与基线检查

实际执行：

```text
Get-Location; git status --short --branch; git rev-parse --show-toplevel; git rev-parse --short HEAD; git branch --show-current
## feature/name-picker
<WORKTREE>
a8312eb
feature/name-picker
```

操作系统与工具链实际输出：

```text
Caption      : Microsoft Windows 11 家庭版 中文版
Version      : 10.0.26200
BuildNumber  : 26200
Architecture : 64-bit
Node         : v24.16.0
Npm          : 11.13.0
Electron     : v36.3.2
```

本机只证明 Windows 11 x64；Windows 10 x64 尚未在独立系统验证。

## 必做命令实际结果

### 1. `npm test -- --run`

退出码 `0`。最终实际输出：

```text
> name-picker@1.0.0 test
> vitest --run

 RUN  v3.1.3 <WORKTREE>

 ✓ src/shared/drawEngine.test.ts (16 tests) 13ms
 ✓ src/main/renderer-url.test.ts (5 tests) 9ms
 ✓ src/main/storage/localStore.test.ts (15 tests) 117ms
 ✓ src/preload/index.test.ts (2 tests) 244ms
 ✓ src/main/ipcHandlers.test.ts (36 tests) 52ms
 ✓ src/main/importers/importRoster.test.ts (7 tests) 107ms
 ✓ src/renderer/main.test.tsx (2 tests) 311ms
 ✓ src/renderer/SettingsDrawer.test.tsx (14 tests) 1203ms
 ✓ src/renderer/App.test.tsx (21 tests) 1883ms

 Test Files  9 passed (9)
      Tests  118 passed (118)
   Start at  23:30:02
   Duration  8.15s (transform 2.12s, setup 0ms, collect 7.18s, tests 3.94s, environment 26.80s, prepare 3.34s)
```

### 2. `npm run build`

退出码 `0`。最终实际输出：

```text
> name-picker@1.0.0 build
> electron-vite build

vite v6.3.5 building SSR bundle for production...
transforming...
✓ 10 modules transformed.
rendering chunks...
dist/main/index.js  19.56 kB
✓ built in 160ms
vite v6.3.5 building SSR bundle for production...
transforming...
✓ 2 modules transformed.
rendering chunks...
dist/preload/index.js  1.74 kB
✓ built in 24ms
vite v6.3.5 building for production...
transforming...
✓ 38 modules transformed.
rendering chunks...
.../dist/renderer/index.html                   0.48 kB
.../dist/renderer/assets/index-_PA_HVpi.css   14.45 kB
.../dist/renderer/assets/index-KwbLT9I6.js   579.77 kB
✓ built in 920ms
```

### 3. `npm run test:e2e`

退出码 `0`。该命令先执行一次构建；随后 Electron Playwright 测试实际输出：

```text
> name-picker@1.0.0 test:e2e
> npm run build && playwright test

Running 1 test using 1 worker

  ok 1 tests/e2e/classroom-flow.spec.ts:52:5 › 完成启动、导入、抽取、重置和权重设置流程 (594ms)

  1 passed (3.0s)
[stderr]
(node:35132) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(node:35132) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(node:35132) [DEP0190] Passing args to a child process with shell option true can lead to security vulnerabilities, only a warning.

```

测试使用仓库内的 `tests/fixtures/class-list.txt`，只含四个通用虚构值；不需要网络或替代服务器。E2E 覆盖启动、空名单、导入、结果、重置、设置抽屉和权重保存。

### 4. `npm run package:win`（未设置环境变量）

该命令按要求实际执行，退出码 `1`。它先完成构建和 Windows x64 应用目录打包，然后在启用默认资源编辑时下载并解包 `winCodeSign-2.6.0`；4 次解包尝试都因当前账户缺少创建符号链接的权限失败。实际关键输出（本机路径与下载地址已按上面的规则处理）：

```text
> name-picker@1.0.0 package:win
> npm run build && electron-builder --config electron-builder.config.cjs --win nsis portable --x64 --publish never

• electron-builder  version=26.0.12 os=10.0.26200
• executing @electron/rebuild  electronVersion=36.3.2 arch=x64 buildFromSource=false appDir=./
• installing native dependencies  arch=x64
• completed installing native dependencies
• packaging       platform=win32 arch=x64 electron=36.3.2 appOutDir=release\win-unpacked
• updating asar integrity executable resource
• downloading     winCodeSign-2.6.0 size=5.6 MB parts=1
⨯ cannot execute  cause=exit status 2
ERROR: Cannot create symbolic link : 客户端没有所需的特权。
ERROR: Cannot create symbolic link : 客户端没有所需的特权。
• Above command failed, retrying 3 more times
[exit code: 1]
```

该失败确认了本机仍受 `winCodeSign` 符号链接权限限制；未将它误记为完整资源发布验证。

### 5. 受限 `package:win`

实际执行：

```powershell
$env:NAME_PICKER_SKIP_RESOURCE_EDIT = '1'
npm run package:win
Remove-Item Env:NAME_PICKER_SKIP_RESOURCE_EDIT
```

退出码 `0`。最终实际关键输出：

```text
> name-picker@1.0.0 package:win
> npm run build && electron-builder --config electron-builder.config.cjs --win nsis portable --x64 --publish never

> name-picker@1.0.0 build
> electron-vite build

vite v6.3.5 building SSR bundle for production...
✓ 10 modules transformed.
dist/main/index.js  19.56 kB
✓ built in 97ms
✓ 2 modules transformed.
dist/preload/index.js  1.74 kB
✓ built in 14ms
✓ 38 modules transformed.
dist/renderer/index.html                   0.48 kB
.../dist/renderer/assets/index-KwbLT9I6.js   579.77 kB
✓ built in 588ms

• electron-builder  version=26.0.12 os=10.0.26200
• loaded configuration  file=<WORKTREE>/electron-builder.config.cjs
• executing @electron/rebuild  electronVersion=36.3.2 arch=x64 buildFromSource=false appDir=./
• installing native dependencies  arch=x64
• completed installing native dependencies
• packaging       platform=win32 arch=x64 electron=36.3.2 appOutDir=release\win-unpacked
• updating asar integrity executable resource  executablePath=release\win-unpacked\NamePicker.exe
• building        target=nsis file=release\NamePicker Setup-1.0.0.exe archs=x64 oneClick=false perMachine=false
• signing with signtool.exe  path=release\__uninstaller-nsis-name-picker.exe
• signing with signtool.exe  path=release\NamePicker Setup-1.0.0.exe
• building block map  blockMapFile=release\NamePicker Setup-1.0.0.exe.blockmap
• building        target=portable file=release\NamePicker-1.0.0.exe archs=x64
• signing with signtool.exe  path=release\NamePicker-1.0.0.exe
[stderr]
(node:56240) [DEP0190] Passing args to a child process with shell option true can lead to security vulnerabilities, only a warning.
```

`signing with signtool.exe` 是 electron-builder 的构建步骤日志，不是证书存在的证明；下面的签名检查实际结果为 `NotSigned`。

## 功能、离线和课堂流程

### 自动化 E2E

`npm run test:e2e` 实际通过了启动、空名单、导入四名虚构学生、结果显示、重置本轮、打开/关闭设置抽屉以及把第一名权重改为 `2` 并保存。

### 受限离线触摸事件仿真

为覆盖简报要求的触摸式流程，使用已生成的 `dist/main/index.js` 启动一次临时 Electron 应用，设置 `offline: true`、Chromium `--touch-events=enabled` 和 `--start-maximized`，通过 touch pointer down/up/click 事件依次执行：

1. 点击导入并注入不支持的扩展名，确认显示“导入名单失败，请重试。”；关闭提示。
2. 再次点击导入并导入本地虚构夹具。
3. 点击增加抽取人数，确认从 `1` 变为 `2`。
4. 关闭抽取动画，抽取两人并确认结果列表数量。
5. 重置本轮，确认四名学生恢复为“等待抽取”。
6. 打开并关闭设置抽屉。

实际输出：

```text
{"initial":{"title":"名字抽取器","heading":"名字抽取器","touchAvailable":true,"viewport":{"width":1266,"height":737},"importButtonMinHeight":"56px"},"windowState":{"maximized":false,"fullScreen":false}}
{"flow":"offline touch event sequence","result":"passed"}
[stderr]
(node:4948) [DEP0190] Passing args to a child process with shell option true can lead to security vulnerabilities, only a warning.
```

该仿真通过了离线触摸事件序列；临时脚本、隔离用户数据和进程均已删除。它不是实体触摸屏验证。`--start-maximized` 在该运行中没有使窗口进入最大化，且全屏状态为 `false`，所以本报告不宣称 F11/真全屏已验证。

## 安全与隐私检查

### 源码和文档静态检查

- 检查 README、发布清单、`src/`、`tests/`、`build/` 和配置源码，没有发现当前机器的真实绝对路径、用户目录、账号、密钥或用户提供的真实名单。
- 检查命中仅为测试专用的虚构姓名、错误脱敏测试的占位路径/占位字段，以及开发 URL 白名单和拒绝 URL 样例；这些不是当前机器路径、凭据或发布端点。
- `tests/fixtures/class-list.txt` 实际为四行通用虚构值：`甲同学`、`乙同学`、`丙同学`、`丁同学`。
- 生产源码没有 `fetch`、XHR、WebSocket、axios、`node:http`、`node:https` 或 `node:net` 调用。没有更新服务器、云同步、遥测、自定义联网协议或运行时联网配置。锁文件中的依赖仓库元数据不属于应用运行时网络端点。
- 发布文档中没有写入外部下载 URL、本机绝对路径、账号或凭据。

### preload 与 Electron 隔离

源码检查：

- `src/preload/index.ts` 只导入 Electron 的 `contextBridge` 与 `ipcRenderer`，没有导入 `fs`、`path`、`os`、`child_process` 或网络模块。
- 只暴露 `window.namePicker`，键集合固定为 `importRoster`、`loadState`、`saveState`、`clearState`；没有暴露 `ipcRenderer`、`fs` 或 `require`。
- `src/main/index.ts` 的 `BrowserWindow` 配置为 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`。
- `npm test -- --run` 中的 `src/preload/index.test.ts`（2 tests）通过，覆盖固定 API 键集合和失败 envelope。

最终解包版启动检查的实际页面状态：

```text
{"state":{"title":"名字抽取器","heading":"名字抽取器","hasNamePicker":true,"hasRequire":false,"hasProcess":false,"hasModule":false,"viewport":{"width":1266,"height":737}},"windowState":{"maximized":false,"fullScreen":false}}
```

这里的 `hasRequire`、`hasProcess`、`hasModule` 都是页面中对应 `window` 属性的检查结果；Electron 预加载归档内部由构建器保留的模块加载代码不等于向渲染器暴露 Node 能力。

## Windows x64 产物检查

受限打包最后一次生成的两个交付产物均存在。最终 `Get-FileHash` 与签名检查实际输出：

```text
File            : release\NamePicker Setup-1.0.0.exe
Bytes           : 88822732
SHA256          : 9D3165ADFB85B37B24D0AF8D383A1BC2722A84F078806A98CAAA660095B1D4AC
SignatureStatus : NotSigned
Signer          :

File            : release\NamePicker-1.0.0.exe
Bytes           : 88617100
SHA256          : C30EB9472620A079BF43C7EDBE38B3C5943790F3F17CD2AF51AFCCCD2E293ACE
SignatureStatus : NotSigned
Signer          :
```

可复现哈希命令：

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath 'release\NamePicker Setup-1.0.0.exe'
Get-FileHash -Algorithm SHA256 -LiteralPath 'release\NamePicker-1.0.0.exe'
```

最终值：

| 类型 | 文件 | 字节数 | SHA-256 | 签名 |
|---|---|---:|---|---|
| NSIS 安装包 | `release/NamePicker Setup-1.0.0.exe` | 88822732 | `9D3165ADFB85B37B24D0AF8D383A1BC2722A84F078806A98CAAA660095B1D4AC` | `NotSigned` |
| portable | `release/NamePicker-1.0.0.exe` | 88617100 | `C30EB9472620A079BF43C7EDBE38B3C5943790F3F17CD2AF51AFCCCD2E293ACE` | `NotSigned` |

### 启动检查

- 解包版 `release/win-unpacked/NamePicker.exe`：使用 Playwright Electron、离线上下文和隔离用户数据启动；标题、一级标题和 `window.namePicker` 正确，三个 Node 属性均未暴露。启动后可关闭。
- NSIS 安装版：静默安装实际输出 `InstallerExitCode=0`、`InstalledExecutable=True`；安装后的新进程在 8 秒检查点为 4 个，4 个均为响应状态；随后清理临时安装目录。
- portable：直接启动实际输出 `NewProcesses=4`、`Responsive=4`、`LauncherExited=False`、`Success=True`；随后清理进程和临时目录。此项是进程级启动检查，不替代独立系统上的 UI 流程验收。

NSIS 实际安装/启动检查输出：

```text
InstallerExitCode   : 0
InstalledExecutable : True
NewProcesses        : 4
Responsive          : 4
LauncherExited      : False
Success             : True
```

portable 实际启动检查输出：

```text
NewProcesses   : 4
Responsive     : 4
LauncherExited : False
Success        : True
```

### 自包含依赖

对 `release/win-unpacked/resources/app.asar` 执行 `npx asar list` 并检查归档条目，实际结果：

```text
ContainsAppPackage : True
ContainsMain       : True
ContainsPreload   : True
ContainsRenderer   : True
ContainsPapaParse  : True
ContainsXlsx       : True
EntryCount         : 358
```

解包目录同时包含 Electron 运行时 DLL、资源文件和 `NamePicker.exe`；NSIS 安装目录也实际复制出相同的运行时文件和 `resources/app.asar`。因此本机证据支持“安装版和 portable 自包含运行依赖”，但不替代其他 Windows 版本复测。

## 忽略规则与提交范围

实际执行：

```text
git check-ignore -v --no-index dist/main/index.js release/NamePicker-1.0.0.exe coverage/index.html playwright-report/index.html test-results/example.txt screenshots/example.png
.gitignore:2:dist/                dist/main/index.js
.gitignore:3:release/             release/NamePicker-1.0.0.exe
.gitignore:4:coverage/            coverage/index.html
.gitignore:5:playwright-report/   playwright-report/index.html
.gitignore:6:test-results/       test-results/example.txt
.gitignore:7:screenshots/         screenshots/example.png
```

确认 `dist/`、`release/`、`coverage/`、`playwright-report/`、`test-results/` 和 `screenshots/` 输出均被忽略。`release/` 内的 EXE、blockmap 和 builder 调试输出不提交。

文档差异范围：

- 修改：`README.md`
- 新增：`docs/release-checklist.md`
- 报告：本文件（位于 `.superpowers/`，提交时显式加入审计文档）
- 未修改任何 `src/` 功能源码。

## 已知限制与后续动作

1. 未设置 `NAME_PICKER_SKIP_RESOURCE_EDIT` 的完整 `package:win` 在当前 Windows 11 账户因 `winCodeSign` 解包创建符号链接缺少权限失败；受限构建不能称为完整资源发布验证。
2. 两个 EXE 的 `Get-AuthenticodeSignature` 均为 `NotSigned`；仓库没有签名证书，不能声称已签名。
3. 本机实际系统为 Windows 11 x64；Windows 10 x64 尚未独立验证。
4. 已执行离线触摸事件仿真，但没有实体触摸硬件证据；启动检查还记录了 `isMaximized=false` 和 `isFullScreen=false`，未验证真全屏。
5. 发布前应在具备 `winCodeSign` 符号链接权限的环境中不设置跳过变量重新打包，配置并验证组织要求的代码签名，然后在 Windows 10 x64 的安装版和 portable 版分别重跑离线课堂流程。
6. 本任务没有启动长期开发服务器，没有修改功能源码，没有新增网络/更新/遥测，也没有提交 release 二进制。
