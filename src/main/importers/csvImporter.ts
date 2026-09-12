import { readFile } from 'node:fs/promises';
import { TextDecoder } from 'node:util';
import * as Papa from 'papaparse';
import { RosterImportError } from './importErrors';

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

export async function readCsvNames(filePath: string): Promise<string[]> {
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
    const dataRows =
      nameColumnIndex >= 0 ? parsed.data.slice(firstNonEmptyRowIndex + 1) : parsed.data;
    const names = dataRows
      .map((row) => String(row[nameColumnIndex >= 0 ? nameColumnIndex : 0] ?? '').trim())
      .filter((name) => name.length > 0);
    return names;
  } catch (error) {
    if (error instanceof RosterImportError) {
      throw error;
    }
    throw new RosterImportError('PARSE_FAILED', 'CSV 文件解析失败。');
  }
}
