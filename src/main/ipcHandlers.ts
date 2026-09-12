import { basename, extname, win32 } from 'node:path';
import type { OpenDialogOptions } from 'electron';
import {
  IPC_CHANNELS,
  type ImportResult,
  type IpcFailureEnvelope,
  type IpcResponse,
  type SerializedIpcError,
} from '../shared/ipcTypes';
import type { RosterState, StudentRecord } from '../shared/types';

export interface OpenDialogResult {
  canceled: boolean;
  filePaths: string[];
}

export type ShowOpenDialog = (options: OpenDialogOptions) => Promise<OpenDialogResult>;

export interface IpcHandlerDependencies {
  showOpenDialog: ShowOpenDialog;
  importRoster: (filePath: string) => Promise<ImportResult>;
  store: {
    load: () => Promise<unknown | null>;
    save: (state: RosterState) => Promise<void>;
    clear: () => Promise<void>;
  };
}

export interface IpcHandlers {
  importRoster(): Promise<ImportResult>;
  loadState(): Promise<RosterState | null>;
  saveState(state: unknown): Promise<void>;
  clearState(): Promise<void>;
}

export interface IpcMainLike {
  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void;
}

export const ROSTER_FILE_DIALOG_OPTIONS: OpenDialogOptions = {
  properties: ['openFile'],
  filters: [{ name: '名单文件', extensions: ['txt', 'csv', 'xlsx'] }],
};

const ERROR_MESSAGES = {
  READ_FAILED: '名单文件读取失败。',
  PARSE_FAILED: '名单文件解析失败。',
  UNSUPPORTED_FORMAT: '不支持的名单文件格式。',
  EMPTY_FILE: '名单文件为空。',
  STORAGE_READ_FAILED: '本地名单读取失败。',
  STORAGE_PARSE_FAILED: '本地名单数据损坏。',
  STORAGE_WRITE_FAILED: '本地名单保存失败。',
  STORAGE_CLEAR_FAILED: '本地名单清除失败。',
  IMPORT_CANCELLED: '已取消导入。',
  FILE_DIALOG_FAILED: '文件选择失败。',
  INVALID_STATE: '名单状态数据无效。',
  UNAUTHORIZED_SENDER: '未授权的调用来源。',
  INTERNAL_ERROR: '操作失败。',
} as const;

const FALLBACK_ERROR_MESSAGES = {
  IMPORT_CANCELLED: ERROR_MESSAGES.IMPORT_CANCELLED,
  FILE_DIALOG_FAILED: ERROR_MESSAGES.FILE_DIALOG_FAILED,
  INTERNAL_ERROR: ERROR_MESSAGES.INTERNAL_ERROR,
} as const;

const SUPPORTED_ROSTER_EXTENSIONS = new Set(['.txt', '.csv', '.xlsx']);
const TRUSTED_DEV_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

type UnknownRecord = Record<string, unknown>;

type KnownErrorCode = keyof typeof ERROR_MESSAGES;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(record: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isKnownErrorCode(code: string): code is KnownErrorCode {
  return Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, code);
}

function getErrorCode(error: unknown): string | undefined {
  if (!isRecord(error) || !hasOwn(error, 'code')) {
    return undefined;
  }

  return typeof error.code === 'string' ? error.code : undefined;
}

export function serializeIpcError(
  error: unknown,
  fallbackCode: keyof typeof FALLBACK_ERROR_MESSAGES = 'INTERNAL_ERROR',
): SerializedIpcError {
  const code = getErrorCode(error);
  if (code !== undefined && isKnownErrorCode(code)) {
    return { code, message: ERROR_MESSAGES[code] };
  }

  return { code: fallbackCode, message: FALLBACK_ERROR_MESSAGES[fallbackCode] };
}

function cancellationError(): SerializedIpcError {
  return { code: 'IMPORT_CANCELLED', message: ERROR_MESSAGES.IMPORT_CANCELLED };
}

function invalidStateError(): SerializedIpcError {
  return { code: 'INVALID_STATE', message: ERROR_MESSAGES.INVALID_STATE };
}

function unsupportedFormatError(): SerializedIpcError {
  return { code: 'UNSUPPORTED_FORMAT', message: ERROR_MESSAGES.UNSUPPORTED_FORMAT };
}

function normalizeRequiredString(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  return value;
}

function normalizeSourceName(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  const sourceName = basename(win32.basename(value.trim()));
  if (sourceName.length === 0 || sourceName === '.' || sourceName === '..') {
    return undefined;
  }

  return sourceName;
}

