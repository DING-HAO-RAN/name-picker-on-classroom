# 名字抽取器发布验收清单

## 验收结论

**有条件通过，不等同于完整生产发布通过。** 当前代码、离线课堂流程、Windows x64 受限打包和产物完整性检查均有本机证据；完整资源编辑验证、代码签名和独立 Windows 10 验证仍未完成。

- 验收基线：`a8312eb`
- 应用版本：`1.0.0`
- 目标：Windows 10/11 x64
- 本次实际环境：Windows 11 家庭版中文版，版本/构建 `10.0.26200/26200`，64-bit
- 工具链：Node `v24.16.0`、npm `11.13.0`、Electron `v36.3.2`、electron-builder `26.0.12`

## 可复现命令与结果

在仓库根目录执行。除打包命令外，不需要网络服务或开发服务器。

| 命令 | 实际结果 | 关键输出 |
|---|---|---|
| `npm test -- --run` | 通过，退出码 0 | 9 个测试文件、118 个测试全部通过 |
| `npm run build` | 通过，退出码 0 | 主进程、预加载脚本、渲染器均生成到 `dist/` |
| `npm run test:e2e` | 通过，退出码 0 | 1 个 Electron E2E 测试通过，用本地虚构夹具 |
| `npm run package:win` | 失败，退出码 1 | `winCodeSign` 解包创建符号链接时权限不足 |
| `$env:NAME_PICKER_SKIP_RESOURCE_EDIT='1'; npm run package:win` | 通过，退出码 0 | 生成 NSIS 与 portable 两个 x64 产物 |

受限打包的完整可复现写法：

```powershell
$env:NAME_PICKER_SKIP_RESOURCE_EDIT = '1'
npm run package:win
Remove-Item Env:NAME_PICKER_SKIP_RESOURCE_EDIT
```

> [!WARNING]
> 设置 `NAME_PICKER_SKIP_RESOURCE_EDIT=1` 只绕过本机 `winCodeSign` 资源编辑解包限制，不能称为完整资源发布验证。生产发布必须在具备符号链接权限的环境中不设置该变量重新打包，并另外配置和验证签名。

### 实际命令输出

为遵守隐私要求，下面的输出把本机工作树、用户缓存和临时目录统一写成占位符；版本、数量、退出码、哈希和错误文本保持实际值。构建过程中重复的同一下载/解包错误合并记录。

`npm test -- --run`：

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

`npm run build`：

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

`npm run test:e2e`：

```text
> name-picker@1.0.0 test:e2e
> npm run build && playwright test

Running 1 test using 1 worker

  ok 1 tests/e2e/classroom-flow.spec.ts:52:5 › 完成启动、导入、抽取、重置和权重设置流程 (594ms)

  1 passed (3.0s)
[stderr]
Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
DeprecationWarning: Passing args to a child process with shell option true can lead to security vulnerabilities, only a warning.
```

未设置环境变量的 `npm run package:win` 关键实际输出：

```text
• electron-builder  version=26.0.12 os=10.0.26200
• executing @electron/rebuild  electronVersion=36.3.2 arch=x64 buildFromSource=false
• packaging       platform=win32 arch=x64 electron=36.3.2 appOutDir=release\win-unpacked
• updating asar integrity executable resource
• downloading     winCodeSign-2.6.0 size=5.6 MB
ERROR: Cannot create symbolic link : 客户端没有所需的特权。
• Above command failed, retrying 3 more times
[exit code: 1]
```

受限打包的关键实际输出：

```text
> name-picker@1.0.0 package:win
> npm run build && electron-builder --config electron-builder.config.cjs --win nsis portable --x64 --publish never

• electron-builder  version=26.0.12 os=10.0.26200
• loaded configuration  file=<WORKTREE>/electron-builder.config.cjs
• executing @electron/rebuild  electronVersion=36.3.2 arch=x64 buildFromSource=false
• packaging       platform=win32 arch=x64 electron=36.3.2 appOutDir=release\win-unpacked
• updating asar integrity executable resource
• building        target=nsis file=release\NamePicker Setup-1.0.0.exe archs=x64 oneClick=false perMachine=false
• building block map  blockMapFile=release\NamePicker Setup-1.0.0.exe.blockmap
• building        target=portable file=release\NamePicker-1.0.0.exe archs=x64
[stderr]
DeprecationWarning: Passing args to a child process with shell option true can lead to security vulnerabilities, only a warning.
[exit code: 0]
```

