import { readFile } from 'node:fs/promises';
import { TextDecoder } from 'node:util';
import { RosterImportError } from './importErrors';

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

export async function readTextNames(filePath: string): Promise<string[]> {
  let content: Buffer;
  try {
    content = await readFile(filePath);
  } catch {
    throw new RosterImportError('READ_FAILED', '名单文件读取失败。');
  }

  return decodeTextContent(content)
    .replace(/^\uFEFF/, '')
    .split(/\r\n|\n|\r/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}
