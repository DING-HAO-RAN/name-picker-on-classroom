/**
 * 启动解包版并捕获 Chromium 日志与退出码，定位「启动即退出」的原因。
 * ELECTRON_ENABLE_LOGGING=1 会打印 Chromium 内部日志（含单实例锁提示）。
 */
const { spawn } = require('child_process');
const { join, resolve } = require('node:path');
const { writeFileSync } = require('node:fs');

const projectRoot = resolve(__dirname, '..', '..');
const exe = join(projectRoot, 'release12', 'win-unpacked', 'NamePicker.exe');
const reportPath = join(projectRoot, '.workbuddy', 'launch-log.txt');

const lines = [];
function log(line) {
  lines.push(line);
  writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
}

const child = spawn(exe, [], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' },
});

log(`SPAWNED pid=${child.pid}`);

child.stdout.on('data', (chunk) => log(`STDOUT ${chunk.toString().trim()}`));
child.stderr.on('data', (chunk) => log(`STDERR ${chunk.toString().trim()}`));
child.on('exit', (code, signal) => {
  log(`EXIT code=${code} signal=${signal}`);
});

setTimeout(() => {
  log('TIMEOUT-REACHED (10s): killing child');
  try {
    child.kill();
  } catch {
    // 忽略
  }
  setTimeout(() => process.exit(0), 800);
}, 10000);
