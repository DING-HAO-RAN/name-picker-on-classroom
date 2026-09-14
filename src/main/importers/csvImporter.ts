import { readFile } from 'node:fs/promises';
import { TextDecoder } from 'node:util';
import * as Papa from 'papaparse';
import { RosterImportError } from './importErrors';
import type { ImportedRosterEntry } from './rosterEntry';
import { parseStarCell } from './rosterEntry';

function decodeCsvContent(content: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(content);
  } catch {
    try {
      return new TextDecoder('gb18030', { fatal: true }).decode(content);
    } catch {
      throw new RosterImportError('PARSE_FAILED', 'CSV 文件编码无法识别。');
    }
  }
}

/** CSV 第一列是姓名，第二列是可选的星级（1-5） */
export async function readCsvNames(filePath: string): Promise<ImportedRosterEntry[]> {
  let content: Buffer;
  try {
    content = await readFile(filePath);
  } catch {
    throw new RosterImportError('READ_FAILED', '名单文件读取失败。');
  }

  try {
    const parsed = Papa.parse<string[]>(decodeCsvContent(content), {
      delimiter: ',',
      skipEmptyLines: false,
    });
    if (parsed.errors.length > 0) {
      throw new RosterImportError('PARSE_FAILED', 'CSV 文件解析失败。');
    }

    const firstNonEmptyRowIndex = parsed.data.findIndex((row) =>
      row.some((cell) => String(cell ?? '').trim().length > 0),
    );
    const headerRow = parsed.data[firstNonEmptyRowIndex];
    const nameColumnIndex =
      headerRow?.findIndex((cell) => String(cell ?? '').trim() === '姓名') ?? -1;
    const starColumnIndex = nameColumnIndex >= 0 ? nameColumnIndex + 1 : 1;
    const dataRows =
      nameColumnIndex >= 0 ? parsed.data.slice(firstNonEmptyRowIndex + 1) : parsed.data;
    const entries = dataRows
      .map((row) => ({
        name: String(row[nameColumnIndex >= 0 ? nameColumnIndex : 0] ?? '').trim(),
        star: parseStarCell(row[starColumnIndex]),
      }))
      .filter((entry) => entry.name.length > 0);
    return entries;
  } catch (error) {
    if (error instanceof RosterImportError) {
      throw error;
    }
    throw new RosterImportError('PARSE_FAILED', 'CSV 文件解析失败。');
  }
}
