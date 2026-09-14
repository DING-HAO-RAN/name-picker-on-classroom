/**
 * 一次性端到端验证脚本（保留作为验证痕迹，不属于应用运行时产物）。
 *
 * 背景：本机沙箱里 Chromium 的 GPU 进程无法启动（gpu_data_manager_impl_private.cc:
 * "GPU process isn't usable. Goodbye."），`npm run test:e2e` 因此无法attach，
 * 这与仓库代码无关。这里用 `--disable-gpu` 启动同一个 dist 产物，
 * 覆盖本次改动涉及的真实运行行为：自绘标题栏、窗口控制、停留时长、
 * 默认折叠、抽取与全屏结果的自动关闭。
 */

const { _electron: electron } = require('playwright');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const projectRoot = resolve(__dirname, '..', '..');
const fixturePath = join(projectRoot, 'tests', 'fixtures', 'class-list.txt');
const checks = [];

function record(name, passed, detail) {
  checks.push({ name, passed });
  console.log(`${passed ? 'PASS' : 'FAIL'} | ${name} | ${detail}`);
}

async function main() {
  const userDataDir = await mkdtemp(join(tmpdir(), 'name-picker-verify-'));
  let app;
  let appClosed = false;

  try {
    app = await electron.launch({
      args: [
        // 仅为本机沙箱环境放宽 Chromium 进程限制，项目自身的窗口配置未做任何放宽
        '--no-sandbox',
        '--disable-gpu',
        '--disable-gpu-sandbox',
        '--disable-software-rasterizer',
        '--disable-dev-shm-usage',
        `--user-data-dir=${userDataDir}`,
        join(projectRoot, 'dist', 'main', 'index.js'),
      ],
    });
    const page = await app.firstWindow();
    await page.getByRole('heading', { name: '名字抽取器' }).waitFor();

    // 1. 自绘标题栏替换原生窗口边框：无边框时内容区尺寸等于窗口尺寸
    const frameInsets = await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      const bounds = window.getBounds();
      const content = window.getContentBounds();
      return { widthDiff: bounds.width - content.width, heightDiff: bounds.height - content.height };
    });
    record(
      '窗口无原生边框（内容区与窗口同尺寸）',
      frameInsets.widthDiff === 0 && frameInsets.heightDiff === 0,
      JSON.stringify(frameInsets),
    );

    // 2. 顶部副标题已移除
    const subtitleCount = await page.getByText('让每一次课堂点名都公平、清晰、轻松。').count();
    record('顶部副标题已移除', subtitleCount === 0, `matchCount=${subtitleCount}`);

    // 3. 窗口控制按钮已接线
    for (const label of ['最小化窗口', '最大化窗口', '关闭窗口']) {
      const enabled = await page.getByRole('button', { name: label }).isEnabled();
      record(`标题栏按钮可用：${label}`, enabled, `enabled=${enabled}`);
    }

    // 4. 最大化 / 还原：按钮图标随主进程推送切换
    await page.getByRole('button', { name: '最大化窗口' }).click();
    await page.waitForTimeout(400);
    const maximized = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isMaximized(),
    );
    const restoreButtonVisible = await page
      .getByRole('button', { name: '还原窗口' })
      .isEnabled()
      .catch(() => false);
    record(
      '最大化生效且按钮切换为「还原」',
      maximized === true && restoreButtonVisible === true,
      `isMaximized=${maximized}, restoreButton=${restoreButtonVisible}`,
    );

    await page.getByRole('button', { name: '还原窗口' }).click();
    await page.waitForTimeout(400);
    const unmaximized = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isMaximized(),
    );
    const maximizeButtonBack = await page
      .getByRole('button', { name: '最大化窗口' })
      .isEnabled()
      .catch(() => false);
    record(
      '还原生效且按钮切回「最大化」',
      unmaximized === false && maximizeButtonBack === true,
      `isMaximized=${unmaximized}, maximizeButton=${maximizeButtonBack}`,
    );

    // 5. 最小化
    await page.getByRole('button', { name: '最小化窗口' }).click();
    await page.waitForTimeout(400);
    const minimized = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isMinimized(),
    );
    record('最小化生效', minimized === true, `isMinimized=${minimized}`);
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.restore();
      window.show();
    });
    await page.waitForTimeout(300);

    // 6. 导入名单（替身文件对话框）
    await app.evaluate(({ dialog }, selectedPath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selectedPath] });
    }, fixturePath);
    await page.getByRole('button', { name: '导入名单' }).click();
    await page.getByText('共 4 名学生').waitFor();
    record('导入名单', true, '共 4 名学生');

    // 7. 设置抽屉：权重与历史默认折叠、停留时长默认 3000ms
    await page.getByRole('button', { name: '打开设置' }).click();
    const settings = page.getByRole('dialog', { name: '设置' });
    await settings.waitFor();
    const weightExpanded = await settings
      .getByRole('button', { name: '学生权重' })
      .getAttribute('aria-expanded');
    const historyExpanded = await settings
      .getByRole('button', { name: '最近抽取' })
      .getAttribute('aria-expanded');
    record(
      '权重与历史默认折叠',
      weightExpanded === 'false' && historyExpanded === 'false',
      `weight=${weightExpanded}, history=${historyExpanded}`,
    );
    const collapsedWeightInputs = await settings
      .getByRole('spinbutton', { name: '甲同学权重' })
      .count();
    record('折叠时权重输入框不渲染', collapsedWeightInputs === 0, `count=${collapsedWeightInputs}`);

    // 抽屉不能钻到自绘标题栏底下，标题也不能被整宽按钮挤成竖排
    const drawerGeometry = await page.evaluate(() => {
      const titlebar = document.querySelector('.app-titlebar');
      const panel = document.querySelector('.settings-drawer__panel');
      const title = document.querySelector('#settings-drawer-title');
      return {
        titlebarBottom: Math.round(titlebar.getBoundingClientRect().bottom),
        panelTop: Math.round(panel.getBoundingClientRect().top),
        titleWidth: Math.round(title.getBoundingClientRect().width),
      };
    });
    record(
      '设置抽屉让开标题栏且标题未被挤压',
      drawerGeometry.panelTop === drawerGeometry.titlebarBottom && drawerGeometry.titleWidth >= 60,
      JSON.stringify(drawerGeometry),
    );

    const durationInput = settings.getByRole('spinbutton', { name: '结果全屏停留时长（毫秒）' });
    record(
      '结果全屏停留时长默认 3000 毫秒',
      (await durationInput.inputValue()) === '3000',
      `value=${await durationInput.inputValue()}`,
    );

    // 8. 展开权重后可编辑并保存
    await settings.getByRole('button', { name: '学生权重' }).click();
    const weightInput = settings.getByRole('spinbutton', { name: '甲同学权重' });
    await weightInput.fill('2');
    await page.getByRole('status', { name: '名单保存状态' }).filter({ hasText: '已保存' }).waitFor();
    record('展开权重后可编辑并保存', (await weightInput.inputValue()) === '2', '甲同学权重=2');
    await page.getByRole('button', { name: '关闭设置' }).click();

    // 9. 抽取（关闭动画）：全屏结果按 3 秒自动关闭
    await page.getByRole('checkbox', { name: '显示抽取动画' }).uncheck();
    await page.getByRole('status', { name: '名单保存状态' }).filter({ hasText: '已保存' }).waitFor();
    await page.getByRole('button', { name: '开始抽取' }).click();
    const overlay = page.getByRole('dialog', { name: '抽取结果全屏展示' });
    await overlay.waitFor();
    const tipCount = await overlay.getByText('点击任意处或等待 3 秒自动关闭').count();
    record('全屏结果提示 3 秒', tipCount === 1, `tipMatchCount=${tipCount}`);

    const openedAt = Date.now();
    await overlay.waitFor({ state: 'detached', timeout: 8000 });
    const visibleMs = Date.now() - openedAt;
    record(
      '全屏结果约 3 秒后自动关闭',
      visibleMs >= 2500 && visibleMs <= 4500,
      `visibleMs=${visibleMs}`,
    );

    // 10. 抽取动画：关闭动画后结果立即定格，重置本轮恢复
    await page.getByRole('button', { name: '重置本轮' }).click();
    await page.getByText('等待抽取', { exact: true }).first().waitFor();
    record(
      '重置本轮后恢复等待抽取',
      (await page.getByText('等待抽取', { exact: true }).count()) === 4,
      '等待抽取 x4',
    );

    // 11. 关闭按钮真正退出应用（放在最后，之后无法再操作页面）
    // 注意：Playwright 给主进程挂了 Node 调试器，进程会停在
    // "Waiting for the debugger to disconnect..."，因此用「页面/主进程上下文消失」判定退出。
    await page.getByRole('button', { name: '关闭窗口' }).click();
    let quitDetected = false;
    for (let attempt = 0; attempt < 24 && !quitDetected; attempt += 1) {
      // 用真实定时器等待：页面关闭后 Playwright 的 waitForTimeout 会直接抛错
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
      if (page.isClosed()) {
        quitDetected = true;
        break;
      }
      try {
        await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
      } catch {
        quitDetected = true;
      }
    }
    appClosed = quitDetected;
    record('关闭按钮退出应用', quitDetected, `quitDetected=${quitDetected}`);
  } finally {
    if (app && !appClosed) {
      await app.close().catch(() => undefined);
    }
    await rm(userDataDir, { recursive: true, force: true });
  }
  const failed = checks.filter((check) => !check.passed);
  console.log(
    `SUMMARY | total=${checks.length} passed=${checks.length - failed.length} failed=${failed.length}`,
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.log(`FATAL | ${error && error.message ? error.message : error}`);
  process.exit(1);
});
