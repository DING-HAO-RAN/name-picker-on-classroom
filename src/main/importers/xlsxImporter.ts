import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import { RosterImportError } from './importErrors';

export async function readXlsxNames(filePath: string): Promise<string[]> {
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
    const names = rows
      .map((row) => String(row[0] ?? '').trim())
      .filter((name) => name.length > 0);
    if (names[0] === '姓名') {
      names.shift();
    }
    return names;
  } catch {
    throw new RosterImportError('PARSE_FAILED', 'XLSX 文件解析失败。');
  }
}
