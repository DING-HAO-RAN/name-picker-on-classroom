import { readFile } from 'node:fs/promises';
import { RosterImportError } from './importErrors';

export async function readTextNames(filePath: string): Promise<string[]> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf8');
  } catch {
    throw new RosterImportError('READ_FAILED', '名单文件读取失败。');
  }

  return content
    .replace(/^\uFEFF/, '')
    .split(/\r\n|\n|\r/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}
