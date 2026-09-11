# Task 5 实现报告：课堂主界面与触摸交互

## RED

先创建 `src/renderer/App.test.tsx`，尚未创建 `App.tsx`，运行：

```text
npm test -- src/renderer/App.test.tsx --run

Test Files  1 failed (1)
Tests  no tests
Error: Failed to resolve import "./App" from "src/renderer/App.test.tsx".
```

失败原因符合预期：组件入口尚不存在，而不是测试拼写或运行环境错误。

## GREEN

聚焦测试最终输出：

```text
npm test -- src/renderer/App.test.tsx --run

Test Files  1 passed (1)
Tests  6 passed (6)
```

覆盖空名单、启动加载、导入保存、名单数量、人数步进器、动画开关、关闭动画立即显示、开始按钮禁用、动画期间防重复提交、重置本轮和安全错误提示。

最终完整验证输出：

```text
npm test -- --run

Test Files  8 passed (8)
Tests  89 passed (89)

npx tsc --noEmit

无输出，退出码 0。

npm run build

主进程、预加载脚本和渲染器均构建成功。

git diff --check

无差异空白错误；仅出现 Windows 换行符自动转换提示。
```

## 文件

新增：

- `src/renderer/App.tsx`
- `src/renderer/App.test.tsx`
- `src/renderer/components/ClassroomHeader.tsx`
- `src/renderer/components/ResultCards.tsx`
- `src/renderer/components/DrawControls.tsx`
- `src/renderer/components/ImportDropzone.tsx`
- `src/renderer/components/ToastMessage.tsx`

修改：

- `src/renderer/main.tsx`
- `src/renderer/styles.css`

## 实现摘要

- 启动时通过 `window.namePicker.loadState()` 恢复名单和动画设置。
- 导入只调用 `window.namePicker.importRoster()`，成功后构造并保存 `RosterState`。
- 抽取使用共享 `drawStudents`；计算结果先保存，动画只延迟结果卡片展示，不重新随机。
- 关闭动画时立即展示结果；动画锁和禁用态共同阻止重复提交。
- 重置使用共享 `resetRound` 并保存，清空当前结果展示。
- 所有错误均转换成面向教师的固定中文提示，不显示路径、堆栈或底层异常内容。
- 控件最小触控尺寸约 56px，提供明显焦点态、`touch-action: manipulation`、可滚动名单/结果列表和不依赖悬停的操作提示。
- 保留 `isSettingsDrawerOpen` 与设置抽屉挂载槽位，未实现 Task 6 的设置抽屉、权重编辑和历史面板。

## 自审

- 渲染层未新增 Node、`fs`、`ipcRenderer` 或 IPC 通道访问。
- 文案和新增源码注释使用中文；共享类型和纯函数保持复用。
- 结果卡片只接受 `students` 与 `isAnimating`；抽取控制通过 `onDraw(count, animate)` 和 `onResetRound()` 回调连接主流程。
- 主要按钮、步进器、复选框和输入框具有清晰禁用态与键盘焦点态。
- 完整测试、类型检查、构建和差异检查均已执行并通过。

## 疑虑

- 简报未规定默认动画开关和时长，本实现选择默认开启、800 毫秒；已通过 `AppSettings` 持久化，后续设置任务可覆盖。
- 本次未启动长期开发服务器，也未实现 Task 6 内容；交互验证以组件测试和生产构建为准。

## Fix round 1：审查问题修复

修复基线：`1188f41`。

1. 在渲染层增加按调用顺序执行的串行保存队列：首个保存立即发起，后续保存等待前一个完成；单次 IPC 保存失败被转换为教师可读提示，同时队列继续处理后续快照。抽取、重置、动画设置和导入均使用同一队列，并使用引用保存最新本地快照；抽取动画、导入和同一事件批次的重复操作受到锁定。
2. 空名单切换动画只更新本地状态，不向主进程保存 `sourceName` 为空的状态；导入成功后再构造并保存完整 `RosterState`。
3. 控件上限改为“权重大于 0 且本轮未抽取”的候选人数；`drawResult.shortage` 会显示“仅抽到 X 人，当前可抽取学生不足。”；即使所有候选都已抽取，名单仍存在时“重置本轮”保持可用。
4. 删除导入区域的拖放事件和拖放文案，保留明确的“导入名单”按钮，并将视觉边框改为普通边框，避免暗示未实现的拖放能力。
5. 导入错误依据 `error.code` 处理 `IMPORT_CANCELLED`，显示“已取消导入。”；其他异常仍显示通用失败提示。
6. 新增保存延迟/串行、保存失败继续、加载失败、空设置保存、取消导入、候选上限/全员已抽取重置、shortage 提示、动画前后学生身份、快速重复抽取/导入等真实行为测试。
7. Toast 关闭按钮最小高度调整为 56px；删除 Task 5 中未使用的设置抽屉 state、slot 和对应样式。

