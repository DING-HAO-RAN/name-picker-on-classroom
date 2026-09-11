import { randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';
import type { StudentRecord } from '../../shared/types';
import { RosterImportError } from './importErrors';
import { readCsvNames } from './csvImporter';
import { readTextNames } from './textImporter';
import { readXlsxNames } from './xlsxImporter';

export { RosterImportError } from './importErrors';

const importers = new Map<string, (filePath: string) => Promise<string[]>>([
  ['.txt', readTextNames],
  ['.csv', readCsvNames],
  ['.xlsx', readXlsxNames],
]);

export async function importRoster(
  filePath: string,
): Promise<{ sourceName: string; students: StudentRecord[] }> {
  const importer = importers.get(extname(filePath).toLowerCase());
  if (importer === undefined) {
    throw new RosterImportError('UNSUPPORTED_FORMAT', '不支持的名单文件格式。');
  }

  let names: string[];
  try {
    names = await importer(filePath);
  } catch (error) {
    if (error instanceof RosterImportError) {
      throw error;
    }
    throw new RosterImportError('PARSE_FAILED', '名单文件解析失败。');
  }

  const normalizedNames = names.map((name) => name.trim()).filter((name) => name.length > 0);
  if (normalizedNames.length === 0) {
    throw new RosterImportError('EMPTY_FILE', '名单文件为空。');
  }

  return {
    sourceName: basename(filePath),
    students: normalizedNames.map((name) => ({
      id: randomUUID(),
      name,
      weight: 1,
      drawnThisRound: false,
    })),
  };
}
