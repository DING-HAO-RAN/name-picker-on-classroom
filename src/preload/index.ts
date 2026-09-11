import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  type ImportResult,
  type IpcFailureEnvelope,
  type IpcSuccessEnvelope,
  type NamePickerApi,
  type SerializedIpcError,
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

const namePicker: NamePickerApi = Object.freeze({
  importRoster: () => invoke<ImportResult>(IPC_CHANNELS.importRoster),
  loadState: () => invoke<RosterState | null>(IPC_CHANNELS.loadState),
  saveState: (state: RosterState) => invoke<void>(IPC_CHANNELS.saveState, state),
  clearState: () => invoke<void>(IPC_CHANNELS.clearState),
});

contextBridge.exposeInMainWorld('namePicker', namePicker);
