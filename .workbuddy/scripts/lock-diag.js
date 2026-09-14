/**
 * 最小单实例锁诊断：分别在真实 userData 与临时 userData 上调用
 * requestSingleInstanceLock，打印结果后退出。
 */
const { app } = require('electron');
const { join, resolve } = require('node:path');
const { writeFileSync } = require('node:fs');

const projectRoot = resolve(__dirname, '..', '..');
const reportPath = join(projectRoot, '.workbuddy', 'lock-diag.txt');
const lines = [];
function log(line) {
  lines.push(line);
  writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(line);
}

app.whenReady().then(() => {
  log('READY REACHED');
  app.quit();
});

// 先在真实 userData 上测
const realLock = app.requestSingleInstanceLock();
log(`LOCK(real userData=${app.getPath('userData')}) = ${realLock}`);

if (!realLock) {
  // 释放重试：换临时目录再拿一次
  app.setPath('userData', join(os_tmpdir(), 'name-picker-lock-diag'));
  const tempLock = app.requestSingleInstanceLock();
  log(`LOCK(temp userData) = ${tempLock}`);
  setTimeout(() => app.exit(0), 300);
} else {
  setTimeout(() => app.exit(0), 300);
}

function os_tmpdir() {
  return require('node:os').tmpdir();
}
