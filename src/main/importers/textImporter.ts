import { readFile } from 'node:fs/promises';
import { TextDecoder } from 'node:util';
import { RosterImportError } from './importErrors';
import type { ImportedRosterEntry } from './rosterEntry';

function decodeTextContent(content: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(content);
  } catch {
    try {
      return new TextDecoder('gb18030', { fatal: true }).decode(content);
    } catch {
      throw new RosterImportError('PARSE_FAILED', 'TXT 文件编码无法识别。');
    }
  }
}

/**
 * TXT 每行格式：`名字 [星级]`——名字与可选的星级用空格分隔，
 * 星级是 1-5 的数字，缺失或非法时按默认 1 星处理
 */
export async function readTextNames(filePath: string): Promise<ImportedRosterEntry[]> {
  let content: Buffer;
  try {
    content = await readFile(filePath);
  } catch {
    throw new RosterImportError('READ_FAILED', '名单文件读取失败。');
  }

  return decodeTextContent(content)
    .replace(/^\uFEFF/, '')
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = line.split(/\s+/);
      const name = (parts[0] ?? '').trim();
      const starRaw = parts[1] !== undefined ? Number(parts[1]) : NaN;
      const star =
        Number.isInteger(starRaw) && starRaw >= 1 && starRaw <= 5 ? starRaw : 1;
      return { name, star };
    })
    .filter((entry) => entry.name.length > 0);
}
