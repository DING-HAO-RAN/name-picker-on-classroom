import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS, type NamePickerApi } from '../shared/ipcTypes';

const electronMocks = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: electronMocks.exposeInMainWorld },
  ipcRenderer: {
    invoke: electronMocks.invoke,
    on: electronMocks.on,
    removeListener: electronMocks.removeListener,
  },
}));

describe('preload namePicker bridge', () => {
  beforeEach(() => {
    vi.resetModules();
    electronMocks.exposeInMainWorld.mockReset();
    electronMocks.invoke.mockReset();
    electronMocks.on.mockReset();
    electronMocks.removeListener.mockReset();
  });

  it('只暴露固定业务方法，并将调用转发到固定 channel', async () => {
    const importedRoster = {
      sourceName: 'roster.txt',
      students: [],
    };
    const savedState = {
      sourceName: 'roster.txt',
      students: [],
      history: [],
      settings: { animationEnabled: true, animationDurationMs: 300, theme: 'light' as const },
    };
    electronMocks.invoke.mockResolvedValue({ ok: true, data: undefined });

    await import('./index');

    expect(electronMocks.exposeInMainWorld).toHaveBeenCalledTimes(1);
    const [namespace, exposedApi] = electronMocks.exposeInMainWorld.mock.calls[0] as [
      string,
      NamePickerApi,
    ];
    expect(namespace).toBe('namePicker');
    expect(Object.keys(exposedApi)).toEqual([
      'importRoster',
      'loadState',
      'saveState',
      'clearState',
      'windowControls',
    ]);
    expect(Object.keys(exposedApi.windowControls ?? {})).toEqual([
      'minimize',
      'toggleMaximize',
      'close',
      'isMaximized',
      'onMaximizedChange',
    ]);
    expect(exposedApi).not.toHaveProperty('ipcRenderer');
    expect(exposedApi).not.toHaveProperty('fs');
    expect(exposedApi).not.toHaveProperty('require');

    electronMocks.invoke.mockResolvedValueOnce({ ok: true, data: importedRoster });
    await expect(exposedApi.importRoster()).resolves.toEqual(importedRoster);
    electronMocks.invoke.mockResolvedValueOnce({ ok: true, data: savedState });
    await expect(exposedApi.loadState()).resolves.toEqual(savedState);
    await exposedApi.saveState(savedState);
    await exposedApi.clearState();

    expect(electronMocks.invoke.mock.calls).toEqual([
      [IPC_CHANNELS.importRoster],
      [IPC_CHANNELS.loadState],
      [IPC_CHANNELS.saveState, savedState],
      [IPC_CHANNELS.clearState],
    ]);
  });

  it('窗口控制转发到固定 channel，并支持订阅最大化状态', async () => {
    electronMocks.invoke.mockResolvedValue({ ok: true, data: true });

    await import('./index');

    const [, exposedApi] = electronMocks.exposeInMainWorld.mock.calls[0] as [
      string,
      NamePickerApi,
    ];
    const windowControls = exposedApi.windowControls;
    expect(windowControls).toBeDefined();
    if (!windowControls) {
      throw new Error('windowControls 未暴露');
    }

    await windowControls.minimize();
    await windowControls.toggleMaximize();
    await windowControls.close();
    await expect(windowControls.isMaximized()).resolves.toBe(true);

    expect(electronMocks.invoke.mock.calls).toEqual([
      [IPC_CHANNELS.windowControl, 'minimize'],
      [IPC_CHANNELS.windowControl, 'toggle-maximize'],
      [IPC_CHANNELS.windowControl, 'close'],
      [IPC_CHANNELS.windowControl, 'get-maximized'],
    ]);

    const listener = vi.fn();
    const unsubscribe = windowControls.onMaximizedChange(listener);
    expect(electronMocks.on).toHaveBeenCalledWith(
      IPC_CHANNELS.windowMaximizedChanged,
      expect.any(Function),
    );

    const handler = electronMocks.on.mock.calls[0][1] as (event: unknown, value: unknown) => void;
    handler({}, true);
    handler({}, 'unexpected');
    expect(listener.mock.calls).toEqual([[true], [false]]);

    unsubscribe();
    expect(electronMocks.removeListener).toHaveBeenCalledWith(
      IPC_CHANNELS.windowMaximizedChanged,
      handler,
    );
  });

  it('收到失败 envelope 时构造带 code 的 renderer Error', async () => {
    electronMocks.invoke.mockResolvedValue({
      ok: false,
      error: { code: 'PARSE_FAILED', message: '名单文件解析失败。' },
    });

    await import('./index');

    const [, exposedApi] = electronMocks.exposeInMainWorld.mock.calls[0] as [
      string,
      NamePickerApi,
    ];
    const rejection = exposedApi.importRoster();

    await expect(rejection).rejects.toMatchObject({
      code: 'PARSE_FAILED',
      message: '名单文件解析失败。',
    });
    await expect(rejection).rejects.toBeInstanceOf(Error);
  });
});
