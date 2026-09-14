/**
 * 一次性截图脚本：导出标题栏与设置面板的浅色/深色效果，用于人工确认视觉风格。
 * 保留此文件作为修改痕迹，不属于应用运行时产物。
 */

const { _electron: electron } = require('playwright');
const { mkdir, mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const projectRoot = resolve(__dirname, '..', '..');
const outputDir = join(projectRoot, '.workbuddy', 'screenshots');

async function main() {
  await mkdir(outputDir, { recursive: true });
  const userDataDir = await mkdtemp(join(tmpdir(), 'name-picker-shot-'));

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
    await page.setViewportSize({ width: 1280, height: 820 });

    await page.screenshot({ path: join(outputDir, '01-light-empty.png') });

    // 导入名单后截图（含标题栏 + 主界面）
    await app.evaluate(({ dialog }, selectedPath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selectedPath] });
    }, join(projectRoot, 'tests', 'fixtures', 'class-list.txt'));
    await page.getByRole('button', { name: '导入名单' }).click();
    await page.getByText('共 4 名学生').waitFor();
    await page.screenshot({ path: join(outputDir, '02-light-roster.png') });

    // 设置抽屉：默认折叠
    await page.getByRole('button', { name: '打开设置' }).click();
    await page.getByRole('dialog', { name: '设置' }).waitFor();
    await page.screenshot({ path: join(outputDir, '03-settings-collapsed.png') });

    // 展开权重与历史
    await page.getByRole('dialog', { name: '设置' }).getByRole('button', { name: '学生权重' }).click();
    await page.getByRole('dialog', { name: '设置' }).getByRole('button', { name: '最近抽取' }).click();
    await page.screenshot({ path: join(outputDir, '04-settings-expanded.png') });

    // 深色主题
    await page.getByRole('combobox', { name: '界面主题' }).selectOption('dark');
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(outputDir, '05-dark-settings.png') });

    await page.getByRole('button', { name: '关闭设置' }).click();
    await page.screenshot({ path: join(outputDir, '06-dark-main.png') });

    console.log('截图已输出到', outputDir);
  } finally {
    await app.close().catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.log(`FATAL | ${error && error.message ? error.message : error}`);
  process.exit(1);
});