function normalizeStudentRecord(value: unknown): StudentRecord | undefined {
  if (
    !isRecord(value) ||
    !hasOwn(value, 'id') ||
    !hasOwn(value, 'name') ||
    !hasOwn(value, 'weight') ||
    !hasOwn(value, 'drawnThisRound')
  ) {
    return undefined;
  }

  const id = normalizeRequiredString(value.id);
  const name = normalizeRequiredString(value.name);
  if (
    id === undefined ||
    name === undefined ||
    typeof value.weight !== 'number' ||
    !Number.isFinite(value.weight) ||
    value.weight < 0 ||
    typeof value.drawnThisRound !== 'boolean'
  ) {
    return undefined;
  }

  return {
    id,
    name,
    weight: value.weight,
    drawnThisRound: value.drawnThisRound,
  };
}

function normalizeHistoryItem(value: unknown): RosterState['history'][number] | undefined {
  if (
    !isRecord(value) ||
    !hasOwn(value, 'id') ||
    !hasOwn(value, 'drawnAt') ||
    !hasOwn(value, 'studentNames')
  ) {
    return undefined;
  }

  const id = normalizeRequiredString(value.id);
  const drawnAt = normalizeRequiredString(value.drawnAt);
  if (id === undefined || drawnAt === undefined || !Array.isArray(value.studentNames)) {
    return undefined;
  }

  const studentNames: string[] = [];
  for (const studentName of value.studentNames) {
    const normalizedStudentName = normalizeRequiredString(studentName);
    if (normalizedStudentName === undefined) {
      return undefined;
    }
    studentNames.push(normalizedStudentName);
  }

  return { id, drawnAt, studentNames };
}

function normalizeSettings(value: unknown): RosterState['settings'] | undefined {
  if (
    !isRecord(value) ||
    !hasOwn(value, 'animationEnabled') ||
    !hasOwn(value, 'animationDurationMs') ||
    !hasOwn(value, 'theme')
  ) {
    return undefined;
  }

  if (
    typeof value.animationEnabled !== 'boolean' ||
    typeof value.animationDurationMs !== 'number' ||
    !Number.isFinite(value.animationDurationMs) ||
    value.animationDurationMs < 0 ||
    value.theme !== 'light'
  ) {
    return undefined;
  }

  const normalizedSettings: AppSettings = {
    animationEnabled: value.animationEnabled,
    animationDurationMs: value.animationDurationMs,
    theme: 'light',
  };

  if (
    value.animationStyle === 'slot' ||
    value.animationStyle === 'marquee' ||
    value.animationStyle === 'spotlight'
  ) {
    normalizedSettings.animationStyle = value.animationStyle;
  }

  if (typeof value.allowDuplicates === 'boolean') {
    normalizedSettings.allowDuplicates = value.allowDuplicates;
  }

  if (
    typeof value.fullscreenDisplayMs === 'number' &&
    Number.isFinite(value.fullscreenDisplayMs) &&
    value.fullscreenDisplayMs >= 0
  ) {
    normalizedSettings.fullscreenDisplayMs = value.fullscreenDisplayMs;
  }

  return normalizedSettings;
}

export function normalizeRosterState(value: unknown): RosterState | undefined {
  if (
    !isRecord(value) ||
    !hasOwn(value, 'sourceName') ||
    !hasOwn(value, 'students') ||
    !hasOwn(value, 'history') ||
    !hasOwn(value, 'settings')
  ) {
    return undefined;
  }

  const sourceName = normalizeSourceName(value.sourceName);
  const settings = normalizeSettings(value.settings);
  if (
    sourceName === undefined ||
    settings === undefined ||
    !Array.isArray(value.students) ||
    !Array.isArray(value.history)
  ) {
    return undefined;
  }

  const students: StudentRecord[] = [];
  for (const student of value.students) {
    const normalizedStudent = normalizeStudentRecord(student);
    if (normalizedStudent === undefined) {
      return undefined;
    }
    students.push(normalizedStudent);
  }

  const history: RosterState['history'] = [];
  for (const historyItem of value.history) {
    const normalizedHistoryItem = normalizeHistoryItem(historyItem);
    if (normalizedHistoryItem === undefined) {
      return undefined;
    }
    history.push(normalizedHistoryItem);
  }

  return { sourceName, students, history, settings };
}

