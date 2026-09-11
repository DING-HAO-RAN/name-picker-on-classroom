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

    try {
      return JSON.parse(content) as RosterState;
    } catch {
      throw new LocalStoreError('STORAGE_PARSE_FAILED', '本地名单数据损坏。');
    }
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
