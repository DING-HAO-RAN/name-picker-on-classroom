import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  type ImportResult,
  type IpcFailureEnvelope,
  type IpcSuccessEnvelope,
  type NamePickerApi,
  type SerializedIpcError,
  type WindowControlAction,
  type WindowControlsApi,
} from '../shared/ipcTypes';
import type { RosterState } from '../shared/types';

type UnknownRecord = Record<string, unknown>;

type RendererIpcError = Error & { code: string };

const FALLBACK_ERROR: SerializedIpcError = {
  code: 'INTERNAL_ERROR',
  message: '操作失败。',
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSuccessEnvelope(value: unknown): value is IpcSuccessEnvelope<unknown> {
  return (
    isRecord(value) &&
    value.ok === true &&
    Object.prototype.hasOwnProperty.call(value, 'data')
  );
}

function isFailureEnvelope(value: unknown): value is IpcFailureEnvelope {
  if (!isRecord(value) || value.ok !== false || !isRecord(value.error)) {
    return false;
  }

  return (
    typeof value.error.code === 'string' &&
    value.error.code.length > 0 &&
    typeof value.error.message === 'string'
  );
}

function createRendererError(serializedError: SerializedIpcError): RendererIpcError {
  const error = new Error(serializedError.message) as RendererIpcError;
  error.name = 'IpcError';
  error.code = serializedError.code;
  return error;
}

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  let response: unknown;
  try {
    response = await ipcRenderer.invoke(channel, ...args);
  } catch {
    throw createRendererError(FALLBACK_ERROR);
  }

  if (isSuccessEnvelope(response)) {
    return response.data as T;
  }
  if (isFailureEnvelope(response)) {
    throw createRendererError(response.error);
  }

  throw createRendererError(FALLBACK_ERROR);
}

async function requestWindowControl(action: WindowControlAction): Promise<boolean> {
  return invoke<boolean>(IPC_CHANNELS.windowControl, action);
}

const windowControls: WindowControlsApi = Object.freeze({
  async minimize(): Promise<void> {
    await requestWindowControl('minimize');
  },
  async toggleMaximize(): Promise<void> {
    await requestWindowControl('toggle-maximize');
  },
  async close(): Promise<void> {
    await requestWindowControl('close');
  },
  isMaximized: () => requestWindowControl('get-maximized'),
  onMaximizedChange(listener: (isMaximized: boolean) => void): () => void {
    const handleChange = (_event: unknown, isMaximized: unknown): void => {
      listener(isMaximized === true);
    };
    ipcRenderer.on(IPC_CHANNELS.windowMaximizedChanged, handleChange);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.windowMaximizedChanged, handleChange);
    };
  },
});

const namePicker: NamePickerApi = Object.freeze({
  importRoster: () => invoke<ImportResult>(IPC_CHANNELS.importRoster),
  loadState: () => invoke<RosterState | null>(IPC_CHANNELS.loadState),
  saveState: (state: RosterState) => invoke<void>(IPC_CHANNELS.saveState, state),
  clearState: () => invoke<void>(IPC_CHANNELS.clearState),
  windowControls,
  // 开机自启设置：主界面窗口可用
  launchSettings: Object.freeze({
    getCurrent: () => invoke<boolean>(IPC_CHANNELS.launchSettings, 'get'),
    setEnabled: (enabled: boolean) =>
      invoke<void>(IPC_CHANNELS.launchSettings, 'set', { enabled }),
  }),
  // 品牌自定义：窗口标题与图标实时应用
  brandingControls: Object.freeze({
    apply: (branding: { windowTitle?: string; iconData?: string }) =>
      invoke<void>(IPC_CHANNELS.branding, 'apply', branding),
  }),
  // 星级回写：同步到名单源文件，失败静默
  starSync: Object.freeze({
    sync: (sourcePath: string, entries: { name: string; star: number }[]) =>
      invoke<void>(IPC_CHANNELS.syncStars, 'sync', { sourcePath, entries }),
  }),
});

contextBridge.exposeInMainWorld('namePicker', namePicker);
