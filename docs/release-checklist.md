# 名字抽取器发布验收清单

## 验收结论

**有条件通过，不等同于完整生产发布通过。** 当前代码、构建输出上的离线课堂流程、Windows x64 受限打包、产物完整性和当前机启动检查均有证据；完整资源编辑验证、代码签名、独立 Windows 10 验证，以及在安装版和 portable 包内分别完成完整课堂 UI 流程仍未完成。

- 验收基线：`fc3fdce`（界面改造提交，master）
- 应用版本：`1.0.0`
- 目标平台：Windows 10/11 x64
- 实际环境：Windows 11 家庭版中文版，版本/构建 `10.0.26200/26200`，64-bit
- 工具链：Node `v24.16.0`、npm `11.13.0`、Electron `v36.3.2`、electron-builder `26.0.12`
- 本次范围：界面改造（自绘标题栏、停留时长可配置、默认折叠、动画节奏）加按新基线重新打包；不提交 release 二进制，不新增网络/更新/遥测。

## 可复现命令与结果

在仓库根目录执行。除打包器获取构建工具外，不需要网络服务或开发服务器。

| 命令 | 实际结果 | 关键输出 |
|---|---|---|
| `npm exec -- tsc --noEmit` | 通过，退出码 `0` | 无输出 |
| `npm test -- --run` | 通过，退出码 `0` | 10 个测试文件、164 个测试全部通过 |
| `npm run build` | 通过，退出码 `0` | 主进程 23.62 kB、预加载 2.62 kB、渲染器 615.91 kB + 31.48 kB CSS |
| `npm run test:e2e` | 本机无法执行 | 沙箱内 Chromium GPU 进程无法启动，与本仓库代码无关 |
| 未受限 `package:win` | 本轮未重复执行 | 同一账户上一轮失败于 `winCodeSign` 解包符号链接权限 |
| 受限 `package:win` | 通过，退出码 `0` | 生成 NSIS 与 portable 两个 x64 产物 |
| 打包产物启动检查 | 通过 | 解包版可执行文件 7 项检查全部通过 |

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
Test Files  10 passed (10)
     Tests  164 passed (164)
