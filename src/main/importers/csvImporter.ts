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

    const names = parsed.data.map((row) => String(row[0] ?? '').trim());
    if (names[0] === '姓名') {
      names.shift();
    }
    return names.filter((name) => name.length > 0);
  } catch (error) {
    if (error instanceof RosterImportError) {
      throw error;
    }
    throw new RosterImportError('PARSE_FAILED', 'CSV 文件解析失败。');
  }
}
