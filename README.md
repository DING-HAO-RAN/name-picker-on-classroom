# 名字抽取器

名字抽取器是一个 Electron + React + TypeScript 桌面应用，目标平台为 Windows 10/11 x64，按离线使用设计。名单、抽取状态、权重和历史只保存在本机；当前应用未配置上传姓名、自动更新、云同步或遥测。

## 开发命令

```powershell
npm install
npm run dev
npm test -- --run
npm run build
npm run test:e2e
npm run package:win
```

`npm run dev` 启动 Electron 开发模式。`npm run build` 生成主进程、预加载脚本和渲染器资源。`npm run test:e2e` 会先构建本地应用，再使用 Playwright Electron 能力启动它；测试通过仓库内的虚构夹具和主进程文件对话框替身验证启动、导入、抽取、重置、设置抽屉与权重编辑，不依赖网络。

`electron-builder.config.cjs` 默认启用 Windows 可执行文件资源编辑。当前受限构建机没有创建 `winCodeSign` 所需符号链接的权限时，使用明确的跳过开关；示例结束后会清理环境变量：

```powershell
$env:NAME_PICKER_SKIP_RESOURCE_EDIT = '1'
npm run package:win
Remove-Item Env:NAME_PICKER_SKIP_RESOURCE_EDIT
```

该命令只代表受限构建，不是完整资源发布验证；生产发布必须在具备资源编辑权限的机器上不设置此变量运行。资源编辑与代码签名相互独立；仓库未配置证书时，产物仍为 unsigned，不虚构签名状态。

## Windows x64 发布包

当前版本为 `1.0.0`。下表是本机 Windows 11 x64 受限资源编辑打包得到的本地交付物；文件位于 `release/`，受 Git 忽略规则保护，不提交到仓库。

```powershell
$env:NAME_PICKER_SKIP_RESOURCE_EDIT = '1'
npm run package:win
Remove-Item Env:NAME_PICKER_SKIP_RESOURCE_EDIT
```

| 类型 | 文件 | 大小（字节） | SHA-256 | 签名 |
| --- | --- | ---: | --- | --- |
| NSIS 安装包 | `release/NamePicker Setup-1.0.0.exe` | 88822810 | `EFB847839F1BAE6E21E0333E1D3CDC64D3CA6CC550B73D7D08CB448B0CFDADEE` | `NotSigned` |
| portable | `release/NamePicker-1.0.0.exe` | 88617100 | `8BD146A0A20272B443D3BA0639BA835DD93155A11F5AE50B371D673519EF0311` | `NotSigned` |

### 当前验收边界

- 当前证据覆盖 `app.asar`/归档条目、解包目录中的 Electron 运行时文件、当前机离线检查，以及安装版和 portable 的进程级启动检查。归档中可见主进程、预加载、渲染器和 `papaparse`、`xlsx` 依赖；这只是内容与启动证据。
- 尚未在安装版和 portable 两个包内分别完成完整课堂 UI 流程（导入、人数调节、抽取、动画、重置、设置和错误恢复），因此不能声称已完成包级全流程验收，也不能仅凭进程启动声称普遍“可用”。`npm run test:e2e` 和离线触摸事件仿真是对构建输出的证据，不替代两个发布包的 UI 流程验收。
- 未设置跳过开关的完整资源编辑打包在本机因 `winCodeSign` 解包创建符号链接缺少权限而以退出码 `1` 失败；受限打包以退出码 `0` 完成。本次结果不是完整资源发布验证。
- 两个产物均为 unsigned；Windows 10 x64 尚未独立验证。触摸证据是 Chromium/Playwright 触摸事件仿真，不是实体触摸屏验证；自动化启动还记录 `isMaximized=false`、`isFullScreen=false`，未宣称真全屏已验证。

测试/打包 stderr 中的 `[DEP0190]` `shell: true` 警告来自 Playwright/electron-builder 调用测试或构建子进程的工具链，不是应用运行时网络或 IPC 代码；本次 `test:e2e` 和受限打包仍分别以退出码 `0` 完成，完整资源编辑打包的退出码 `1` 原因仍是 `winCodeSign` 权限限制。

## 当前界面

应用显示“名字抽取器”标题和课堂名单入口。导入后可调整抽取人数、关闭动画、开始抽取、重置本轮，并在设置抽屉中搜索学生和编辑权重。渲染器通过预加载层的 `window.namePicker` 命名空间接入，不能直接访问主进程或 Node.js 能力。
