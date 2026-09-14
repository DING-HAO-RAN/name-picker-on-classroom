/**
 * 一次性诊断脚本：直接启动被测 Electron 主进程并打印 stdout/stderr，
 * 用于定位 Playwright 报出的 "Process failed to launch!"。
 * 保留此文件作为排查痕迹，不属于应用运行时产物。
 */

const { spawn } = require('node:child_process');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const electronBinary = require('electron');

const userDataDir = mkdtempSync(join(tmpdir(), 'name-picker-probe-'));
const mainScript = resolve(__dirname, '..', '..', 'dist', 'main', 'index.js');

console.log('electron binary:', electronBinary);
console.log('main script:', mainScript);
console.log('user-data-dir:', userDataDir);
console.log('ELECTRON_RUN_AS_NODE =', process.env.ELECTRON_RUN_AS_NODE);

const extraArgs = (process.env.PROBE_ARGS || '--disable-gpu').split(' ').filter(Boolean);

const child = spawn(
  electronBinary,
  [...extraArgs, '--enable-logging', `--user-data-dir=${userDataDir}`, mainScript],
  {
    cwd: resolve(__dirname, '..', '..'),
    env: process.env,
  },
);

child.stdout.on('data', (chunk) => process.stdout.write(`[out] ${chunk}`));
child.stderr.on('data', (chunk) => process.stdout.write(`[err] ${chunk}`));
child.on('error', (error) => console.log('[spawn error]', error.message));
child.on('exit', (code, signal) => {
  console.log('exit code:', code, 'signal:', signal);
  process.exit(0);
});

setTimeout(() => {
  console.log('probe timeout: 已运行 10 秒仍未退出，视为启动成功');
  child.kill();
  setTimeout(() => process.exit(0), 500);
}, 10000);
