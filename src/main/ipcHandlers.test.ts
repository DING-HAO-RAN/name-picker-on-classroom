import type { RosterState } from '../shared/types';
import { describe, expect, it, vi } from 'vitest';
import { RosterImportError } from './importers/importErrors';
import {
  createIpcHandlers,
  registerIpcHandlers,
  type IpcHandlers,
  type IpcMainLike,
  type OpenDialogResult,
} from './ipcHandlers';
import { LocalStoreError } from './storage/localStore';
import { IPC_CHANNELS, type ImportResult } from '../shared/ipcTypes';

const selectedFilePath = 'C:\\private\\roster.csv';

const importedRoster: ImportResult = {
  sourceName: 'roster.csv',
  students: [
    {
      id: 'student-1',
      name: '甲同学',
      weight: 1,
      drawnThisRound: false,
    },
  ],
};

const savedState: RosterState = {
  sourceName: 'roster.csv',
  students: importedRoster.students,
  history: [],
  settings: {
    animationEnabled: true,
    animationDurationMs: 500,
    theme: 'light',
  },
};

function createDialogResult(filePaths: string[]): OpenDialogResult {
  return { canceled: false, filePaths };
}

function createStore() {
  return {
    load: vi.fn<() => Promise<RosterState | null>>(),
    save: vi.fn<(state: RosterState) => Promise<void>>(),
    clear: vi.fn<() => Promise<void>>(),
  };
}

describe('主进程 IPC 业务 handler', () => {
  it('选择并解析名单，但只向渲染进程返回业务数据', async () => {
    const showOpenDialog = vi.fn().mockResolvedValue(createDialogResult([selectedFilePath]));
    const importer = vi.fn().mockResolvedValue(importedRoster);
    const store = createStore();
    const handlers = createIpcHandlers({ showOpenDialog, importRoster: importer, store });

    await expect(handlers.importRoster()).resolves.toEqual(importedRoster);

    expect(showOpenDialog).toHaveBeenCalledWith({
      properties: ['openFile'],
      filters: [{ name: '名单文件', extensions: ['txt', 'csv', 'xlsx'] }],
    });
    expect(importer).toHaveBeenCalledWith(selectedFilePath);
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it('取消文件选择时返回可序列化的取消错误', async () => {
    const showOpenDialog = vi.fn().mockResolvedValue({ canceled: true, filePaths: [] });
    const handlers = createIpcHandlers({
      showOpenDialog,
      importRoster: vi.fn(),
      store: createStore(),
    });

    await expect(handlers.importRoster()).rejects.toEqual({
      code: 'IMPORT_CANCELLED',
      message: '已取消导入。',
    });
  });

  it('导入器错误只映射为 code/message，不泄露文件路径或堆栈', async () => {
    const showOpenDialog = vi.fn().mockResolvedValue(createDialogResult([selectedFilePath]));
    const importer = vi
      .fn()
      .mockRejectedValue(new RosterImportError('PARSE_FAILED', `解析失败：${selectedFilePath}`));
    const handlers = createIpcHandlers({ showOpenDialog, importRoster: importer, store: createStore() });

    const rejection = handlers.importRoster();

    await expect(rejection).rejects.toMatchObject({
      code: 'PARSE_FAILED',
      message: '名单文件解析失败。',
    });
    await expect(rejection).rejects.not.toHaveProperty('stack');
    await expect(rejection).rejects.not.toHaveProperty('filePath');
    await expect(rejection).rejects.not.toHaveProperty('path');
    await expect(rejection).rejects.not.toHaveProperty('message', expect.stringContaining(selectedFilePath));
  });

  it('未知导入异常映射为通用可序列化错误', async () => {
    const showOpenDialog = vi.fn().mockResolvedValue(createDialogResult([selectedFilePath]));
    const importer = vi.fn().mockRejectedValue(new Error(`internal path: ${selectedFilePath}`));
    const handlers = createIpcHandlers({ showOpenDialog, importRoster: importer, store: createStore() });

    await expect(handlers.importRoster()).rejects.toEqual({
      code: 'INTERNAL_ERROR',
      message: '操作失败。',
    });
  });

  it('转发 loadState、saveState 和 clearState 到本地存储', async () => {
    const store = createStore();
    store.load.mockResolvedValue(savedState);
    store.save.mockResolvedValue(undefined);
    store.clear.mockResolvedValue(undefined);
    const handlers = createIpcHandlers({
      showOpenDialog: vi.fn(),
      importRoster: vi.fn(),
      store,
    });

    await expect(handlers.loadState()).resolves.toEqual(savedState);
    await expect(handlers.saveState(savedState)).resolves.toBeUndefined();
    await expect(handlers.clearState()).resolves.toBeUndefined();

    expect(store.load).toHaveBeenCalledTimes(1);
    expect(store.save).toHaveBeenCalledWith(savedState);
    expect(store.clear).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['loadState', 'STORAGE_READ_FAILED', () => new LocalStoreError('STORAGE_READ_FAILED', '泄露路径')],
    ['saveState', 'STORAGE_WRITE_FAILED', () => new LocalStoreError('STORAGE_WRITE_FAILED', '泄露路径')],
    ['clearState', 'STORAGE_CLEAR_FAILED', () => new LocalStoreError('STORAGE_CLEAR_FAILED', '泄露路径')],
  ] as const)('%s 映射本地存储错误为安全 code/message', async (operation, code, createError) => {
    const store = createStore();
    if (operation === 'loadState') {
      store.load.mockRejectedValue(createError());
    } else if (operation === 'saveState') {
      store.save.mockRejectedValue(createError());
    } else {
      store.clear.mockRejectedValue(createError());
    }
    const handlers = createIpcHandlers({
      showOpenDialog: vi.fn(),
      importRoster: vi.fn(),
      store,
    });

    const promise =
      operation === 'loadState'
        ? handlers.loadState()
        : operation === 'saveState'
          ? handlers.saveState(savedState)
          : handlers.clearState();

    await expect(promise).rejects.toMatchObject({ code });
    await expect(promise).rejects.not.toHaveProperty('stack');
    await expect(promise).rejects.not.toHaveProperty('path');
    await expect(promise).rejects.not.toHaveProperty('filePath');
    await expect(promise).rejects.not.toHaveProperty('message', expect.stringContaining('泄露路径'));
  });

  it('只注册固定的最小 IPC channel，并把请求参数交给对应业务方法', async () => {
    const store = createStore();
    const handlers = createIpcHandlers({
      showOpenDialog: vi.fn(),
      importRoster: vi.fn().mockResolvedValue(importedRoster),
      store,
    });
    const registered = new Map<string, (...args: unknown[]) => unknown>();
    const ipcMain: IpcMainLike = {
      handle: vi.fn((channel, listener) => {
        registered.set(channel, listener);
      }),
    };

    registerIpcHandlers(ipcMain, handlers);

    expect([...registered.keys()]).toEqual([
      IPC_CHANNELS.importRoster,
      IPC_CHANNELS.loadState,
      IPC_CHANNELS.saveState,
      IPC_CHANNELS.clearState,
    ]);
    expect([...registered.keys()]).not.toContain('namePicker.chooseRosterFile');

    const saveListener = registered.get(IPC_CHANNELS.saveState);
    expect(saveListener).toBeDefined();
    await saveListener?.({}, savedState);
    expect(store.save).toHaveBeenCalledWith(savedState);
  });
});
