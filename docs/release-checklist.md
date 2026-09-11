# 名字抽取器发布验收清单

## 验收结论

**有条件通过，不等同于完整生产发布通过。** 当前代码、构建输出上的离线课堂流程、Windows x64 受限打包、产物完整性和当前机启动检查均有证据；完整资源编辑验证、代码签名、独立 Windows 10 验证，以及在安装版和 portable 包内分别完成完整课堂 UI 流程仍未完成。

- 验收基线：`377f530`
- 应用版本：`1.0.0`
- 目标平台：Windows 10/11 x64
- 实际环境：Windows 11 家庭版中文版，版本/构建 `10.0.26200/26200`，64-bit
- 工具链：Node `v24.16.0`、npm `11.13.0`、Electron `v36.3.2`、electron-builder `26.0.12`
- 本次范围：只修改发布文档，不修改功能源码，不提交 release 二进制。

## 可复现命令与结果

在仓库根目录执行。除打包器获取构建工具外，不需要网络服务或开发服务器。

| 命令 | 实际结果 | 关键输出 |
|---|---|---|
| `npm test -- --run` | 通过，退出码 `0` | 9 个测试文件、118 个测试全部通过 |
| `npm run build` | 通过，退出码 `0` | 主进程、预加载脚本、渲染器均生成到 `dist/` |
| `npm run test:e2e` | 通过，退出码 `0` | 1 个 Electron E2E 测试通过，使用本地虚构夹具 |
| `npm run package:win` | 失败，退出码 `1` | `winCodeSign` 解包创建符号链接时权限不足 |
| 受限 `package:win` | 通过，退出码 `0` | 生成 NSIS 与 portable 两个 x64 产物 |

受限打包的完整可复现写法；无论命令是否成功，末行都清理开关：

```powershell
$env:NAME_PICKER_SKIP_RESOURCE_EDIT = '1'
npm run package:win
Remove-Item Env:NAME_PICKER_SKIP_RESOURCE_EDIT
```

> [!WARNING]
> `NAME_PICKER_SKIP_RESOURCE_EDIT=1` 只绕过本机 `winCodeSign` 资源编辑解包限制，不能称为完整资源发布验证。生产发布必须在具备符号链接权限的环境中不设置该变量重新打包，并另外配置和验证签名。

### 实际命令输出（脱敏）

为遵守隐私要求，下面只保留相对路径、版本、数量、哈希、退出码和错误文本；工作树、用户缓存、临时目录和下载地址不写入文档。

`npm test -- --run`：退出码 `0`。

```text
Test Files  9 passed (9)
     Tests  118 passed (118)
```

`npm run build`：退出码 `0`。

```text
vite v6.3.5 building SSR bundle for production...
dist/main/index.js  19.56 kB
dist/preload/index.js  1.74 kB
dist/renderer/assets/index-_PA_HVpi.js  579.77 kB
✓ built
```

`npm run test:e2e`：退出码 `0`。

```text
Running 1 test using 1 worker
  ok 1 tests/e2e/classroom-flow.spec.ts:52:5 › 完成启动、导入、抽取、重置和权重设置流程 (1.6s)
1 passed (8.2s)
[stderr]
(node:13012) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(node:13012) [DEP0190] DeprecationWarning: Passing args to a child process with shell option true can lead to security vulnerabilities, only a warning.
```

未设置环境变量的 `npm run package:win`：退出码 `1`。

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

受限 `package:win`：退出码 `0`。

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

`[DEP0190] shell: true` 是 Playwright/electron-builder 测试或构建子进程调用产生的 Node 工具链警告，不是应用运行时网络代码或 IPC 代码；它不改变上述命令的退出码，也不扩大本次运行时安全结论的范围。

## 功能与课堂流程

