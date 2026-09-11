# Task 8 验收与发布检查报告

## 范围与结论

- 任务：名字抽取器计划 Task 8，修复发布文档与验收证据。
- 当前验收基线：`377f530`。
- 应用版本：`1.0.0`。
- 本轮只修改 `README.md`、`docs/release-checklist.md` 和本报告；不修改功能源码，不新增网络、更新或遥测，不提交二进制。
- 结论：**有条件通过**。单元测试、生产构建、Electron E2E、离线触摸事件仿真、Windows x64 受限打包、产物哈希、ASAR 内容检查、当前机启动证据和打包后 preload API 证据均已记录；完整资源编辑验证、代码签名、独立 Windows 10 验证、实体触摸硬件验证，以及在安装版和 portable 包内分别完成完整课堂 UI 流程仍未完成，不能称为完整生产发布通过。

为避免把本机信息写入文档，命令输出中的工作树、用户缓存和临时目录统一替换为 `<WORKTREE>`、`<USER_CACHE>`、`<TEMP>`；不写入真实用户值、个人路径、下载地址、发布端点或凭据。相对产物路径、版本、数量、哈希、签名状态、退出码和错误文本保持实际值。

## 环境与基线检查

本轮实际环境摘要：

```text
Caption      : Microsoft Windows 11 家庭版 中文版
Version      : 10.0.26200
BuildNumber  : 26200
Architecture : 64-bit
Node         : v24.16.0
Npm          : 11.13.0
Electron     : v36.3.2
electron-builder : 26.0.12
```

当前工作分支为 `feature/name-picker`，开始本轮时 HEAD 为 `377f530`，工作树无未提交非忽略变更。Windows 10 x64 未在独立系统验证。

## 必做命令实际结果

### 1. `npm test -- --run`

退出码 `0`。本轮实际通过 9 个测试文件、118 个测试；关键输出：

```text
Test Files  9 passed (9)
     Tests  118 passed (118)
```

### 2. `npm run build`

退出码 `0`。主进程、预加载和渲染器均构建成功；关键输出：

```text
vite v6.3.5 building SSR bundle for production...
dist/main/index.js  19.56 kB
dist/preload/index.js  1.74 kB
dist/renderer/assets/index-_PA_HVpi.js  579.77 kB
✓ built
```

### 3. `npm run test:e2e`

退出码 `0`。本轮实际使用本地虚构夹具运行 1 个 Electron Playwright 测试：

```text
Running 1 test using 1 worker
  ok 1 tests/e2e/classroom-flow.spec.ts:52:5 › 完成启动、导入、抽取、重置和权重设置流程 (1.6s)
1 passed (8.2s)
[stderr]
(node:13012) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(node:13012) [DEP0190] DeprecationWarning: Passing args to a child process with shell option true can lead to security vulnerabilities, only a warning.
```

### 4. `npm run package:win`（未设置环境变量）

该命令退出码 `1`。构建和 Windows x64 应用目录打包完成后，electron-builder 在 `winCodeSign` 解包阶段因当前账户没有创建符号链接的权限失败；不把该结果记为完整资源发布验证。

```text
• electron-builder  version=26.0.12 os=10.0.26200
• packaging       platform=win32 arch=x64 appOutDir=release\win-unpacked
• updating asar integrity executable resource
• downloading     winCodeSign-2.6.0 size=5.6 MB
ERROR: Cannot create symbolic link : 客户端没有所需的特权。
• Above command failed, retrying 3 more times
[stderr]
(node:12196) [DEP0190] DeprecationWarning: Passing args to a child process with shell option true can lead to security vulnerabilities, only a warning.
[exit code: 1]
```

### 5. 受限 `package:win`

实际执行并在结束时清理环境变量：

```powershell
$env:NAME_PICKER_SKIP_RESOURCE_EDIT = '1'
npm run package:win
Remove-Item Env:NAME_PICKER_SKIP_RESOURCE_EDIT
```

退出码 `0`。实际关键输出：

```text
• electron-builder  version=26.0.12 os=10.0.26200
• packaging       platform=win32 arch=x64 appOutDir=release\win-unpacked
• updating asar integrity executable resource  executablePath=release\win-unpacked\NamePicker.exe
• building        target=nsis file=release\NamePicker Setup-1.0.0.exe archs=x64 oneClick=false perMachine=false
• building block map  blockMapFile=release\NamePicker Setup-1.0.0.exe.blockmap
• building        target=portable file=release\NamePicker-1.0.0.exe archs=x64
[stderr]
(node:43028) [DEP0190] DeprecationWarning: Passing args to a child process with shell option true can lead to security vulnerabilities, only a warning.
[exit code: 0]
```

