import { randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';
import type { StudentRecord } from '../../shared/types';
import { RosterImportError } from './importErrors';
import { readCsvNames } from './csvImporter';
import { readTextNames } from './textImporter';
import { readXlsxNames } from './xlsxImporter';

export { RosterImportError } from './importErrors';

const importers = new Map<string, (filePath: string) => Promise<{ name: string; star: number }[]>>(
  [
    ['.txt', readTextNames],
    ['.csv', readCsvNames],
    ['.xlsx', readXlsxNames],
  ],
);

export async function importRoster(
  filePath: string,
): Promise<{ sourceName: string; sourcePath: string; students: StudentRecord[] }> {
  const importer = importers.get(extname(filePath).toLowerCase());
  if (importer === undefined) {
    throw new RosterImportError('UNSUPPORTED_FORMAT', '不支持的名单文件格式。');
  }

  let entries: { name: string; star: number }[];
  try {
    entries = await importer(filePath);
  } catch (error) {
    if (error instanceof RosterImportError) {
      throw error;
    }
    throw new RosterImportError('PARSE_FAILED', '名单文件解析失败。');
  }

  const normalizedEntries = entries
    .map((entry) => ({ ...entry, name: entry.name.trim() }))
    .filter((entry) => entry.name.length > 0);
  if (normalizedEntries.length === 0) {
    throw new RosterImportError('EMPTY_FILE', '名单文件为空。');
  }

  return {
    sourceName: basename(filePath),
    // 记录完整路径：之后改星级时可以同步回写名单文件（文件移动后静默忽略）
    sourcePath: filePath,
    students: normalizedEntries.map((entry) => ({
      id: randomUUID(),
      name: entry.name,
      weight: 1,
      // 星级来自名单文件（txt 空格分隔 / 表格第二列），缺省 1 星
      star: entry.star,
      drawnThisRound: false,
      drawCount: 0,
    })),
  };
}
