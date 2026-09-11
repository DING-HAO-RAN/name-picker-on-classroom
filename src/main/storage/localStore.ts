import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RosterState } from '../../shared/types';

export type LocalStoreErrorCode =
  | 'STORAGE_READ_FAILED'
  | 'STORAGE_PARSE_FAILED'
  | 'STORAGE_WRITE_FAILED'
  | 'STORAGE_CLEAR_FAILED';

export class LocalStoreError extends Error {
  readonly code: LocalStoreErrorCode;

  constructor(code: LocalStoreErrorCode, message: string) {
    super(message);
    this.name = 'LocalStoreError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStudentRecord(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.weight === 'number' &&
    Number.isFinite(value.weight) &&
    typeof value.drawnThisRound === 'boolean'
  );
}

function isDrawHistoryItem(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.drawnAt === 'string' &&
    Array.isArray(value.studentNames) &&
    value.studentNames.every((studentName) => typeof studentName === 'string')
  );
}

function isAppSettings(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.animationEnabled === 'boolean' &&
    typeof value.animationDurationMs === 'number' &&
    Number.isFinite(value.animationDurationMs) &&
    value.theme === 'light'
  );
}

function isRosterState(value: unknown): value is RosterState {
  return (
    isRecord(value) &&
    typeof value.sourceName === 'string' &&
    Array.isArray(value.students) &&
    value.students.every(isStudentRecord) &&
    Array.isArray(value.history) &&
    value.history.every(isDrawHistoryItem) &&
    isAppSettings(value.settings)
  );
}

export class LocalStore {
  private readonly userDataDirectory: string;
  private readonly stateFilePath: string;

  constructor(userDataDirectory: string) {
    this.userDataDirectory = userDataDirectory;
    this.stateFilePath = join(userDataDirectory, 'roster-state.json');
  }

  async load(): Promise<RosterState | null> {
    let content: string;
    try {
      content = await readFile(this.stateFilePath, 'utf8');
    } catch (error) {
      if (isMissingFile(error)) {
        return null;
      }
      throw new LocalStoreError('STORAGE_READ_FAILED', '本地名单读取失败。');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new LocalStoreError('STORAGE_PARSE_FAILED', '本地名单数据损坏。');
    }

    if (!isRosterState(parsed)) {
      throw new LocalStoreError('STORAGE_PARSE_FAILED', '本地名单数据损坏。');
    }

    return parsed;
  }

  async save(state: RosterState): Promise<void> {
    const temporaryFilePath = join(
      this.userDataDirectory,
      `.roster-state-${randomUUID()}.tmp`,
    );

    try {
      await mkdir(this.userDataDirectory, { recursive: true });
      await writeFile(temporaryFilePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
      await rename(temporaryFilePath, this.stateFilePath);
    } catch {
      await removeTemporaryFile(temporaryFilePath);
      throw new LocalStoreError('STORAGE_WRITE_FAILED', '本地名单保存失败。');
    }
  }

  async clear(): Promise<void> {
    try {
      await rm(this.stateFilePath, { force: true });
    } catch {
      throw new LocalStoreError('STORAGE_CLEAR_FAILED', '本地名单清除失败。');
    }
  }
}

async function removeTemporaryFile(filePath: string): Promise<void> {
  try {
    await rm(filePath, { force: true });
  } catch {
    return;
  }
}
