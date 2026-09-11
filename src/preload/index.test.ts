import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS, type NamePickerApi } from '../shared/ipcTypes';

const electronMocks = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: electronMocks.exposeInMainWorld },
  ipcRenderer: { invoke: electronMocks.invoke },
}));

describe('preload namePicker bridge', () => {
  beforeEach(() => {
    vi.resetModules();
    electronMocks.exposeInMainWorld.mockReset();
    electronMocks.invoke.mockReset();
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
    electronMocks.invoke.mockResolvedValue(undefined);

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
    ]);
    expect(exposedApi).not.toHaveProperty('ipcRenderer');
    expect(exposedApi).not.toHaveProperty('fs');
    expect(exposedApi).not.toHaveProperty('require');

    electronMocks.invoke.mockResolvedValueOnce(importedRoster);
    await expect(exposedApi.importRoster()).resolves.toEqual(importedRoster);
    electronMocks.invoke.mockResolvedValueOnce(savedState);
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
});
