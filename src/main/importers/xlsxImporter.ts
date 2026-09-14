import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import { RosterImportError } from './importErrors';
import type { ImportedRosterEntry } from './rosterEntry';
import { parseStarCell } from './rosterEntry';

/** XLSX 第一列是姓名，第二列是可选的星级（1-5） */
export async function readXlsxNames(filePath: string): Promise<ImportedRosterEntry[]> {
  let content: Buffer;
  try {
    content = await readFile(filePath);
  } catch {
    throw new RosterImportError('READ_FAILED', '名单文件读取失败。');
  }

  try {
    const workbook = XLSX.read(content, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    if (firstSheetName === undefined) {
      return [];
    }

    const firstSheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
      defval: '',
      header: 1,
      raw: false,
    });
    const entries = rows
      .map((row) => ({
        name: String(row[0] ?? '').trim(),
        star: parseStarCell(row[1]),
      }))
      .filter((entry) => entry.name.length > 0);
    if (entries[0]?.name === '姓名') {
      entries.shift();
    }
    return entries;
  } catch {
    throw new RosterImportError('PARSE_FAILED', 'XLSX 文件解析失败。');
  }
}
