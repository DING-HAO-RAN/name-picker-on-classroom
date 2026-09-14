/**
 * 用项目 electron 二进制运行 lock-diag.js，捕获输出。
 */
const { spawn } = require('child_process');
const { join, resolve } = require('node:path');
const { writeFileSync } = require('node:fs');

const projectRoot = resolve(__dirname, '..', '..');
const electronBin = join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const script = join(projectRoot, '.workbuddy', 'scripts', 'lock-diag.js');
const reportPath = join(projectRoot, '.workbuddy', 'lock-diag-run.txt');

const lines = [];
function log(line) {
  lines.push(line);
  writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(line);
}

const child = spawn(electronBin, [script], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' },
});
child.stdout.on('data', (chunk) => log(`OUT ${chunk.toString().trim()}`));
child.stderr.on('data', (chunk) => log(`ERR ${chunk.toString().trim()}`));
child.on('exit', (code) => {
  log(`EXIT code=${code}`);
  setTimeout(() => process.exit(0), 500);
});
setTimeout(() => process.exit(0), 15000);
