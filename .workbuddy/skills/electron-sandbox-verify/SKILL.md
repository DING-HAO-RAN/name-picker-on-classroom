---
name: electron-sandbox-verify
description: 在本机受限沙箱（Windows + WorkBuddy）里启动、截图并端到端验证 Electron 桌面应用。当 npm run test:e2e 报 Chromium GPU 错误、Playwright 无法 attach、Electron 报 bad option: --user-data-dir、或需要量取界面盒模型做视觉回归时使用。
---

# 在受限沙箱中验证 Electron 应用

本机沙箱缺少 GPU，Chromium 的 GPU 进程无法启动（`gpu_data_manager_impl_private.cc: GPU process isn't usable. Goodbye.`），
导致仓库自带的 `npm run test:e2e`（Playwright Electron）无法 attach。这与被测项目代码无关。
本技能给出经过验证的替代路径：直接用 Playwright 启动同一个 `dist` 产物。

## 硬性前提（每次都做）

1. **清除宿主注入的环境变量**：WorkBuddy 客户端会注入 `ELECTRON_RUN_AS_NODE=1`，它会让 Electron 被当成 Node 启动并报
   `bad option: --user-data-dir`。
   ```powershell
   Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
   ```
2. **先构建再验证**：脚本加载的是 `dist/`，改了源码必须先 `npm run build`，否则验的是旧产物。
3. **用托管 node 的绝对路径**运行脚本，不要依赖 PATH。

## 启动参数

Playwright 必须带全这五个开关，缺 `--disable-software-rasterizer` 或 `--no-sandbox` 都会拉起失败：

```js
const app = await electron.launch({
  args: [
    '--no-sandbox',
    '--disable-gpu',
    '--disable-gpu-sandbox',
    '--disable-software-rasterizer',
    '--disable-dev-shm-usage',
    `--user-data-dir=${userDataDir}`,   // mkdtemp 出来的临时目录，跑完删掉
    join(projectRoot, 'dist', 'main', 'index.js'),
  ],
});
```

`projectRoot` 用 `resolve(__dirname, '..', '..')` 推导，脚本里不要写死本机绝对路径。

## 脚本骨架

脚本放在工作树之外（例如 `.workbuddy/scripts/`），保留作可复现痕迹。要点：

- 用 `record(name, passed, detail)` 累积结果，末尾打印 `SUMMARY | total= passed= failed=` 并按失败数 `process.exit`。
- 断言分两类：UI 行为（`getByRole` / `getByText`）和几何/窗口事实（`page.evaluate` 取 `getBoundingClientRect`，
  或 `app.evaluate(({ BrowserWindow }) => …)` 取 `isMaximized` / `getBounds`）。
- **判定应用是否退出**不要用 `app.waitForEvent('close')`：Playwright 给主进程挂了 Node 调试器，进程会停在
  `Waiting for the debugger to disconnect...`。改用「`page.isClosed()` 为真」或「`app.evaluate` 抛错」判定，
  等待用真实 `setTimeout`（页面关闭后 `page.waitForTimeout` 会抛错）。
- 断言布局缺陷时优先量盒模型，不要只看截图感觉，例如「固定标题栏不能被抽屉压住」：
  ```js
  const g = await page.evaluate(() => ({
    barBottom: Math.round(document.querySelector('.app-titlebar').getBoundingClientRect().bottom),
    panelTop: Math.round(document.querySelector('.settings-drawer__panel').getBoundingClientRect().top),
    titleWidth: Math.round(document.querySelector('#settings-drawer-title').getBoundingClientRect().width),
  }));
  // panelTop 应等于 barBottom；titleWidth 明显小于文字宽度说明被同行元素挤成了竖排
  ```
- 截图脚本同样用 `--disable-gpu` 启动，`page.screenshot({ path })` 输出到被 .gitignore 忽略的目录。

## 本机工具链坑（会反复踩）

- **Bash 工具是 Git Bash 且缺 coreutils**：`ls` / `find` / `head` / `grep` 都不可用。文件操作用 Python 脚本，
  内容检索用专用检索工具，不要指望 shell 管道。
- **PowerShell 工具的 stdout 在本会话不回传**：只把它当执行副作用的手段——把结果写进文件，再用读文件工具读。
- **PowerShell 5.1 的 `>` 重定向写 UTF-16**，读文件工具会判定为二进制。一律用 `| Out-File -FilePath X -Encoding utf8`。
- 探针脚本判断「窗口是否真的无边框」：比较 `getBounds()` 与 `getContentBounds()`，两者差值为 0 即为无边框。

## 结论口径

这类脚本只能证明「在 build 产物上、在临时用户数据目录里、离线跑通」。
不得据此宣称安装包级验收、实体触摸屏验收、Windows 版本兼容性或签名状态。发布结论必须以仓库发布清单中
实际执行过的命令为准。
