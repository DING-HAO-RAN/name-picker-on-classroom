# 名字抽取器

名字抽取器是一个完全离线运行的 Electron + React + TypeScript 桌面应用，目标平台为 Windows 10/11 x64。名单、抽取状态、权重和历史只保存在本机，不上传姓名或其他数据。

## 开发命令

```powershell
npm install
npm run dev
npm test -- --run
npm run build
npm run test:e2e
npm run package:win
```

`npm run dev` 启动 Electron 开发模式。`npm run build` 生成主进程、预加载脚本和渲染器资源。`npm run test:e2e` 会先构建本地应用，再使用 Playwright Electron 能力启动它；测试通过本地虚构夹具和主进程文件对话框替身验证启动、导入、抽取、重置、设置抽屉与权重编辑，不依赖网络。

`electron-builder.config.cjs` 默认启用 Windows 可执行文件资源编辑，以确保发布包使用应用元数据和图标。当前受限构建机没有创建 `winCodeSign` 所需符号链接的权限时，使用明确的跳过开关：

```powershell
$env:NAME_PICKER_SKIP_RESOURCE_EDIT = '1'
npm run package:win
```

该命令只代表受限构建，不是完整资源发布验证；生产发布必须在具备资源编辑权限的机器上不设置此变量运行。资源编辑与代码签名相互独立；仓库未配置证书时，产物仍为 unsigned，不虚构签名状态。

## Windows x64 发布包

当前版本为 `1.0.0`。本次在 Windows 11 x64 开发机上使用受限资源编辑模式打包，产物位于 `release/`：

```powershell
$env:NAME_PICKER_SKIP_RESOURCE_EDIT = '1'
npm run package:win
Remove-Item Env:NAME_PICKER_SKIP_RESOURCE_EDIT
```

| 类型 | 文件 | 大小（字节） | SHA-256 | 签名 |
| --- | --- | ---: | --- | --- |
| NSIS 安装包 | `release/NamePicker Setup-1.0.0.exe` | 88822732 | `9D3165ADFB85B37B24D0AF8D383A1BC2722A84F078806A98CAAA660095B1D4AC` | `NotSigned` |
| portable | `release/NamePicker-1.0.0.exe` | 88617100 | `C30EB9472620A079BF43C7EDBE38B3C5943790F3F17CD2AF51AFCCCD2E293ACE` | `NotSigned` |

两个产物都包含 Electron 运行时和应用归档；安装版静默安装返回 0 且安装后的可执行文件进程保持响应，portable 进程启动检查也保持响应。应用归档包含主进程、预加载、渲染器以及 `papaparse`、`xlsx` 依赖，不需要额外运行时或网络连接。

未设置跳过开关的完整资源编辑打包在本机因 `winCodeSign` 解包创建符号链接缺少权限而失败，因此本次结果不是完整资源发布验证。仓库没有签名证书，两个产物均为 unsigned；生产发布必须在具备资源编辑权限和签名配置的环境中重新验证。Windows 10 x64 尚未独立验证；当前自动化启动记录 `isMaximized=false`、`isFullScreen=false`，未宣称真全屏已验证。

发布配置使用 `build/icon.ico` 和 `build/installer.nsh`，未配置发布服务器、自动更新、云同步、遥测或自定义联网协议。`release/` 中的二进制仅作为本地交付物，已加入 Git 忽略规则，不提交到仓库。

## 当前界面

应用显示“名字抽取器”标题和课堂名单入口。导入后可调整抽取人数、关闭动画、开始抽取、重置本轮，并在设置抽屉中搜索学生和编辑权重。渲染器通过预加载层的 `window.namePicker` 命名空间接入，不能直接访问主进程或 Node.js 能力。