| 检查项 | 证据 | 结果与边界 |
|---|---|---|
| 启动与空名单 | `npm run test:e2e` | 标题、空名单提示和禁用状态通过 |
| 导入 | E2E 使用 `tests/fixtures/class-list.txt` | 4 名虚构学生导入并显示 |
| 人数调节 | 离线触摸事件仿真 | “增加抽取人数”将 1 调为 2 |
| 抽取与结果 | E2E、离线触摸事件仿真 | 结果列表显示期望人数 |
| 关闭动画 | E2E、离线触摸事件仿真 | 关闭后结果立即显示 |
| 重置本轮 | E2E、离线触摸事件仿真 | 4 名学生恢复为“等待抽取” |
| 设置抽屉与权重 | `npm run test:e2e` | 打开/关闭设置并保存权重 `2` |
| 错误恢复 | 离线触摸事件仿真 | 不支持扩展名提示可关闭，随后可正常导入 |
| 实体触摸屏 | Chromium `--touch-events=enabled` 加 Playwright touch pointer 事件 | 仅自动化触摸事件仿真通过，没有实体硬件证据 |
| 真全屏 | `--start-maximized` 启动检查 | `isMaximized=false`、`isFullScreen=false`，未宣称真全屏 |

离线触摸事件仿真的实际摘要：

```text
{"initial":{"title":"名字抽取器","heading":"名字抽取器","touchAvailable":true,"viewport":{"width":1266,"height":737},"importButtonMinHeight":"56px"},"windowState":{"maximized":false,"fullScreen":false}}
{"flow":"offline touch event sequence","result":"passed"}
```

该仿真使用构建输出、临时隔离用户数据目录、`offline: true`、`--touch-events=enabled` 和 `--start-maximized`；它不是两个发布包内的完整 UI 流程验收。

## 安全与隐私

### 扫描范围和排除项

以下是本轮实际执行的 PowerShell 扫描命令。`git ls-files` 只取受 Git 跟踪文件；命令明确排除 `package-lock.json`、`npm-shrinkwrap.json`、`yarn.lock`、`pnpm-lock.yaml`、`bun.lockb` 等 lock 元数据，以及 `dist/`、`release/`、`coverage/`、`playwright-report/`、`test-results/`、`screenshots/` 等构建/测试缓存，避免已知误报。

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

`$absoluteScope` 只在通用绝对路径候选计数中排除 README/清单，避免扫描命令自身的正则文字形成已知误报；机器实际工作树、用户目录、用户名和计算机名仍通过动态值在完整 `$scope`（含 README/清单）中检查。第 3 项的片段组合覆盖 `fetch`、XHR/XMLHttpRequest、WebSocket、axios、`node:http`、`node:https`、`node:net`；README 和清单属于审计文档，不作为运行时代码判定，但仍在路径、用户信息和凭据扫描范围内。第 4 项只对生产 `src/preload/index.ts` 判定，避免把测试 mock 中有意出现的 Node 名称当作运行时暴露。

实际脱敏输出如下；扫描未输出命中行、个人路径、用户值、发布端点或凭据：

```text
[1] machine-specific paths/user values: matches=0; generic absolute-path candidates=23; exit code=0
[2] high-confidence credential/key patterns: matches=0; fixture placeholders not counted; exit code=0
[3] runtime network APIs (source/config scope): matches=0; README/docs excluded because they contain audit wording; exit code=0
[4] production preload Node imports/exposure: matches=0; static check passed; exit code=0
Security scan overall exit code=0; tracked files after exclusions=50; audited source/config/README scope=46
```

### preload 与打包后 API

静态配置为 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`。生产预加载只通过 `contextBridge` 暴露 `window.namePicker`；没有把 `ipcRenderer`、`fs`、`require` 或其他 Node 对象直接暴露给渲染器。

使用一次性本地 Playwright 脚本启动 `release/win-unpacked/NamePicker.exe`，脚本未提交；实际执行进程退出码为 `0`。在打包后的页面中直接执行 `Object.keys(window.namePicker)`，实际输出为：

```text
{"apiKeys":["importRoster","loadState","saveState","clearState"],"hasRequire":false,"hasProcess":false,"hasModule":false}
```

这四个键是固定业务方法集合；`hasRequire`、`hasProcess`、`hasModule` 均为 `false`。该脚本 stderr 同样出现一条 `[DEP0190]` 工具链警告，不改变 API 结果。

## Windows x64 产物与归档检查

### 产物清单

以下值来自本轮受限打包后的实际文件：

| 类型 | 相对路径 | 字节数 | SHA-256 | `Get-AuthenticodeSignature` |
|---|---|---:|---|---|
| NSIS 安装包 | `release/NamePicker Setup-1.0.0.exe` | 88822810 | `EFB847839F1BAE6E21E0333E1D3CDC64D3CA6CC550B73D7D08CB448B0CFDADEE` | `NotSigned` |
| portable | `release/NamePicker-1.0.0.exe` | 88617100 | `8BD146A0A20272B443D3BA0639BA835DD93155A11F5AE50B371D673519EF0311` | `NotSigned` |

复核命令和脱敏输出：

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath 'release\NamePicker Setup-1.0.0.exe'
EFB847839F1BAE6E21E0333E1D3CDC64D3CA6CC550B73D7D08CB448B0CFDADEE

Get-FileHash -Algorithm SHA256 -LiteralPath 'release\NamePicker-1.0.0.exe'
8BD146A0A20272B443D3BA0639BA835DD93155A11F5AE50B371D673519EF0311
```

