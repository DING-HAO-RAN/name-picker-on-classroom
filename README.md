# 名字抽取器

名字抽取器是一个完全离线运行的 Electron + React + TypeScript 桌面应用，目标平台为 Windows 10/11 x64。本阶段提供安全的 Electron 窗口、渲染器入口和可扩展的课堂名单占位界面。

## 开发命令

```powershell
npm install
npm run dev
npm test -- --run
npm run build
npm run test:e2e
npm run package:win
```

`npm run dev` 启动 Electron 开发模式。`npm run build` 生成 `dist/main/index.js`、`dist/preload/index.js` 和 `dist/renderer/index.html`。`npm run package:win` 使用 Electron Builder 生成 Windows x64 安装包，输出到 `release/`。

## 当前界面

应用显示“名字抽取器”标题和空名单提示。后续功能会通过预加载层的 `window.namePicker` 命名空间接入，渲染器不会直接访问主进程或 Node.js 能力。