`[DEP0190] shell: true` 是 Playwright/electron-builder 测试或构建子进程调用产生的工具链警告，不是应用运行时网络代码或 IPC 代码；它不改变上述命令的退出码，也不扩大运行时安全结论。完整打包的退出码 `1` 仍仅归因于 `winCodeSign` 符号链接权限限制。

## 功能、离线和课堂流程

E2E 实际覆盖启动、空名单、导入四名通用虚构学生、结果显示、重置本轮、打开/关闭设置抽屉和保存第一名权重 `2`。另有一次离线触摸事件仿真，使用构建输出、`offline: true`、Chromium `--touch-events=enabled` 和 `--start-maximized`，依次覆盖错误提示恢复、导入、人数调节、关闭动画、抽取、重置和设置抽屉开关。

仿真实际摘要：

```text
{"initial":{"title":"名字抽取器","heading":"名字抽取器","touchAvailable":true,"viewport":{"width":1266,"height":737,"importButtonMinHeight":"56px"},"windowState":{"maximized":false,"fullScreen":false}}
{"flow":"offline touch event sequence","result":"passed"}
```

该证据是构建输出上的自动化事件仿真，不是实体触摸屏证据。`--start-maximized` 没有使窗口进入最大化，`isFullScreen=false`，所以不宣称真全屏已验证。更重要的是，尚未在 NSIS 安装版和 portable 包内分别完成完整课堂 UI 流程；发布包当前只以 ASAR/归档内容、当前机离线检查和进程级启动检查作为边界证据，不能据此声称包级全流程验收或一般“可用”。

## 安全与隐私检查

### 源码、配置和 README 的实际扫描命令

以下命令本轮实际执行。`git ls-files` 只取 Git tracked 文件；显式排除 `package-lock.json`、`npm-shrinkwrap.json`、`yarn.lock`、`pnpm-lock.yaml`、`bun.lockb` 等 lock 元数据，以及 `dist/`、`release/`、`coverage/`、`playwright-report/`、`test-results/`、`screenshots/` 构建/测试缓存，以排除已知误报。命令不打印命中行，只打印脱敏计数和退出码。