### 启动与归档

- 解包版 `release/win-unpacked/NamePicker.exe`：打包后 Playwright Electron 启动检查得到标题和一级标题“名字抽取器”；`window.namePicker` 存在，Node 属性未暴露；同次检查记录 `isMaximized=false`、`isFullScreen=false`。
- NSIS：静默安装实际返回 `InstallerExitCode=0`，安装目录出现可执行文件；安装后的进程级检查通过，临时安装目录随后清理。
- portable：直接启动进程级检查通过；该项不替代独立系统上的 UI 流程验收。
- `npx asar list release\win-unpacked\resources\app.asar` 实际检查：`EntryCount=358`，包含应用包、主进程、预加载、渲染器，以及 `papaparse`、`xlsx` 条目；Electron 运行时 DLL 与资源文件位于解包目录。

归档检查的脱敏摘要：

```text
Contains package.json=True
Contains dist/main/index.js=True
Contains dist/preload/index.js=True
Contains dist/renderer/index.html=True
Contains node_modules/papaparse=True
Contains node_modules/xlsx=True
EntryCount=358
```

这些是 ASAR/归档内容、当前机离线检查和进程启动证据；尚未在 NSIS 安装版和 portable 包内分别跑完一套课堂 UI 流程，因此不宣称包级全流程验收或一般“可用”。

## 忽略规则与提交范围

实际执行的忽略规则检查：

```text
git check-ignore -v --no-index dist/main/index.js release/NamePicker-1.0.0.exe coverage/index.html playwright-report/index.html test-results/example.txt screenshots/example.png
.gitignore:2:dist/                dist/main/index.js
.gitignore:3:release/             release/NamePicker-1.0.0.exe
.gitignore:4:coverage/            coverage/index.html
.gitignore:5:playwright-report/   playwright-report/index.html
.gitignore:6:test-results/       test-results/example.txt
.gitignore:7:screenshots/         screenshots/example.png
```

因此 `dist/`、`release/`、覆盖率、Playwright 报告、测试结果和截图输出均被忽略。最终提交只包含 README 与本清单；`task-8-report.md` 位于被忽略的 `.superpowers/` 目录，提交后追加最终 HEAD/status 作为审计尾证据。

## 已知限制与发布前动作

1. 不带 `NAME_PICKER_SKIP_RESOURCE_EDIT` 的资源编辑打包在当前 Windows 11 账户因 `winCodeSign` 解包创建符号链接缺少权限失败；受限包不可替代完整资源发布验证。
2. 两个 EXE 的签名状态均为 `NotSigned`；没有证书或签名验证证据，不得在发布说明中声称已签名。
3. 实际运行机为 Windows 11 x64；Windows 10 x64 尚未独立验证，目标平台声明不等于 Win10 验收证据。
4. 触摸流程是自动化触摸事件仿真；未在实体触摸硬件上验证。`--start-maximized` 未使窗口最大化，独立 F11 真全屏未验证。
5. 尚未在安装版和 portable 包内分别完成完整课堂 UI 流程；发布前应在两个包中重复离线课堂流程，并在 Windows 10 x64 上复测。
6. 发布前应在具备 `winCodeSign` 资源编辑权限的环境重新运行不带跳过变量的命令，按组织流程完成代码签名，再更新产物哈希和验收证据。
7. 本任务不修改功能源码、不新增网络/更新/遥测，不提交任何 release 二进制。