export function isRosterState(value: unknown): value is RosterState {
  return normalizeRosterState(value) !== undefined;
}

function safelyNormalizeRosterState(value: unknown): RosterState | undefined {
  try {
    return normalizeRosterState(value);
  } catch {
    return undefined;
  }
}

function sanitizeImportResult(result: ImportResult): ImportResult {
  if (!isRecord(result) || !hasOwn(result, 'sourceName') || !hasOwn(result, 'students')) {
    throw new Error('Invalid importer result');
  }

  const sourceName = normalizeSourceName(result.sourceName);
  if (sourceName === undefined || !Array.isArray(result.students)) {
    throw new Error('Invalid importer result');
  }

  const students: StudentRecord[] = [];
  for (const student of result.students) {
    const normalizedStudent = normalizeStudentRecord(student);
    if (normalizedStudent === undefined) {
      throw new Error('Invalid importer result');
    }
    students.push(normalizedStudent);
  }

  return { sourceName, students };
}

function isSupportedRosterFile(filePath: unknown): filePath is string {
  return typeof filePath === 'string' && SUPPORTED_ROSTER_EXTENSIONS.has(extname(filePath).toLowerCase());
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

      if (
        dialogResult === null ||
        typeof dialogResult !== 'object' ||
        typeof dialogResult.canceled !== 'boolean' ||
        !Array.isArray(dialogResult.filePaths)
      ) {
        throw serializeIpcError(undefined, 'FILE_DIALOG_FAILED');
      }

      const filePath = dialogResult.filePaths[0];
      if (dialogResult.canceled || filePath === undefined) {
        throw cancellationError();
      }
      if (!isSupportedRosterFile(filePath)) {
        throw unsupportedFormatError();
      }

      try {
        return sanitizeImportResult(await dependencies.importRoster(filePath));
      } catch (error) {
        throw serializeIpcError(error);
      }
    },

    async loadState(): Promise<RosterState | null> {
      try {
        const state = await dependencies.store.load();
        if (state === null) {
          return null;
        }

        const normalizedState = safelyNormalizeRosterState(state);
        if (normalizedState === undefined) {
          throw invalidStateError();
        }
        return normalizedState;
      } catch (error) {
        throw serializeIpcError(error);
      }
    },

    async saveState(state: unknown): Promise<void> {
      const normalizedState = safelyNormalizeRosterState(state);
      if (normalizedState === undefined) {
        throw invalidStateError();
      }

      try {
        await dependencies.store.save(normalizedState);
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

export function isTrustedIpcSender(event: unknown): boolean {
  if (!isRecord(event) || !isRecord(event.senderFrame) || typeof event.senderFrame.url !== 'string') {
    return false;
  }

  try {
    const url = new URL(event.senderFrame.url);
    if (url.username !== '' || url.password !== '') {
      return false;
    }
    if (url.protocol === 'file:') {
      return url.hostname === '' || url.hostname.toLowerCase() === 'localhost';
    }
    return url.protocol === 'http:' && TRUSTED_DEV_HOSTNAMES.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function unauthorizedSenderEnvelope(): IpcFailureEnvelope {
  return {
    ok: false,
    error: { code: 'UNAUTHORIZED_SENDER', message: ERROR_MESSAGES.UNAUTHORIZED_SENDER },
  };
}

async function toIpcEnvelope<T>(operation: () => Promise<T>): Promise<IpcResponse<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    return { ok: false, error: serializeIpcError(error) };
  }
}

function handleTrustedRequest<T>(
  event: unknown,
  operation: () => Promise<T>,
): Promise<IpcResponse<T>> {
  if (!isTrustedIpcSender(event)) {
    return Promise.resolve(unauthorizedSenderEnvelope());
  }

  return toIpcEnvelope(operation);
}

export function registerIpcHandlers(ipcMain: IpcMainLike, handlers: IpcHandlers): void {
  ipcMain.handle(IPC_CHANNELS.importRoster, (event) =>
    handleTrustedRequest(event, () => handlers.importRoster()),
  );
  ipcMain.handle(IPC_CHANNELS.loadState, (event) =>
    handleTrustedRequest(event, () => handlers.loadState()),
  );
  ipcMain.handle(IPC_CHANNELS.saveState, (event, state) =>
    handleTrustedRequest(event, () => handlers.saveState(state)),
  );
  ipcMain.handle(IPC_CHANNELS.clearState, (event) =>
    handleTrustedRequest(event, () => handlers.clearState()),
  );
}