```powershell
$ErrorActionPreference = 'Stop'
$exclude = '(^|/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|dist|release|coverage|playwright-report|test-results|screenshots)(/|$)'
$tracked = @(git ls-files | Where-Object { $_ -notmatch $exclude })
$scope = @($tracked | Where-Object {
  $_ -match '^(src|tests|build|docs)/' -or
  $_ -match '^(README\.md|package\.json|electron-builder\.config\.cjs|vite\.config\.ts|tsconfig\.json|playwright\.config\.(ts|js|cjs))$'
})
$runtime = @($tracked | Where-Object {
  $_ -match '^(src|build)/' -or
  $_ -match '^(package\.json|electron-builder\.config\.cjs|vite\.config\.ts|tsconfig\.json|playwright\.config\.(ts|js|cjs))$'
})
function Find-Hits([string[]]$Files, [string]$Pattern) {
  foreach ($file in $Files) {
    @(Select-String -LiteralPath $file -Pattern $Pattern -CaseSensitive:$false -AllMatches -ErrorAction Stop)
  }
}
$failures = 0
$machineValues = @(
  (git rev-parse --show-toplevel)
  $env:USERPROFILE
  $env:USERNAME
  $env:COMPUTERNAME
) | Where-Object { $_ } | Sort-Object -Unique
$machinePatternHits = @()
foreach ($value in $machineValues) {
  $machinePatternHits += @(Find-Hits $scope ([regex]::Escape($value)))
}
$absoluteScope = @($scope | Where-Object { $_ -notmatch '^(README\.md|docs/)' })
$absolutePattern = '(?i)(?:' + '[A-Z]' + ':[\\/]|/Users/|/home/|/private/var/|/var/folders/)'
$absoluteCandidates = @(Find-Hits $absoluteScope $absolutePattern)
if ($machinePatternHits.Count -eq 0) {
  Write-Output ("[1] machine-specific paths/user values: matches=0; generic absolute-path candidates={0}; exit code=0" -f $absoluteCandidates.Count)
} else {
  Write-Output ("[1] machine-specific paths/user values: matches={0}; exit code=1" -f $machinePatternHits.Count)
  $failures++
}
$credentialPattern = '(?i)(?:gh' + 'p_[A-Za-z0-9]{36}|github_' + 'pat_[A-Za-z0-9_]{22,}|sk' + '-[A-Za-z0-9]{20,}|xox' + '[baprs]-[A-Za-z0-9-]{20,}|-----BEGIN ' + '(?:RSA|OPENSSH|EC) PRIVATE KEY-----|(?:api' + '[_-]?key|secret|token|password|passwd)\s*[:=]\s*["'']' + '[^"'']{12,}["''])'
$credentialHits = @(Find-Hits $scope $credentialPattern)
if ($credentialHits.Count -eq 0) {
  Write-Output '[2] high-confidence credential/key patterns: matches=0; fixture placeholders not counted; exit code=0'
} else {
  Write-Output ("[2] high-confidence credential/key patterns: matches={0}; exit code=1" -f $credentialHits.Count)
  $failures++
}
$networkPattern = '(?i)\b(?:f' + 'etch|XML' + 'HttpRequest|Web' + 'Socket|ax' + 'ios|node:' + 'http|node:' + 'https|node:' + 'net)\b'
$networkHits = @(Find-Hits $runtime $networkPattern)
if ($networkHits.Count -eq 0) {
  Write-Output '[3] runtime network APIs (source/config scope): matches=0; README/docs excluded because they contain audit wording; exit code=0'
} else {
  Write-Output ("[3] runtime network APIs (source/config scope): matches={0}; exit code=1" -f $networkHits.Count)
  $failures++
}
$preload = @($tracked | Where-Object { $_ -eq 'src/preload/index.ts' })
$preloadForbiddenPattern = '(?i)\b(?:fs|path|os|child_process|require|process|module|node:(?:fs|path|os|child_process|http|https|net))\b'
$preloadHits = @(Find-Hits $preload $preloadForbiddenPattern)
if ($preloadHits.Count -eq 0) {
  Write-Output '[4] production preload Node imports/exposure: matches=0; static check passed; exit code=0'
} else {
  Write-Output ("[4] production preload Node imports/exposure: matches={0}; exit code=1" -f $preloadHits.Count)
  $failures++
}
$overall = if ($failures -eq 0) { 0 } else { 1 }
Write-Output ("Security scan overall exit code={0}; tracked files after exclusions={1}; audited source/config/README scope={2}" -f $overall,$tracked.Count,$scope.Count)
exit $overall
```

`$absoluteScope` 只在通用绝对路径候选计数中排除 README/清单，避免扫描命令自身的正则文字形成已知误报；机器实际工作树、用户目录、用户名和计算机名仍通过动态值在完整 `$scope`（含 README/清单）中检查。第 3 项片段组合覆盖 `fetch`、XHR/XMLHttpRequest、WebSocket、axios、`node:http`、`node:https`、`node:net`；README 和发布清单作为审计文档不当作运行时代码判定，但仍在路径、真实用户信息和凭据扫描范围内。第 4 项只对生产 `src/preload/index.ts` 判定，以避免把测试 mock 中有意出现的 Node 名称当作运行时暴露。

实际脱敏输出如下；没有发布端点、个人路径或凭据出现在输出中：

```text
[1] machine-specific paths/user values: matches=0; generic absolute-path candidates=23; exit code=0
[2] high-confidence credential/key patterns: matches=0; fixture placeholders not counted; exit code=0
[3] runtime network APIs (source/config scope): matches=0; README/docs excluded because they contain audit wording; exit code=0
[4] production preload Node imports/exposure: matches=0; static check passed; exit code=0
Security scan overall exit code=0; tracked files after exclusions=50; audited source/config/README scope=46
```

扫描命中计数为零的项目均以 PowerShell 进程退出码 `0` 结束；`generic absolute-path candidates=23` 是测试中的通用占位/loopback 样例计数，机器特定路径和真实用户值为零，不把这些样例当作个人信息或发布端点。

### preload 运行时与打包后 API

