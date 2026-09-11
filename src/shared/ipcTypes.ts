import type { RosterState, StudentRecord } from './types';

export const IPC_CHANNELS = {
  importRoster: 'name-picker:import-roster',
  loadState: 'name-picker:load-state',
  saveState: 'name-picker:save-state',
  clearState: 'name-picker:clear-state',
} as const;

export interface ImportResult {
  sourceName: string;
  students: StudentRecord[];
}

export interface SerializedIpcError {
  code: string;
  message: string;
}

export interface IpcSuccessEnvelope<T> {
  ok: true;
  data: T;
}

export interface IpcFailureEnvelope {
  ok: false;
  error: SerializedIpcError;
}

export type IpcResponse<T> = IpcSuccessEnvelope<T> | IpcFailureEnvelope;

export interface NamePickerApi {
  importRoster(): Promise<ImportResult>;
  loadState(): Promise<RosterState | null>;
  saveState(state: RosterState): Promise<void>;
  clearState(): Promise<void>;
}
