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
const authorizedEvent = { senderFrame: { url: 'file:///app/dist/renderer/index.html' } };

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

  it('handler 在调用导入器前拒绝非法扩展名', async () => {
    const showOpenDialog = vi.fn().mockResolvedValue(
      createDialogResult(['C:\\private\\roster.pdf']),
    );
    const importer = vi.fn().mockResolvedValue(importedRoster);
    const handlers = createIpcHandlers({
      showOpenDialog,
      importRoster: importer,
      store: createStore(),
    });

    await expect(handlers.importRoster()).rejects.toEqual({
      code: 'UNSUPPORTED_FORMAT',
      message: '不支持的名单文件格式。',
    });
    expect(importer).not.toHaveBeenCalled();
  });

  it('handler 对大写允许扩展名执行导入', async () => {
    const uppercaseFilePath = 'C:\\private\\ROSTER.CSV';
    const showOpenDialog = vi.fn().mockResolvedValue(createDialogResult([uppercaseFilePath]));
    const importer = vi.fn().mockResolvedValue(importedRoster);
    const handlers = createIpcHandlers({
      showOpenDialog,
      importRoster: importer,
      store: createStore(),
    });

    await expect(handlers.importRoster()).resolves.toEqual(importedRoster);
    expect(importer).toHaveBeenCalledWith(uppercaseFilePath);
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

  it('文件对话框异常映射为固定错误且不泄露原始异常', async () => {
    const showOpenDialog = vi.fn().mockRejectedValue(new Error(`dialog path: ${selectedFilePath}`));
    const importer = vi.fn();
    const handlers = createIpcHandlers({
      showOpenDialog,
      importRoster: importer,
      store: createStore(),
    });

    await expect(handlers.importRoster()).rejects.toEqual({
      code: 'FILE_DIALOG_FAILED',
      message: '文件选择失败。',
    });
    expect(importer).not.toHaveBeenCalled();
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

  it('接受深色主题和 0 到 5000 毫秒的合法设置', async () => {
    const store = createStore();
    store.save.mockResolvedValue(undefined);
    const handlers = createIpcHandlers({
      showOpenDialog: vi.fn(),
      importRoster: vi.fn(),
      store,
    });
    const darkState: RosterState = {
      ...savedState,
      settings: { ...savedState.settings, animationDurationMs: 5000, theme: 'dark' },
    };

    await expect(handlers.saveState(darkState)).resolves.toBeUndefined();
    expect(store.save).toHaveBeenCalledWith(darkState);
  });

  it.each([
    ['null', null],
    ['缺少 sourceName', { students: [], history: [], settings: savedState.settings }],
    ['students 为 null', {
      sourceName: 'roster.csv',
      students: null,
      history: [],
      settings: savedState.settings,
    }],
    ['student weight 为负数', {
      sourceName: 'roster.csv',
      students: [{ id: 'student-1', name: '甲同学', weight: -1, drawnThisRound: false }],
      history: [],
      settings: savedState.settings,
    }],
    ['student weight 非有限', {
      sourceName: 'roster.csv',
      students: [{ id: 'student-1', name: '甲同学', weight: Number.POSITIVE_INFINITY, drawnThisRound: false }],
      history: [],
      settings: savedState.settings,
    }],
    ['student drawnThisRound 类型错误', {
      sourceName: 'roster.csv',
      students: [{ id: 'student-1', name: '甲同学', weight: 1, drawnThisRound: 'false' }],
      history: [],
      settings: savedState.settings,
    }],
    ['history 嵌套字段类型错误', {
      sourceName: 'roster.csv',
      students: [],
      history: [{ id: 'draw-1', drawnAt: '2025-01-01', studentNames: [1] }],
      settings: savedState.settings,
    }],
    ['settings 类型错误', {
      sourceName: 'roster.csv',
      students: [],
      history: [],
      settings: null,
    }],
    ['animationDurationMs 为负数', {
      sourceName: 'roster.csv',
      students: [],
      history: [],
      settings: { ...savedState.settings, animationDurationMs: -1 },
    }],
    ['animationDurationMs 超出上限', {
      sourceName: 'roster.csv',
      students: [],
      history: [],
      settings: { ...savedState.settings, animationDurationMs: 5001 },
    }],
    ['theme 类型错误', {
      sourceName: 'roster.csv',
      students: [],
      history: [],
      settings: { ...savedState.settings, theme: 'neon' },
    }],
  ] as const)('saveState 拒绝非法状态（%s）并不写入存储', async (_description, state) => {
    const store = createStore();
    const handlers = createIpcHandlers({
      showOpenDialog: vi.fn(),
      importRoster: vi.fn(),
      store,
    });

    await expect(handlers.saveState(state as unknown as RosterState)).rejects.toEqual({
      code: 'INVALID_STATE',
      message: '名单状态数据无效。',
    });
    expect(store.save).not.toHaveBeenCalled();
  });

  it('saveState 将合法状态投影为安全的最小结构', async () => {
    const store = createStore();
    store.save.mockResolvedValue(undefined);
    const handlers = createIpcHandlers({
      showOpenDialog: vi.fn(),
      importRoster: vi.fn(),
      store,
    });
    const stateWithSecrets = {
      sourceName: 'C:\\private\\roster.csv',
      students: [{
        id: 'student-1',
        name: '甲同学',
        weight: 1,
        drawnThisRound: false,
        filePath: 'C:\\private\\secret.txt',
      }],
      history: [{
        id: 'draw-1',
        drawnAt: '2025-01-01T00:00:00.000Z',
        studentNames: ['甲同学'],
        path: 'C:\\private\\history',
      }],
      settings: {
        animationEnabled: true,
        animationDurationMs: 500,
        theme: 'light',
        secret: 'remove-me',
      },
      secret: 'remove-me',
    } as unknown as RosterState;

    await handlers.saveState(stateWithSecrets);

    expect(store.save).toHaveBeenCalledWith({
      sourceName: 'roster.csv',
      students: [{ id: 'student-1', name: '甲同学', weight: 1, drawnThisRound: false }],
      history: [{
        id: 'draw-1',
        drawnAt: '2025-01-01T00:00:00.000Z',
        studentNames: ['甲同学'],
      }],
      settings: { animationEnabled: true, animationDurationMs: 500, theme: 'light' },
    });
  });

  it('loadState 校验并投影存储结果，移除路径和多余字段', async () => {
    const store = createStore();
    store.load.mockResolvedValue({
      sourceName: 'C:\\private\\roster.csv',
      students: [{
        id: 'student-1',
        name: '甲同学',
        weight: 1,
        drawnThisRound: false,
        filePath: 'C:\\private\\secret.txt',
      }],
      history: [],
      settings: { animationEnabled: true, animationDurationMs: 500, theme: 'light', secret: 'remove-me' },
      secret: 'remove-me',
    } as unknown as RosterState);
    const handlers = createIpcHandlers({
      showOpenDialog: vi.fn(),
      importRoster: vi.fn(),
      store,
    });

    await expect(handlers.loadState()).resolves.toEqual({
      sourceName: 'roster.csv',
      students: [{ id: 'student-1', name: '甲同学', weight: 1, drawnThisRound: false }],
      history: [],
      settings: { animationEnabled: true, animationDurationMs: 500, theme: 'light' },
    });
  });

  it('loadState 拒绝运行时非法的存储结果', async () => {
    const store = createStore();
    store.load.mockResolvedValue({
      sourceName: 'roster.csv',
      students: [{ id: 'student-1', name: '甲同学', weight: -1, drawnThisRound: false }],
      history: [],
      settings: savedState.settings,
    } as unknown as RosterState);
    const handlers = createIpcHandlers({
      showOpenDialog: vi.fn(),
      importRoster: vi.fn(),
      store,
    });

    await expect(handlers.loadState()).rejects.toEqual({
      code: 'INVALID_STATE',
      message: '名单状态数据无效。',
    });
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
    await saveListener?.(authorizedEvent, savedState);
    expect(store.save).toHaveBeenCalledWith(savedState);
  });

  it('注册 listener 将成功业务结果包装为成功 envelope', async () => {
    const handlers = createIpcHandlers({
      showOpenDialog: vi.fn().mockResolvedValue(createDialogResult([selectedFilePath])),
      importRoster: vi.fn().mockResolvedValue(importedRoster),
      store: createStore(),
    });
    const registered = new Map<string, (...args: unknown[]) => unknown>();
    const ipcMain: IpcMainLike = {
      handle: vi.fn((channel, listener) => {
        registered.set(channel, listener);
      }),
    };
    registerIpcHandlers(ipcMain, handlers);

    const result = await registered.get(IPC_CHANNELS.importRoster)?.(authorizedEvent);

    expect(result).toEqual({ ok: true, data: importedRoster });
  });

  it('注册 listener 捕获业务异常并返回失败 envelope', async () => {
    const handlers = createIpcHandlers({
      showOpenDialog: vi.fn().mockResolvedValue(createDialogResult([selectedFilePath])),
      importRoster: vi.fn().mockRejectedValue(new Error(`secret path: ${selectedFilePath}`)),
      store: createStore(),
    });
    const registered = new Map<string, (...args: unknown[]) => unknown>();
    const ipcMain: IpcMainLike = {
      handle: vi.fn((channel, listener) => {
        registered.set(channel, listener);
      }),
    };
    registerIpcHandlers(ipcMain, handlers);

    const result = await registered.get(IPC_CHANNELS.importRoster)?.(authorizedEvent);

    expect(result).toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: '操作失败。' },
    });
  });

  it('注册 listener 在真实调用边界返回非法 state envelope', async () => {
    const store = createStore();
    const handlers = createIpcHandlers({
      showOpenDialog: vi.fn(),
      importRoster: vi.fn(),
      store,
    });
    const registered = new Map<string, (...args: unknown[]) => unknown>();
    const ipcMain: IpcMainLike = {
      handle: vi.fn((channel, listener) => {
        registered.set(channel, listener);
      }),
    };
    registerIpcHandlers(ipcMain, handlers);

    const result = await registered.get(IPC_CHANNELS.saveState)?.(authorizedEvent, null);

    expect(result).toEqual({
      ok: false,
      error: { code: 'INVALID_STATE', message: '名单状态数据无效。' },
    });
    expect(store.save).not.toHaveBeenCalled();
  });

  it.each([
    'data:text/html,<h1>外部</h1>',
    'http://example.com/index.html',
    'https://localhost:5173/index.html',
    'file://attacker.example/index.html',
  ])('注册 listener 拒绝非受信 sender：%s', async (url) => {
    const importer = vi.fn().mockResolvedValue(importedRoster);
    const handlers = createIpcHandlers({
      showOpenDialog: vi.fn().mockResolvedValue(createDialogResult([selectedFilePath])),
      importRoster: importer,
      store: createStore(),
    });
    const registered = new Map<string, (...args: unknown[]) => unknown>();
    const ipcMain: IpcMainLike = {
      handle: vi.fn((channel, listener) => {
        registered.set(channel, listener);
      }),
    };
    registerIpcHandlers(ipcMain, handlers);

    const result = await registered.get(IPC_CHANNELS.importRoster)?.({ senderFrame: { url } });

    expect(result).toEqual({
      ok: false,
      error: { code: 'UNAUTHORIZED_SENDER', message: '未授权的调用来源。' },
    });
    expect(importer).not.toHaveBeenCalled();
  });

  it.each([
    'file:///app/dist/renderer/index.html',
    'http://localhost:5173/index.html',
    'http://127.0.0.1:5173/index.html',
    'http://[::1]:5173/index.html',
  ])('注册 listener 允许受信 sender：%s', async (url) => {
    const handlers = createIpcHandlers({
      showOpenDialog: vi.fn().mockResolvedValue(createDialogResult([selectedFilePath])),
      importRoster: vi.fn().mockResolvedValue(importedRoster),
      store: createStore(),
    });
    const registered = new Map<string, (...args: unknown[]) => unknown>();
    const ipcMain: IpcMainLike = {
      handle: vi.fn((channel, listener) => {
        registered.set(channel, listener);
      }),
    };
    registerIpcHandlers(ipcMain, handlers);

    const result = await registered.get(IPC_CHANNELS.importRoster)?.({ senderFrame: { url } });

    expect(result).toEqual({ ok: true, data: importedRoster });
  });
});
