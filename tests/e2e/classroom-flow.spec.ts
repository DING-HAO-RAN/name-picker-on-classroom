import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

let electronApp: ElectronApplication | undefined;
let page: Page;
let userDataDir: string | undefined;

const fixturePath = resolve(__dirname, '..', 'fixtures', 'class-list.txt');
const emptyRosterMessage = '名单为空，请导入名单后开始抽取。';

async function stubRosterFileDialog(): Promise<void> {
  if (!electronApp) {
    throw new Error('Electron 应用尚未启动。');
  }

  await electronApp.evaluate(({ dialog }, selectedPath) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [selectedPath],
    });
  }, fixturePath);
}

test.beforeAll(async () => {
  userDataDir = await mkdtemp(join(tmpdir(), 'name-picker-e2e-'));
  electronApp = await electron.launch({
    args: [
      `--user-data-dir=${userDataDir}`,
      resolve(__dirname, '..', '..', 'dist', 'main', 'index.js'),
    ],
  });
  page = await electronApp.firstWindow();
  await expect(page).toHaveTitle('名字抽取器');
  const actualUserDataDir = await electronApp.evaluate(({ app }) => app.getPath('userData'));
  expect(actualUserDataDir).toBe(userDataDir);
});

test.afterAll(async () => {
  try {
    await electronApp?.close();
  } finally {
    if (userDataDir) {
      await rm(userDataDir, { recursive: true, force: true });
      userDataDir = undefined;
    }
  }
});

test('完成启动、导入、抽取、重置和权重设置流程', async () => {
  await expect(page.getByRole('heading', { name: '名字抽取器' })).toBeVisible();
  await expect(page.getByText(emptyRosterMessage)).toBeVisible();
  await expect(page.getByRole('button', { name: '开始抽取' })).toBeDisabled();

  await stubRosterFileDialog();
  await page.getByRole('button', { name: '导入名单' }).click();
  await expect(page.getByText('共 4 名学生')).toBeVisible();
  for (const name of ['甲同学', '乙同学', '丙同学', '丁同学']) {
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: '开始抽取' })).toBeEnabled();

  await page.getByRole('button', { name: '打开设置' }).click();
  const settings = page.getByRole('dialog', { name: '设置' });
  await expect(settings).toBeVisible();
  const firstWeight = settings.getByRole('spinbutton', { name: '甲同学权重' });
  await firstWeight.fill('2');
  await expect(firstWeight).toHaveValue('2');
  await expect(page.getByRole('status', { name: '名单保存状态' })).toHaveText('已保存');
  await page.getByRole('button', { name: '关闭设置' }).click();
  await expect(settings).toBeHidden();

  await page.getByRole('button', { name: '打开设置' }).click();
  const reopenedSettings = page.getByRole('dialog', { name: '设置' });
  await expect(reopenedSettings).toBeVisible();
  await expect(reopenedSettings.getByRole('spinbutton', { name: '甲同学权重' })).toHaveValue('2');
  await page.getByRole('button', { name: '关闭设置' }).click();
  await expect(reopenedSettings).toBeHidden();

  await page.getByRole('checkbox', { name: '显示抽取动画' }).uncheck();
  await expect(page.getByRole('status', { name: '名单保存状态' })).toHaveText('已保存');
  await page.getByRole('button', { name: '开始抽取' }).click();
  await expect(page.getByRole('heading', { name: '本次抽取结果' })).toBeVisible();
  await expect(page.getByRole('list', { name: '本次抽取的学生' }).getByRole('listitem')).toHaveCount(1);

  await page.getByRole('button', { name: '重置本轮' }).click();
  await expect(page.getByRole('heading', { name: '本次抽取结果' })).toBeHidden();
  await expect(page.getByText('等待抽取', { exact: true })).toHaveCount(4);
  await expect(page.getByRole('button', { name: '开始抽取' })).toBeEnabled();
});
