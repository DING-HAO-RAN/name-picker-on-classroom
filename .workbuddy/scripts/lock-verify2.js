/**
 * 验证单实例锁修复：连续启动两个解包版实例（--disable-gpu 兼容沙箱）。
 * 预期：实例 A 正常存活；实例 B 快速退出（exit 0）且不打扰 A；
 * 全程 A 的窗口不出现「名单状态保存失败」。
 */
const { _electron: electron } = require('playwright');
const { join, resolve } = require('node:path');
const os = require('node:os');

const projectRoot = resolve(__dirname, '..', '..');
const exe = join(projectRoot, 'release14', 'win-unpacked', 'NamePicker.exe');
const reportPath = join(projectRoot, '.workbuddy', 'lock-verify.txt');

const lines = [];
function log(line) {
  lines.push(line);
  require('node:fs').writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(line);
}

const cleanEnv = { ...process.env };
delete cleanEnv.ELECTRON_RUN_AS_NODE;
const args = [
  '--no-sandbox',
  '--disable-gpu',
  '--disable-gpu-sandbox',
  '--disable-dev-shm-usage',
];

async function main() {
  const appA = await electron.launch({ executablePath: exe, env: cleanEnv, args });
  const pageA = await appA.firstWindow();
  await pageA.getByRole('heading').first().waitFor({ timeout: 15000 });
  log('INSTANCE A READY');

  // 实例 B：拿锁失败应立即退出
  let bExitCode = null;
  const appB = await electron.launch({ executablePath: exe, env: cleanEnv, args }).then(
    (instance) => ({ kind: 'launched', instance }),
    (error) => ({ kind: 'launch-failed', message: error.message }),
  );

  if (appB.kind === 'launch-failed') {
    log(`INSTANCE B LAUNCH FAILED (expected: quit early) | ${appB.message.slice(0, 80)}`);
  } else {
    const proc = appB.instance.process();
    bExitCode = await new Promise((resolveCode) => {
      proc.once('exit', (code) => resolveCode(code));
      setTimeout(() => resolveCode('still-running'), 8000);
    });
    log(`INSTANCE B EXIT | ${bExitCode}`);
    await appB.instance.close().catch(() => undefined);
  }

  // 实例 A 仍健康：状态为「已保存」，无保存失败提示
  await pageA.waitForTimeout(2000);
  const toastA = await pageA.locator('text=名单状态保存失败').count().catch(() => -1);
  const statusA = await pageA.locator('.control-status').textContent().catch((error) => `ERR ${error.message}`);
  log(`A TOAST COUNT | ${toastA}`);
  log(`A SAVE STATUS | ${statusA}`);

  try {
    await appA.close();
  } catch {
    // 预期
  }
  setTimeout(() => process.exit(0), 1500).unref();
}

main().catch((error) => {
  log(`FATAL | ${error && error.message ? error.message : error}`);
  process.exit(1);
});