## 功能与课堂流程

| 检查项 | 证据 | 结果与边界 |
|---|---|---|
| 启动与空名单 | `npm run test:e2e` | 标题显示、空名单提示显示、开始按钮禁用：通过 |
| 导入 | E2E 使用 `tests/fixtures/class-list.txt` | 4 名虚构学生导入并显示：通过 |
| 人数调节 | 离线触摸事件仿真 | “增加抽取人数”将 1 调为 2：通过 |
| 抽取与结果 | E2E、离线触摸事件仿真 | 结果列表显示期望人数：通过 |
| 关闭动画 | E2E、离线触摸事件仿真 | 关闭后结果立即显示：通过 |
| 重置本轮 | E2E、离线触摸事件仿真 | 4 名学生恢复为“等待抽取”：通过 |
| 设置抽屉与权重 | `npm run test:e2e` | 打开/关闭设置并保存权重 `2`：通过 |
| 错误恢复 | 离线触摸事件仿真 | 先注入不支持扩展名，提示可关闭；随后正常导入：通过 |
| 窗口启动 | `--start-maximized` 启动生产构建 | 实际视口 `1266×737`；`isMaximized=false`、`isFullScreen=false`，未做实体 F11 全屏验证 |
| 实体触摸屏 | Chromium `--touch-events=enabled` 加 Playwright touch pointer 事件 | 自动化触摸事件仿真通过；当前机没有独立实体触摸屏证据 |

离线触摸事件仿真的实际输出：

```text
{"initial":{"title":"名字抽取器","heading":"名字抽取器","touchAvailable":true,"viewport":{"width":1266,"height":737},"importButtonMinHeight":"56px"},"windowState":{"maximized":false,"fullScreen":false}}
{"flow":"offline touch event sequence","result":"passed"}
[stderr]
DeprecationWarning: Passing args to a child process with shell option true can lead to security vulnerabilities, only a warning.
```

该补充验证使用已生成的 `dist/main/index.js`、临时隔离用户数据目录、`offline: true`、`--touch-events=enabled` 和 `--start-maximized`；触摸事件序列覆盖错误提示恢复、导入、人数调节、关闭动画、抽取、重置、设置抽屉开关。临时脚本及数据已删除，未纳入提交。

## 安全与隐私

- `src/main/index.ts` 的窗口配置为 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`。
- `src/preload/index.ts` 只导入 Electron 的 `contextBridge`/`ipcRenderer`，只暴露 `namePicker` 下的 `importRoster`、`loadState`、`saveState`、`clearState` 四个固定业务方法；没有暴露 `fs`、`path`、`require` 或原始 IPC 对象。
- `src/preload/index.test.ts` 的断言验证了暴露对象键集合以及不存在 Node 能力；打包后预加载归档检查结果一致。
- 生产源码未发现 `fetch`、XHR、WebSocket、axios、`node:http`、`node:https` 或 `node:net` 调用。仅发现开发 URL 白名单和安全测试中的 loopback/拒绝样例，不是发布端点。
- 源码和文档未写入本机工作树、用户目录、账号、密钥或真实名单。扫描命中的是测试专用虚构姓名、路径错误文本和脱敏测试占位字段；不含当前机器的实际路径或凭据。
- `tests/fixtures/class-list.txt` 仅包含“甲同学、乙同学、丙同学、丁同学”四个通用虚构值。
- 未发现更新服务器、云同步、遥测、自定义联网协议或其他运行时联网配置。依赖锁文件中的包仓库元数据不属于应用运行时端点。

## Windows x64 产物与自包含检查

### 产物清单

| 类型 | 相对路径 | 字节数 | SHA-256 | `Get-AuthenticodeSignature` |
|---|---|---:|---|---|
| NSIS 安装包 | `release/NamePicker Setup-1.0.0.exe` | 88822732 | `9D3165ADFB85B37B24D0AF8D383A1BC2722A84F078806A98CAAA660095B1D4AC` | `NotSigned` |
| portable | `release/NamePicker-1.0.0.exe` | 88617100 | `C30EB9472620A079BF43C7EDBE38B3C5943790F3F17CD2AF51AFCCCD2E293ACE` | `NotSigned` |

哈希命令及实际结果：

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath 'release\NamePicker Setup-1.0.0.exe'
9D3165ADFB85B37B24D0AF8D383A1BC2722A84F078806A98CAAA660095B1D4AC

Get-FileHash -Algorithm SHA256 -LiteralPath 'release\NamePicker-1.0.0.exe'
C30EB9472620A079BF43C7EDBE38B3C5943790F3F17CD2AF51AFCCCD2E293ACE
```