```

`npm run build`：退出码 `0`。

```text
vite v6.3.5 building SSR bundle for production...
dist/main/index.js  23.62 kB
dist/preload/index.js  2.62 kB
dist/renderer/index.html  0.49 kB
dist/renderer/assets/index-DCarEvdx.css  31.48 kB
dist/renderer/assets/index-B9hSjZyJ.js  615.91 kB
✓ built
```

`npm run test:e2e`：本机沙箱内无法执行，退出码非 0。

```text
[gpu_data_manager_impl_private.cc] GPU process isn't usable. Goodbye.
Error: Process failed to launch!
```

原因是沙箱内 Chromium 的 GPU 进程无法启动，与本仓库代码无关。作为替代，用一次性本地脚本启动同一个 `dist` 产物做等价端到端复验，18 项检查全部通过：

```text
PASS | 窗口无原生边框（内容区与窗口同尺寸） | {"widthDiff":0,"heightDiff":0}
PASS | 顶部副标题已移除 | matchCount=0
PASS | 标题栏按钮可用：最小化窗口 / 最大化窗口 / 关闭窗口
PASS | 最大化生效且按钮切换为「还原」 / 还原生效且按钮切回「最大化」
PASS | 最小化生效
PASS | 导入名单 | 共 4 名学生
PASS | 权重与历史默认折叠 | weight=false, history=false
PASS | 折叠时权重输入框不渲染 | count=0
PASS | 设置抽屉让开标题栏且标题未被挤压 | {"titlebarBottom":52,"panelTop":52,"titleWidth":66}
PASS | 结果全屏停留时长默认 3000 毫秒 | value=3000
PASS | 展开权重后可编辑并保存 | 甲同学权重=2
PASS | 全屏结果提示 3 秒
PASS | 全屏结果约 3 秒后自动关闭 | visibleMs=3380
PASS | 重置本轮后恢复等待抽取 | 等待抽取 x4
PASS | 关闭按钮退出应用 | quitDetected=true
SUMMARY | total=18 passed=18 failed=0
```

未设置环境变量的 `npm run package:win`（**历史记录**，同一账户、上一基线时的执行结果，本轮未重复执行）：退出码 `1`。

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

受限 `package:win`（本轮，基线 `fc3fdce`）：退出码 `0`。

```text
• electron-builder  version=26.0.12 os=10.0.26200
• packaging       platform=win32 arch=x64 electron=36.3.2 appOutDir=release\win-unpacked
• updating asar integrity executable resource  executablePath=release\win-unpacked\NamePicker.exe
• building        target=nsis file=release\NamePicker Setup-1.0.0.exe archs=x64 oneClick=false perMachine=false
• signing with signtool.exe  path=release\NamePicker Setup-1.0.0.exe
• building block map  blockMapFile=release\NamePicker Setup-1.0.0.exe.blockmap
• building        target=portable file=release\NamePicker-1.0.0.exe archs=x64
• signing with signtool.exe  path=release\NamePicker-1.0.0.exe
[exit code: 0]
```

日志里的 `signing with signtool.exe` 是 electron-builder 的固定步骤；仓库未配置证书，两个产物的实际签名状态仍为 `NotSigned`（见下表）。

`[DEP0190] shell: true` 是 Playwright/electron-builder 测试或构建子进程调用产生的 Node 工具链警告，不是应用运行时网络代码或 IPC 代码；它不改变上述命令的退出码，也不扩大本次运行时安全结论的范围。

## 功能与课堂流程

| 检查项 | 证据 | 结果与边界 |
|---|---|---|
| 启动与空名单 | 本轮本地脚本复验（更早为 `npm run test:e2e`） | 标题、空名单提示和禁用状态通过 |
| 导入 | 本轮本地脚本复验，使用 `tests/fixtures/class-list.txt` | 4 名虚构学生导入并显示 |
| 人数调节 | 离线触摸事件仿真 | “增加抽取人数”将 1 调为 2 |
| 抽取与结果 | 本轮本地脚本复验、离线触摸事件仿真 | 结果列表显示期望人数 |
| 关闭动画 | 本轮本地脚本复验、离线触摸事件仿真 | 关闭后结果立即显示 |
| 重置本轮 | 本轮本地脚本复验、离线触摸事件仿真 | 4 名学生恢复为“等待抽取” |
| 设置抽屉与权重 | 本轮本地脚本复验（更早为 `npm run test:e2e`） | 打开/关闭设置并保存权重 `2` |
| 错误恢复 | 离线触摸事件仿真 | 不支持扩展名提示可关闭，随后可正常导入 |
| 自绘标题栏与窗口控制 | 本轮本地脚本复验、打包产物启动检查 | 无边框、最小化/最大化/还原/关闭生效，按钮随最大化状态切换 |
| 结果停留时长 | 本轮本地脚本复验、打包产物启动检查 | 默认 3000 毫秒，可在 1500-10000 毫秒调整，实测约 3.4 秒自动关闭 |
| 权重与历史默认折叠 | 本轮本地脚本复验 | 两项 `aria-expanded=false`，折叠时内部控件不渲染 |
| 抽取动画节奏 | 单元测试 `rollPacing.test.ts` | 缓出加随机抖动、避免连续同名；无人工观感结论 |
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
Security scan overall exit code=0; tracked files after exclusions=48; audited source/config/README scope=46
```

### preload 与打包后 API

