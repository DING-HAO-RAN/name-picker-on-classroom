# 名字抽取器

一个给课堂用的离线随机点名桌面应用。导入一份名单就能抽取学生，支持按权重抽取、关闭重复抽取、动画节奏调节与全屏结果展示；窗口标题栏按应用主题自绘，不套用 Windows 原生样式。

名单、抽取权重、本轮状态与历史记录全部只保存在本机。应用不上传姓名、不联网、不含自动更新与遥测。

- 技术栈：Electron 36 + React 19 + TypeScript 5.8 + electron-vite
- 目标平台：Windows 10/11 x64

## 下载

不想自己构建的话，直接从 Releases 取编译好的 Windows x64 程序：

- [NamePicker-Setup-1.0.0.exe](https://github.com/DING-HAO-RAN/name-picker-on-classroom/releases/download/v1.0.0/NamePicker-Setup-1.0.0.exe)：NSIS 安装包，可选安装位置和快捷方式，能在「应用和功能」里卸载
- [NamePicker-1.0.0.exe](https://github.com/DING-HAO-RAN/name-picker-on-classroom/releases/download/v1.0.0/NamePicker-1.0.0.exe)：便携包，不需要安装权限，可直接放进 U 盘随堂携带

两者都没有代码签名，Windows SmartScreen 会提示「未知发布者」，需要点「更多信息 → 仍要运行」。下载后建议核对 Release 页面里给出的 SHA-256，完整的验证边界同样写在页面说明中。

## 功能

- 导入名单：支持 `txt` / `csv` / `xlsx`，导入后即可调整抽取人数
- 抽取与结果：可关闭重复抽取，结果会全屏展示，停留时长默认 3 秒（1500 - 10000 毫秒可调）
- 抽取动画：名字切换用缓出曲线加随机抖动，先快后慢、节奏不均匀，最后一刻才定格
- 学生权重：在设置抽屉里搜索学生并编辑权重，也可以一键恢复默认权重
- 历史记录：保留最近 50 次抽取结果，可重置本轮
- 主题与无障碍：明亮 / 深色主题，控件按触摸优先设计，关键操作都有键盘快捷键
- 本机数据：设置里可清除保存在本机的全部数据（二次确认）

## 快速开始

环境要求：Node.js 20 及以上、npm。

```powershell
npm install
npm run dev          # 启动 Electron 开发模式
npm test -- --run    # 单元测试（vitest + Testing Library）
npm run build        # 构建主进程、预加载脚本与渲染器资源
npm run test:e2e     # 先构建，再用 Playwright Electron 跑端到端流程
```

`npm run test:e2e` 使用仓库内的虚构夹具和主进程文件对话框替身，验证启动、导入、抽取、重置、设置抽屉与权重编辑，不依赖网络。

## 打包

```powershell
npm run package:win
```

产出 NSIS 安装包与 portable 便携包（x64，输出到 `release/`，该目录受 Git 忽略规则保护）。

打包默认启用 Windows 可执行文件资源编辑。如果构建机缺少创建符号链接的权限（`winCodeSign` 解包会失败），可以用明确的跳过开关，命令结束后清理环境变量：

```powershell
$env:NAME_PICKER_SKIP_RESOURCE_EDIT = '1'
npm run package:win
Remove-Item Env:NAME_PICKER_SKIP_RESOURCE_EDIT
```

该命令只代表受限构建，**不是完整资源发布验证**；生产发布应在具备资源编辑权限的机器上不设置此变量运行，并按组织流程完成代码签名。仓库未配置证书，产物始终是未签名状态。

## 数据与安全边界

- 数据只落在本机，通过主进程的本地存储读写，无网络请求、无遥测、无自动更新
- 渲染器只能通过预加载层暴露的 `window.namePicker` 访问主进程能力（`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`）
- 名单导入在主进程校验扩展名与解析结果，错误信息经固定文案映射后返回，不把路径或堆栈抛给界面

## 界面行为约定

- 窗口使用 `frame: false`，标题栏由渲染器按当前主题自绘（含最小化、最大化 / 还原、关闭按钮）；最大化状态由主进程推送给渲染器，双击标题栏也可最大化。设置抽屉从标题栏下沿开始，不会被窗口外框遮挡。
- 抽取结果全屏展示，停留时长默认 3 秒，可在设置抽屉中调整；旧存档里内置的 1000 毫秒会在加载时迁移为新的默认值。
- 设置抽屉中的“学生权重”和“最近抽取”默认折叠，避免面板过长；折叠时内部控件不渲染，键盘焦点不会落到不可见元素上。
- 抽取动画的名字切换使用缓出曲线加随机抖动，先快后慢且节奏不均匀，最后一刻才定格结果。

## 项目结构

```text
src/
  main/       主进程：窗口、IPC 处理器、名单导入、本地存储
  preload/    预加载：通过 contextBridge 暴露 window.namePicker
  renderer/   渲染器：React 界面、抽取动画节奏、样式
  shared/     主进程与渲染器共用的类型与 IPC 契约
tests/        端到端用例与虚构夹具
docs/         发布验收清单
```

## 发布验收边界

完整的验收证据、已知限制与发布前动作记录在 [`docs/release-checklist.md`](docs/release-checklist.md)。要点：

- 当前的运行时证据来自构建产物与解包目录，尚未在 NSIS 安装版和 portable 包内分别跑完一套完整的课堂 UI 流程
- Windows 10 x64 尚未独立验证；触摸流程是事件仿真，不是实体触摸屏验证
- 两个产物均为未签名，不能声称已签名

## 开源协议

[MIT](LICENSE)