## Fix round 1：TDD 实际输出

### RED

先加入 11 个回归测试（聚焦文件共 17 项），保持原实现不变，运行：

```text
npm test -- src/renderer/App.test.tsx --run

Test Files  1 failed (1)
Tests  9 failed | 8 passed (17)
```

失败覆盖：空名单切换错误保存、取消导入文案、拖放假能力、候选人数上限、shortage 提示、保存串行与失败续写、快速重复抽取和快速重复导入；失败均指向原实现行为而非测试解析错误。

### GREEN

实现修复后聚焦测试实际输出：

```text
npm test -- src/renderer/App.test.tsx --run

Test Files  1 passed (1)
Tests  17 passed (17)
```

完整测试实际输出：

```text
npm test -- --run

Test Files  8 passed (8)
Tests  100 passed (100)
```

其他验证实际结果：

```text
npx tsc --noEmit

无输出，退出码 0。

npm run build

主进程、预加载脚本和渲染器均构建成功。

git diff --check

无差异空白错误；仅有 Git 关于 Windows 换行符自动转换的提示。
```

补充的动画身份断言也遵循 RED/GREEN：先加入 `data-student-id` 断言时实际为 `Tests 1 failed | 16 passed (17)`，失败值为 `undefined` 对比预期学生 ID；在结果卡片保留学生 ID 后重新运行，实际恢复为 `Tests 17 passed (17)`。

## Fix round 2：复审问题修复

修复基线：`c7c2770`。

### 修复内容

1. `App.tsx` 的非动画抽取、零时长抽取和重置本轮均把 `interactionLockRef` 保持到对应 `saveState` promise 完成（成功或失败）后；动画抽取在结果展示和保存完成两个条件都满足后才释放锁。保存完成前的重复抽取/重置不会追加第二次操作，保存完成后才允许继续。
2. `ImportDropzone.tsx` 保留 `onDragOver` 与 `onDrop`，两者只调用 `preventDefault()`，不读取 `dataTransfer.files`、不调用导入 API，避免 Electron/Chromium 拖入文件触发默认导航；同时不恢复拖放能力文案。
3. `App.test.tsx` 新增真实 deferred save 竞态测试，分别覆盖非动画抽取、重置和动画结果已展示但保存未完成的场景；保存完成后再次操作会产生下一次保存调用。拖放测试同时断言 dragover/drop 的 `preventDefault` 和 `onImport` 未调用。原有串行保存/失败续写测试调整为符合保存完成前锁定的行为。

### Fix round 2：TDD 实际输出

#### RED

先加入 deferred save 与拖放回归断言，保持 `c7c2770` 实现不变，运行：

```text
npm test -- src/renderer/App.test.tsx --run

Test Files  1 failed (1)
Tests  4 failed | 16 passed (20)
```

失败项为三个保存竞态测试和拖放默认行为测试，均指向旧实现提前释放锁或未阻止默认行为。

#### GREEN

修复后的竞态聚焦测试：

```text
npm test -- src/renderer/App.test.tsx --run -t "非动画|重置本轮在|动画结果展示"

Test Files  1 passed (1)
Tests  3 passed | 17 skipped (20)
```

完整 renderer 回归测试：

```text
npm test -- src/renderer/App.test.tsx --run

Test Files  1 passed (1)
Tests  20 passed (20)
```

#### 完整验证

```text
npm test -- --run

Test Files  8 passed (8)
Tests  103 passed (103)

npx tsc --noEmit

无输出，退出码 0。

npm run build

vite v6.3.5 building SSR bundle for production...
✓ built in 80ms
✓ built in 10ms
vite v6.3.5 building for production...
✓ built in 441ms

git diff --check

无差异空白错误；仅有 Git 关于 Windows 换行符自动转换的提示。
```

范围检查：`git diff --name-only` 仅包含 `src/renderer/App.test.tsx`、`src/renderer/App.tsx` 和 `src/renderer/components/ImportDropzone.tsx`；未新增 IPC、`fs` 或 Task 6 内容。