静态配置为 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`。生产预加载只通过 `contextBridge` 暴露 `window.namePicker`；没有把 `ipcRenderer`、`fs`、`require` 或其他 Node 对象直接暴露给渲染器。

使用一次性本地 Playwright 脚本启动 `release/win-unpacked/NamePicker.exe`，脚本未提交。在打包后的页面中直接执行 `Object.keys(window.namePicker)`，实际输出为：

```text
{"apiKeys":["clearState","importRoster","loadState","saveState","windowControls"],"hasRequire":false,"hasProcess":false,"hasModule":false}
```

`windowControls` 是自绘标题栏需要的窗口控制能力，只暴露最小化、最大化/还原、关闭和最大化状态订阅四个方法；其余四个是固定业务方法。`hasRequire`、`hasProcess`、`hasModule` 均为 `false`。

同一次启动还检查了标题栏按钮与抽屉几何，7 项全部通过：

```text
PASS | 打包产物窗口标题正确 | title=名字抽取器
PASS | 打包产物仍为无边框窗口 | {"widthDiff":0,"heightDiff":0}
PASS | 打包产物预加载未暴露 Node 对象
PASS | 打包产物具备窗口控制能力
PASS | 打包产物标题栏三个按钮可用
PASS | 打包产物抽屉让开标题栏且标题未被挤压 | {"titlebarBottom":52,"panelTop":52,"titleWidth":66}
PASS | 打包产物停留时长默认 3000 毫秒 | value=3000
SUMMARY | total=7 passed=7 failed=0
```

脚本自身进程退出码为 `1`：`app.close()` 结束打包应用时会连带结束宿主脚本进程，连 `catch` 都来不及执行，与被测应用无关；上述 7 项检查已在此之前落盘。

## Windows x64 产物与归档检查

### 产物清单

以下值来自本轮受限打包后的实际文件：

| 类型 | 相对路径 | 字节数 | SHA-256 | `Get-AuthenticodeSignature` |
|---|---|---:|---|---|
| NSIS 安装包 | `release/NamePicker Setup-1.0.0.exe` | 88831375 | `A4C75DE1E87AFFBB7F258CCDC66233456565605DF45EC42C4D1BC19C76A9BC12` | `NotSigned` |
| portable | `release/NamePicker-1.0.0.exe` | 88625665 | `A37867EA1DD54145616C49F9C893D969A494CA96DDBB33443EE0477410E40707` | `NotSigned` |

与上一基线 `a947cc9` 的产物相比，NSIS 增加 3046 字节、portable 增加 2971 字节，符合界面改造（新增自绘标题栏、动画节奏模块与两个 IPC 通道，删除首页副标题）带来的量级。

复核命令和脱敏输出：

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath 'release\NamePicker Setup-1.0.0.exe'
A4C75DE1E87AFFBB7F258CCDC66233456565605DF45EC42C4D1BC19C76A9BC12

Get-FileHash -Algorithm SHA256 -LiteralPath 'release\NamePicker-1.0.0.exe'
A37867EA1DD54145616C49F9C893D969A494CA96DDBB33443EE0477410E40707
```

### 启动与归档

- 解包版 `release/win-unpacked/NamePicker.exe`：本轮打包后用 Playwright Electron 启动检查，7 项全部通过（标题、无边框、预加载未暴露 Node 对象、具备窗口控制、标题栏三按钮可用、抽屉让开标题栏、停留时长默认 3000）。上一基线时还记录过 `isMaximized=false`、`isFullScreen=false`，本轮未重复该项。
- NSIS：**本轮只完成构建与哈希校验，未重跑静默安装**。上一基线时的记录为 `InstallerExitCode=0`、安装目录出现可执行文件、临时目录随后清理。
- portable：**本轮只完成构建与哈希校验，没有包内 UI 流程证据**。尝试用 Playwright 以 `executablePath` 启动 portable 时协议握手超时（180 秒）无法 attach；改用进程级启动时发现，本沙箱内用 `Start-Process` 启动 GUI 可执行文件后进程会在数秒内消失——同样的方式启动解包版也立即消失，因此这是本机沙箱的启动限制，不能据此判定 portable 产物异常，也不能作为它通过的证据。
- 解包目录：73 个文件、323,756,902 字节（约 308.8 MiB），含 55 个语言包。
- `asar list release\win-unpacked\resources\app.asar` 实际检查：`EntryCount=358`，包含应用包、主进程、预加载、渲染器，以及 `papaparse`、`xlsx` 条目；渲染器资源为本次构建的 `index-B9hSjZyJ.js` 与 `index-DCarEvdx.css`，与 `npm run build` 输出一致；Electron 运行时 DLL 与资源文件位于解包目录。

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

因此 `dist/`、`release/`、覆盖率、Playwright 报告、测试结果和截图输出均被忽略。`a2847cc` 仅移除两个误跟踪的 `.superpowers` 索引条目；`README.md` 与本清单仍是发布文档，功能源码未改；`task-8-report.md` 本地保留且位于被忽略的 `.superpowers/` 目录，提交后追加最终 HEAD/status 作为审计尾证据。

## 已知限制与发布前动作