### 启动与归档

- `release/win-unpacked/NamePicker.exe`：Playwright Electron 启动检查得到标题“名字抽取器”和一级标题“名字抽取器”；`window.namePicker` 存在，`window.require`、`window.process`、`window.module` 均为非暴露状态。启动后可关闭；同次检查记录 `isMaximized=false`、`isFullScreen=false`。
- NSIS：静默安装命令返回 `InstallerExitCode=0`，安装目录出现 `NamePicker.exe`；安装后的新进程在 8 秒检查点均为响应状态，临时安装目录随后清理。
- portable：直接启动命令在 8 秒检查点发现 4 个 `NamePicker.exe` 进程，4 个均为响应状态；进程随后清理。该项是进程级启动检查，不替代独立系统上的 UI 流程验收。
- `npx asar list release\win-unpacked\resources\app.asar` 检查结果：`EntryCount=358`，包含 `package.json`、`dist/main/index.js`、`dist/preload/index.js`、`dist/renderer/index.html`、`papaparse` 和 `xlsx`；Electron 运行时 DLL 与资源文件位于解包目录。
- `release/` 中的 EXE、blockmap、builder 调试输出均为本地交付物，未提交到 Git。

## 忽略规则

实际执行：

```text
git check-ignore -v --no-index dist/main/index.js release/NamePicker-1.0.0.exe coverage/index.html playwright-report/index.html test-results/example.txt screenshots/example.png
.gitignore:2:dist/       dist/main/index.js
.gitignore:3:release/    release/NamePicker-1.0.0.exe
.gitignore:4:coverage/   coverage/index.html
.gitignore:5:playwright-report/ playwright-report/index.html
.gitignore:6:test-results/ test-results/example.txt
.gitignore:7:screenshots/ screenshots/example.png
```

因此 `dist/`、`release/`、覆盖率、Playwright 报告、测试结果和截图输出均被忽略。

## 已知限制与发布前动作

1. 本机未设置跳过开关的资源编辑打包因 `winCodeSign` 解包创建符号链接缺少权限失败；受限包不可替代完整资源发布验证。
2. 两个 EXE 均为 unsigned；没有证书或签名验证证据，不得在发布说明中声称已签名。
3. 实际运行机为 Windows 11 x64；Windows 10 x64 尚未独立验证，目标平台声明不等于 Win10 验收证据。
4. 触摸流程是自动化触摸事件仿真；未在实体触摸硬件上验证。`--start-maximized` 未使窗口最大化，独立 F11 真全屏未验证。
5. 发布前应在具备 `winCodeSign` 资源编辑权限的 Windows 环境重新运行不带 `NAME_PICKER_SKIP_RESOURCE_EDIT` 的命令，并按组织流程完成代码签名；随后在 Windows 10 x64 安装版与 portable 版重复离线课堂流程。
6. 本任务不修改功能源码、不新增网络/更新/遥测，不提交任何 release 二进制。
