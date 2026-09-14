/**
 * 复现「双击图标报名单状态保存失败」：用真实 userData 启动 release12 解包版，
 * 捕获渲染器 console 与页面上的错误 toast，并核对 roster-state.json 是否被成功回写。
 * 运行前会先把 roster-state.json 备份到 .workbuddy/roster-state.backup.json。
 */

const { _electron: electron } = require('playwright');
const { copyFile, stat } = require('node:fs/promises');
const { join, resolve } = require('node:path');
const os = require('node:os');

const projectRoot = resolve(__dirname, '..', '..');
const executablePath = join(projectRoot, 'release12', 'win-unpacked', 'NamePicker.exe');
const statePath = join(os.homedir(), 'AppData', 'Roaming', 'name-picker', 'roster-state.json');
const backupPath = join(projectRoot, '.workbuddy', 'roster-state.backup.json');
const reportPath = join(projectRoot, '.workbuddy', 'repro-save-fail.txt');

const lines = [];
function log(line) {
  lines.push(line);
  require('node:fs').writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(line);
}

async function main() {
  // 备份用户状态，验证后可恢复
  await copyFile(statePath, backupPath).catch((error) => log(`BACKUP FAIL | ${error.message}`));
  const before = await stat(statePath).then((s) => s.mtimeMs).catch(() => -1);
  log(`STATE MTIME BEFORE | ${before}`);

  const app = await electron.launch({
    executablePath,
    args: [
      // 仅为本机沙箱环境放宽 Chromium 进程限制，项目自身的窗口配置未做任何放宽
      '--no-sandbox',
      '--disable-gpu',
      '--disable-gpu-sandbox',
      '--disable-software-rasterizer',
      '--disable-dev-shm-usage',
    ],
  });

  const consoleLines = [];
  app.process().stdout?.on('data', (chunk) => consoleLines.push(`STDOUT ${chunk}`));
  app.process().stderr?.on('data', (chunk) => consoleLines.push(`STDERR ${chunk}`));

  const page = await app.firstWindow();
  page.on('console', (message) => consoleLines.push(`CONSOLE[${message.type()}] ${message.text()}`));
  page.on('pageerror', (error) => consoleLines.push(`PAGEERROR ${error.message}`));

  // 等主界面渲染
  try {
    await page.getByRole('heading').first().waitFor({ timeout: 15000 });
    log('WINDOW READY');
  } catch (error) {
    log(`WINDOW NOT READY | ${error.message}`);
  }

  // 等待可能的保存动作与 toast
  await page.waitForTimeout(6000);

  const toast = await page
    .locator('text=名单状态保存失败')
    .count()
    .catch(() => -1);
  log(`SAVE-FAILED TOAST COUNT | ${toast}`);

  const saveStatus = await page
    .locator('.control-status')
    .textContent()
    .catch((error) => `ERR ${error.message}`);
  log(`SAVE STATUS TEXT | ${saveStatus}`);

  const after = await stat(statePath).then((s) => s.mtimeMs).catch(() => -1);
  log(`STATE MTIME AFTER | ${after} (changed=${after !== before})`);

  log(`CONSOLE LINES (${consoleLines.length})`);
  for (const line of consoleLines.slice(0, 60)) {
    log(`  ${String(line).slice(0, 300)}`);
  }

  // 汇总先落盘再关闭：关闭打包产物会连带结束本进程
  try {
    await app.close();
  } catch {
    // 预期：产物退出会连带宿主进程
  }
  setTimeout(() => process.exit(0), 1500).unref();
}

main().catch((error) => {
  log(`FATAL | ${error && error.message ? error.message : error}`);
  process.exit(1);
});
