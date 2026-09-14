/**
 * 一次性诊断脚本：量取设置抽屉头部的实际布局盒，判断标题被挤压的原因。
 * 保留此文件作为排查痕迹，不属于应用运行时产物。
 */

const { _electron: electron } = require('playwright');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const projectRoot = resolve(__dirname, '..', '..');

async function main() {
  const userDataDir = await mkdtemp(join(tmpdir(), 'name-picker-layout-'));
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

  try {
    const page = await app.firstWindow();
    await page.getByRole('heading', { name: '名字抽取器' }).waitFor();
    await page.getByRole('button', { name: '打开设置' }).click();
    await page.getByRole('dialog', { name: '设置' }).waitFor();

    const metrics = await page.evaluate(() => {
      const pick = (selector) => {
        const element = document.querySelector(selector);
        if (!element) {
          return { selector, missing: true };
        }
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          selector,
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          display: style.display,
          flexDirection: style.flexDirection,
          minWidth: style.minWidth,
          flex: `${style.flexGrow} ${style.flexShrink} ${style.flexBasis}`,
        };
      };

      return {
        viewportWidth: window.innerWidth,
        panel: pick('.settings-drawer__panel'),
        header: pick('.settings-drawer__header'),
        headerFirstChild: pick('.settings-drawer__header > div'),
        headerTitle: pick('#settings-drawer-title'),
        headerClose: pick('.settings-drawer__close'),
        content: pick('.settings-drawer__content'),
        titlebar: pick('.app-titlebar'),
        shell: pick('.app-shell'),
      };
    });

    console.log(JSON.stringify(metrics, null, 2));
  } finally {
    await app.close().catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.log(`FATAL | ${error && error.message ? error.message : error}`);
  process.exit(1);
});
