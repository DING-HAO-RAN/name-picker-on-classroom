import { basename, win32 } from 'node:path';
import type { OpenDialogOptions } from 'electron';
import { IPC_CHANNELS } from '../shared/ipcTypes';
import type { ImportResult, SerializedIpcError } from '../shared/ipcTypes';
import type { RosterState, StudentRecord } from '../shared/types';
import type { RosterImportErrorCode } from './importers/importErrors';
import type { LocalStore } from './storage/localStore';

export interface OpenDialogResult {
  canceled: boolean;
  filePaths: string[];
}

export type ShowOpenDialog = (options: OpenDialogOptions) => Promise<OpenDialogResult>;

export interface IpcHandlerDependencies {
  showOpenDialog: ShowOpenDialog;
  importRoster: (filePath: string) => Promise<ImportResult>;
  store: Pick<LocalStore, 'load' | 'save' | 'clear'>;
}

export interface IpcHandlers {
  importRoster(): Promise<ImportResult>;
  loadState(): Promise<RosterState | null>;
  saveState(state: RosterState): Promise<void>;
  clearState(): Promise<void>;
}

export interface IpcMainLike {
  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void;
}

export const ROSTER_FILE_DIALOG_OPTIONS: OpenDialogOptions = {
  properties: ['openFile'],
  filters: [{ name: '名单文件', extensions: ['txt', 'csv', 'xlsx'] }],
};

const IMPORT_ERROR_MESSAGES: Record<RosterImportErrorCode, string> = {
  READ_FAILED: '名单文件读取失败。',
  PARSE_FAILED: '名单文件解析失败。',
  UNSUPPORTED_FORMAT: '不支持的名单文件格式。',
  EMPTY_FILE: '名单文件为空。',
};

const STORAGE_ERROR_MESSAGES = {
  STORAGE_READ_FAILED: '本地名单读取失败。',
  STORAGE_PARSE_FAILED: '本地名单数据损坏。',
  STORAGE_WRITE_FAILED: '本地名单保存失败。',
  STORAGE_CLEAR_FAILED: '本地名单清除失败。',
} as const;

const FALLBACK_ERROR_MESSAGES = {
  IMPORT_CANCELLED: '已取消导入。',
  FILE_DIALOG_FAILED: '文件选择失败。',
  INTERNAL_ERROR: '操作失败。',
} as const;

const IMPORT_ERROR_CODES = new Set<keyof typeof IMPORT_ERROR_MESSAGES>([
  'READ_FAILED',
  'PARSE_FAILED',
  'UNSUPPORTED_FORMAT',
  'EMPTY_FILE',
]);

const STORAGE_ERROR_CODES = new Set<keyof typeof STORAGE_ERROR_MESSAGES>([
  'STORAGE_READ_FAILED',
  'STORAGE_PARSE_FAILED',
  'STORAGE_WRITE_FAILED',
  'STORAGE_CLEAR_FAILED',
]);

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  const code = error.code;
  return typeof code === 'string' ? code : undefined;
}

export function serializeIpcError(
  error: unknown,
  fallbackCode: keyof typeof FALLBACK_ERROR_MESSAGES = 'INTERNAL_ERROR',
): SerializedIpcError {
  const code = getErrorCode(error);
  if (code !== undefined && IMPORT_ERROR_CODES.has(code as RosterImportErrorCode)) {
    const importCode = code as RosterImportErrorCode;
    return { code: importCode, message: IMPORT_ERROR_MESSAGES[importCode] };
  }

  if (code !== undefined && STORAGE_ERROR_CODES.has(code as keyof typeof STORAGE_ERROR_MESSAGES)) {
    const storageCode = code as keyof typeof STORAGE_ERROR_MESSAGES;
    return { code: storageCode, message: STORAGE_ERROR_MESSAGES[storageCode] };
  }

  return { code: fallbackCode, message: FALLBACK_ERROR_MESSAGES[fallbackCode] };
}

function cancellationError(): SerializedIpcError {
  return { code: 'IMPORT_CANCELLED', message: FALLBACK_ERROR_MESSAGES.IMPORT_CANCELLED };
}

function sanitizeImportResult(result: ImportResult): ImportResult {
  return {
    sourceName: basename(win32.basename(result.sourceName)),
    students: result.students.map((student: StudentRecord) => ({
      id: student.id,
      name: student.name,
      weight: student.weight,
      drawnThisRound: student.drawnThisRound,
    })),
  };
}

export function createIpcHandlers(dependencies: IpcHandlerDependencies): IpcHandlers {
  return {
    async importRoster(): Promise<ImportResult> {
      let dialogResult: OpenDialogResult;
      try {
        dialogResult = await dependencies.showOpenDialog(ROSTER_FILE_DIALOG_OPTIONS);
      } catch (error) {
        throw serializeIpcError(error, 'FILE_DIALOG_FAILED');
      }

      const filePath = dialogResult.filePaths[0];
      if (dialogResult.canceled || filePath === undefined) {
        throw cancellationError();
      }

      try {
        return sanitizeImportResult(await dependencies.importRoster(filePath));
      } catch (error) {
        throw serializeIpcError(error);
      }
    },

    async loadState(): Promise<RosterState | null> {
      try {
        return await dependencies.store.load();
      } catch (error) {
        throw serializeIpcError(error);
      }
    },

    async saveState(state: RosterState): Promise<void> {
      try {
        await dependencies.store.save(state);
      } catch (error) {
        throw serializeIpcError(error);
      }
    },

    async clearState(): Promise<void> {
      try {
        await dependencies.store.clear();
      } catch (error) {
        throw serializeIpcError(error);
      }
    },
  };
}

export function registerIpcHandlers(ipcMain: IpcMainLike, handlers: IpcHandlers): void {
  ipcMain.handle(IPC_CHANNELS.importRoster, () => handlers.importRoster());
  ipcMain.handle(IPC_CHANNELS.loadState, () => handlers.loadState());
  ipcMain.handle(IPC_CHANNELS.saveState, (_event, state) =>
    handlers.saveState(state as RosterState),
  );
  ipcMain.handle(IPC_CHANNELS.clearState, () => handlers.clearState());
}