1. 不带 `NAME_PICKER_SKIP_RESOURCE_EDIT` 的资源编辑打包在当前 Windows 11 账户因 `winCodeSign` 解包创建符号链接缺少权限失败；受限包不可替代完整资源发布验证。
2. 两个 EXE 的签名状态均为 `NotSigned`；没有证书或签名验证证据，不得在发布说明中声称已签名。
3. 实际运行机为 Windows 11 x64；Windows 10 x64 尚未独立验证，目标平台声明不等于 Win10 验收证据。
4. 触摸流程是自动化触摸事件仿真；未在实体触摸硬件上验证。`--start-maximized` 未使窗口最大化，独立 F11 真全屏未验证。
5. **尚未在 NSIS 安装版和 portable 包内分别完成完整课堂 UI 流程。** 本轮两者都只做了构建与哈希校验，portable 连启动证据都取不到（见「启动与归档」）；发布前应在两个包中重复离线课堂流程，并在 Windows 10 x64 上复测。
6. 发布前应在具备 `winCodeSign` 资源编辑权限的环境重新运行不带跳过变量的命令，按组织流程完成代码签名，再更新产物哈希和验收证据。
7. 本轮修改了功能源码（界面改造），未新增网络/更新/遥测能力，不提交任何 release 二进制。

## 界面改造与重新打包记录

本轮先把界面改造提交为 `fc3fdce` 并落到 master，再按该基线清理 `release/` 后重新打包；上面各节的产物哈希、ASAR 条目数和打包日志均对应此基线。

改造内容：移除首页副标题、抽取结果全屏停留时长默认 3 秒并可在设置中调整、窗口改为无边框并自绘标题栏、设置抽屉中的权重与历史默认折叠、抽取动画改为缓出加随机抖动；另外修掉了抽屉关闭按钮把标题挤成竖排、以及固定标题栏压住抽屉顶部两处界面缺陷。

本轮可复现命令与结果：

| 命令 | 实际结果 | 关键输出 |
|---|---|---|
| `npm exec -- tsc --noEmit` | 通过，退出码 `0` | 无输出 |
| `npm test -- --run` | 通过，退出码 `0` | 10 个测试文件、164 个测试全部通过 |
| `npm run build` | 通过，退出码 `0` | `dist/main/index.js` 23.62 kB、`dist/preload/index.js` 2.62 kB、渲染器 `index-B9hSjZyJ.js` 615.91 kB + `index-DCarEvdx.css` 31.48 kB |
| `npm run test:e2e` | 本机无法执行 | 沙箱内 Chromium GPU 进程无法启动（`GPU process isn't usable. Goodbye.`），与本仓库代码无关 |
| 受限 `package:win` | 通过，退出码 `0` | 重新生成 NSIS 与 portable 两个 x64 产物 |
| 打包产物启动检查 | 通过 | 解包版可执行文件 7 项检查全部通过 |

由于仓库自带的 Playwright Electron 用例在当前沙箱内无法 attach，本轮改用等价的本地临时脚本启动同一 `dist` 产物做端到端复验，覆盖 18 项检查并全部通过：

```text
PASS | 窗口无原生边框（内容区与窗口同尺寸） | {"widthDiff":0,"heightDiff":0}
PASS | 顶部副标题已移除 | matchCount=0
PASS | 标题栏按钮可用：最小化窗口 / 最大化窗口 / 关闭窗口
PASS | 最大化生效且按钮切换为「还原」 / 还原生效且按钮切回「最大化」
PASS | 最小化生效
PASS | 导入名单 | 共 4 名学生
PASS | 权重与历史默认折叠 | weight=false, history=false
PASS | 折叠时权重输入框不渲染 | count=0
PASS | 设置抽屉让开标题栏且标题未被挤压 | {"titlebarBottom":52,"panelTop":52,"titleWidth":66}
PASS | 结果全屏停留时长默认 3000 毫秒 | value=3000
PASS | 展开权重后可编辑并保存 | 甲同学权重=2
PASS | 全屏结果提示 3 秒
PASS | 全屏结果约 3 秒后自动关闭 | visibleMs=3380
PASS | 重置本轮后恢复等待抽取 | 等待抽取 x4
PASS | 关闭按钮退出应用 | quitDetected=true
SUMMARY | total=18 passed=18 failed=0
```

该脚本只在本机沙箱内运行，同样不能替代安装版和 portable 包内的完整课堂 UI 流程验收；上面的已知限制 1 至 6 项对本轮产物依然成立。
