/**
 * 一次性诊断脚本：确认点击自绘标题栏的「关闭窗口」是否真的退出应用。
 * 保留此文件作为排查痕迹，不属于应用运行时产物。
 */

const { _electron: electron } = require('playwright');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const projectRoot = resolve(__dirname, '..', '..');

async function main() {
  const userDataDir = await mkdtemp(join(tmpdir(), 'name-picker-close-'));
  const app = await electron.launch({
    args: [
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

  const child = app.process();
  console.log('pid=', child.pid, 'initial exitCode=', child.exitCode);

  let closeEventFired = false;
  app.on('close', () => {
    closeEventFired = true;
    console.log('ElectronApplication close 事件已触发');
  });

  await page.getByRole('button', { name: '关闭窗口' }).click();
  console.log('已点击关闭按钮');

  const startedAt = Date.now();
  while (Date.now() - startedAt < 6000) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
    if (child.exitCode !== null) {
      console.log(`进程已退出 exitCode=${child.exitCode} after ${Date.now() - startedAt}ms`);
      break;
    }
  }

  // 页面还活着时直接问主进程：窗口是否真的关掉了
  try {
    const snapshot = await app.evaluate(({ BrowserWindow }) => ({
      windowCount: BrowserWindow.getAllWindows().length,
      hasDestroyed: BrowserWindow.getAllWindows().length === 0,
    }));
    console.log('主进程窗口快照=', JSON.stringify(snapshot));
  } catch (error) {
    console.log('主进程查询失败（可能已退出）:', error.message);
  }

  console.log('final exitCode=', child.exitCode);
  console.log('closeEventFired=', closeEventFired);

  if (child.exitCode === null) {
    console.log('结论：关闭按钮没有让应用退出');
    await app.close().catch(() => undefined);
  } else {
    console.log('结论：关闭按钮让应用正常退出');
  }

  await rm(userDataDir, { recursive: true, force: true });
}

main().catch((error) => {
  console.log(`FATAL | ${error && error.message ? error.message : error}`);
  process.exit(1);
});