`src/main/index.ts` 的窗口配置为 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`。`src/preload/index.ts` 只导入 Electron 的 `contextBridge` 和 `ipcRenderer`，只暴露 `window.namePicker`，不暴露 `ipcRenderer`、`fs`、`require` 或其他 Node 对象。

使用一次性本地 Playwright 脚本启动 `release/win-unpacked/NamePicker.exe` 并在打包后页面执行 `Object.keys(window.namePicker)`；脚本未提交，执行进程退出码 `0`。实际输出：

```text
{"apiKeys":["importRoster","loadState","saveState","clearState"],"hasRequire":false,"hasProcess":false,"hasModule":false}
```

因此打包后 API 键集合准确为四个固定业务方法：`importRoster`、`loadState`、`saveState`、`clearState`。这不是只验证“存在”或“无 Node 属性”的替代表述，而是 `Object.keys(window.namePicker)` 的实际结果。

## Windows x64 产物检查

本轮受限打包最后一次生成的两个交付产物均存在。实际哈希、大小和签名状态：

```text
File=release\NamePicker Setup-1.0.0.exe; Bytes=88822810; SHA256=EFB847839F1BAE6E21E0333E1D3CDC64D3CA6CC550B73D7D08CB448B0CFDADEE; SignatureStatus=NotSigned
File=release\NamePicker-1.0.0.exe; Bytes=88617100; SHA256=8BD146A0A20272B443D3BA0639BA835DD93155A11F5AE50B371D673519EF0311; SignatureStatus=NotSigned
```

可复现哈希命令：

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath 'release\NamePicker Setup-1.0.0.exe'
Get-FileHash -Algorithm SHA256 -LiteralPath 'release\NamePicker-1.0.0.exe'
```

| 类型 | 文件 | 字节数 | SHA-256 | 签名 |
|---|---|---:|---|---|
| NSIS 安装包 | `release/NamePicker Setup-1.0.0.exe` | 88822810 | `EFB847839F1BAE6E21E0333E1D3CDC64D3CA6CC550B73D7D08CB448B0CFDADEE` | `NotSigned` |
| portable | `release/NamePicker-1.0.0.exe` | 88617100 | `8BD146A0A20272B443D3BA0639BA835DD93155A11F5AE50B371D673519EF0311` | `NotSigned` |

### 启动与归档边界

- 解包版 `release/win-unpacked/NamePicker.exe`：Playwright Electron 启动检查得到标题、一级标题和打包后 API 键集合；`hasRequire`、`hasProcess`、`hasModule` 均为 `false`。同次自动化窗口记录 `isMaximized=false`、`isFullScreen=false`。
- NSIS 安装版：既有 Task 8 启动证据为 `InstallerExitCode=0`、安装目录出现可执行文件、进程级响应检查通过；该证据不替代安装包内完整 UI 流程。
- portable：既有 Task 8 启动证据为直接启动进程级响应检查通过；该证据不替代 portable 包内完整 UI 流程。
- `npx asar list release\win-unpacked\resources\app.asar` 实际检查结果：

```text
Contains package.json=True
Contains dist/main/index.js=True
Contains dist/preload/index.js=True
Contains dist/renderer/index.html=True
Contains node_modules/papaparse=True
Contains node_modules/xlsx=True
EntryCount=358
```

ASAR/归档内容和解包目录运行时文件支持“内容自包含”的本机证据；结合当前机离线检查和进程级启动证据，仍不能声称安装版或 portable 已完成包级课堂 UI 全流程或普遍“可用”。

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

确认 `dist/`、`release/`、`coverage/`、`playwright-report/`、`test-results/` 和 `screenshots/` 输出均被忽略。提交范围仅为 `README.md` 与 `docs/release-checklist.md`；本报告位于被忽略的 `.superpowers/` 目录，提交后追加的 HEAD/status 不纳入提交。

## 已知限制与后续动作

1. 未设置 `NAME_PICKER_SKIP_RESOURCE_EDIT` 的完整 `package:win` 在当前 Windows 11 账户因 `winCodeSign` 解包创建符号链接缺少权限失败；受限构建不能称为完整资源发布验证。
2. 两个 EXE 的签名检查均为 `NotSigned`；仓库没有签名证书，不能声称已签名。
3. 本机实际系统为 Windows 11 x64；Windows 10 x64 尚未独立验证。
4. 已执行离线触摸事件仿真，但没有实体触摸硬件证据；启动检查记录 `isMaximized=false` 和 `isFullScreen=false`，未验证真全屏。
5. 尚未在 NSIS 安装版和 portable 包内分别完成完整课堂 UI 流程；发布前应在两个包中重跑离线课堂流程，并在 Windows 10 x64 上复测。
6. 发布前应在具备 `winCodeSign` 符号链接权限的环境中不设置跳过变量重新打包，配置并验证组织要求的代码签名，然后更新产物哈希和验收证据。
7. 本任务没有启动长期开发服务器，没有修改功能源码，没有新增网络/更新/遥测，也没有提交 release 二进制。

## 提交后尾证据

本节必须在文档提交完成后追加；追加内容不纳入该提交。待追加：

```text
Post-commit git rev-parse --short HEAD:
Post-commit git status --short --branch:
```
