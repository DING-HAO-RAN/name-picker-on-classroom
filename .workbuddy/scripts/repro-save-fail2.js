/**
 * 复现（修正版）：干净环境变量 + --disable-gpu（本机沙箱无 GPU）+ 真实 userData，
 * 捕获保存失败 toast 与 roster-state.json 回写情况。
 */
const { _electron: electron } = require('playwright');
const { copyFile, stat } = require('node:fs/promises');
const { join, resolve } = require('node:path');
const os = require('node:os');

const projectRoot = resolve(__dirname, '..', '..');
const executablePath = join(projectRoot, 'release12', 'win-unpacked', 'NamePicker.exe');
const statePath = join(os.homedir(), 'AppData', 'Roaming', 'name-picker', 'roster-state.json');
const backupPath = join(projectRoot, '.workbuddy', 'roster-state.backup.json');
const reportPath = join(projectRoot, '.workbuddy', 'repro2.txt');

const lines = [];
function log(line) {
  lines.push(line);
  require('node:fs').writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(line);
}

async function main() {
  await copyFile(statePath, backupPath).then(
    () => log('BACKUP OK'),
    (error) => log(`BACKUP FAIL | ${error.message}`),
  );
  const before = await stat(statePath).then((s) => s.mtimeMs).catch(() => -1);
  log(`STATE MTIME BEFORE | ${before}`);

  // 宿主会话带 ELECTRON_RUN_AS_NODE=1，必须从子进程环境中剔除，否则 Electron 会以纯 Node 模式启动
  const cleanEnv = { ...process.env };
  delete cleanEnv.ELECTRON_RUN_AS_NODE;

  const app = await electron.launch({
    executablePath,
    env: cleanEnv,
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--disable-gpu-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  const consoleLines = [];
  const page = await app.firstWindow();
  page.on('console', (message) => consoleLines.push(`[${message.type()}] ${message.text()}`));
  page.on('pageerror', (error) => consoleLines.push(`PAGEERROR ${error.message}`));

  try {
    await page.getByRole('heading').first().waitFor({ timeout: 15000 });
    log('WINDOW READY');
  } catch (error) {
    log(`WINDOW NOT READY | ${error.message}`);
  }

  await page.waitForTimeout(6000);

  const toastCount = await page.locator('text=名单状态保存失败').count().catch(() => -1);
  log(`SAVE-FAILED TOAST COUNT | ${toastCount}`);

  const saveStatus = await page
    .locator('.control-status')
    .textContent()
    .catch((error) => `ERR ${error.message}`);
  log(`SAVE STATUS TEXT | ${saveStatus}`);

  const after = await stat(statePath).then((s) => s.mtimeMs).catch(() => -1);
  log(`STATE MTIME AFTER | ${after} (changed=${after !== before})`);

  // 学生数据是否带上了 star/drawCount（新版 normalize 回写成功标志）
  const starCount = await page.evaluate(() => {
    const api = window.namePicker;
    return api ? 'api-exists' : 'no-api';
  });
  log(`PRELOAD API | ${starCount}`);

  log(`CONSOLE (${consoleLines.length})`);
  for (const line of consoleLines.slice(0, 40)) {
    log(`  ${String(line).slice(0, 240)}`);
  }

  try {
    await app.close();
  } catch {
    // 预期
  }
  setTimeout(() => process.exit(0), 1500).unref();
}

main().catch((error) => {
  log(`FATAL | ${error && error.message ? error.message : error}`);
  process.exit(1);
});
