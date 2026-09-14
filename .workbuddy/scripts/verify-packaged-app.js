/**
 * 一次性验证脚本：启动打包后的解包版可执行文件，确认自绘标题栏、窗口控制与
 * 渲染器 API 边界在真实产物里同样成立。保留作验证痕迹，不属于运行时产物。
 */

const { _electron: electron } = require('playwright');
const { mkdtemp, rm } = require('node:fs/promises');
const { writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const projectRoot = resolve(__dirname, '..', '..');
// 默认验解包版；设 PACKAGED_EXE 可指向 portable 等其他产物
const executablePath = process.env.PACKAGED_EXE
  ? resolve(projectRoot, process.env.PACKAGED_EXE)
  : join(projectRoot, 'release', 'win-unpacked', 'NamePicker.exe');
const reportPath = join(
  projectRoot,
  '.workbuddy',
  process.env.PACKAGED_EXE ? 'portable-verify.txt' : 'packaged-verify.txt',
);
const checks = [];
const outputLines = [];

// 直接落盘而不是依赖管道：PowerShell 管道在进程提前结束时会丢掉未刷出的输出
function log(line) {
  outputLines.push(line);
  console.log(line);
  writeFileSync(reportPath, `${outputLines.join('\n')}\n`, 'utf8');
}

function record(name, passed, detail) {
  checks.push({ name, passed });
  log(`${passed ? 'PASS' : 'FAIL'} | ${name} | ${detail}`);
}

async function main() {
  const userDataDir = await mkdtemp(join(tmpdir(), 'name-picker-packaged-'));
  let app;

  try {
    app = await electron.launch({
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-gpu',
        '--disable-gpu-sandbox',
        '--disable-software-rasterizer',
        '--disable-dev-shm-usage',
        `--user-data-dir=${userDataDir}`,
      ],
    });
    const page = await app.firstWindow();
    await page.getByRole('heading', { name: '名字抽取器' }).waitFor();

    const title = await page.title();
    record('打包产物窗口标题正确', title.includes('名字抽取器'), `title=${title}`);

    // 无边框窗口：窗口尺寸与内容区尺寸一致
    const frameInsets = await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      const bounds = window.getBounds();
      const content = window.getContentBounds();
      return { widthDiff: bounds.width - content.width, heightDiff: bounds.height - content.height };
    });
    record(
      '打包产物仍为无边框窗口',
      frameInsets.widthDiff === 0 && frameInsets.heightDiff === 0,
      JSON.stringify(frameInsets),
    );

    // 预加载暴露面：只有业务方法，没有 Node 对象
    const api = await page.evaluate(() => ({
      apiKeys: Object.keys(window.namePicker).sort(),
      hasRequire: 'require' in window,
      hasProcess: 'process' in window,
      hasModule: 'module' in window,
    }));
    record(
      '打包产物预加载未暴露 Node 对象',
      api.hasRequire === false && api.hasProcess === false && api.hasModule === false,
      JSON.stringify(api),
    );
    record(
      '打包产物具备窗口控制能力',
      api.apiKeys.includes('windowControls'),
      `apiKeys=${api.apiKeys.join(',')}`,
    );

    // 自绘标题栏在产物里可用
    const titlebarButtons = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.app-titlebar button')).map((button) => ({
        label: button.getAttribute('aria-label'),
        disabled: button.disabled,
      })),
    );
    record(
      '打包产物标题栏三个按钮可用',
      titlebarButtons.length === 3 && titlebarButtons.every((button) => !button.disabled),
      JSON.stringify(titlebarButtons),
    );

    // 抽屉仍然让开标题栏
    await page.getByRole('button', { name: '打开设置' }).click();
    await page.getByRole('dialog', { name: '设置' }).waitFor();
    const drawerGeometry = await page.evaluate(() => ({
      titlebarBottom: Math.round(document.querySelector('.app-titlebar').getBoundingClientRect().bottom),
      panelTop: Math.round(document.querySelector('.settings-drawer__panel').getBoundingClientRect().top),
      titleWidth: Math.round(document.querySelector('#settings-drawer-title').getBoundingClientRect().width),
    }));
    record(
      '打包产物抽屉让开标题栏且标题未被挤压',
      drawerGeometry.panelTop === drawerGeometry.titlebarBottom && drawerGeometry.titleWidth >= 60,
      JSON.stringify(drawerGeometry),
    );

    const durationValue = await page
      .getByRole('spinbutton', { name: '结果全屏停留时长（毫秒）' })
      .inputValue();
    record('打包产物停留时长默认 3000 毫秒', durationValue === '3000', `value=${durationValue}`);

  } catch (error) {
    log(`FATAL | ${error && error.message ? error.message : error}`);
  }

  // 汇总必须先落盘：关闭打包产物时会连带结束本进程，close 之后的语句可能根本不执行
  const failed = checks.filter((check) => !check.passed);
  log(`SUMMARY | total=${checks.length} passed=${checks.length - failed.length} failed=${failed.length}`);
  process.exitCode = failed.length === 0 ? 0 : 1;

  try {
    await app.close();
  } catch {
    // 打包产物退出时抛错属预期，忽略
  }
  await rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
  // 兜底：确保进程在收尾后退出
  setTimeout(() => process.exit(process.exitCode ?? 0), 2000).unref();
}

main().catch((error) => {
  log(`FATAL | ${error && error.message ? error.message : error}`);
  process.exitCode = 1;
});
