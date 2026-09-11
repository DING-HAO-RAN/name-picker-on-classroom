import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RosterState } from '../../shared/types';
import { LocalStore, LocalStoreError } from './localStore';

let fixtureDirectory: string;

const savedState: RosterState = {
  sourceName: 'roster.csv',
  students: [
    { id: 'student-1', name: '甲同学', weight: 2, drawnThisRound: true },
    { id: 'student-2', name: '乙同学', weight: 1, drawnThisRound: false },
  ],
  history: [
    { id: 'draw-1', drawnAt: '2025-01-01T00:00:00.000Z', studentNames: ['甲同学'] },
  ],
  settings: {
    animationEnabled: false,
    animationDurationMs: 0,
    theme: 'light',
  },
};

describe('本地名单存储', () => {
  beforeEach(async () => {
    fixtureDirectory = await mkdtemp(join(tmpdir(), 'name-picker-store-'));
  });

  afterEach(async () => {
    await rm(fixtureDirectory, { force: true, recursive: true });
  });

  it('保存后可以恢复名单、权重、历史和设置', async () => {
    const store = new LocalStore(fixtureDirectory);

    await store.save(savedState);

    await expect(store.load()).resolves.toEqual(savedState);
  });

  it('没有存储文件时返回空值', async () => {
    const store = new LocalStore(fixtureDirectory);

    await expect(store.load()).resolves.toBeNull();
  });

  it('clear 会清除已保存的状态', async () => {
    const store = new LocalStore(fixtureDirectory);
    await store.save(savedState);

    await store.clear();

    await expect(store.load()).resolves.toBeNull();
  });

  it('存储失败时抛出可映射且不泄露本机路径的错误', async () => {
    const occupiedPath = join(fixtureDirectory, 'occupied');
    await writeFile(occupiedPath, '不是目录');
    const store = new LocalStore(occupiedPath);

    await expect(store.save(savedState)).rejects.toMatchObject({ code: 'STORAGE_WRITE_FAILED' });

    try {
      await store.save(savedState);
    } catch (error) {
      expect(error).toBeInstanceOf(LocalStoreError);
      expect((error as Error).message).not.toContain(occupiedPath);
    }
  });
});
