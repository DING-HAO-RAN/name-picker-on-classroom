/**
 * 星级同步回写：把设置里修改的星级写回名单源文件。
 * 只做尽力而为的同步：文件不存在、被占用或写入失败时静默忽略，绝不影响抽取流程。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';

/** 待回写的星级条目：按姓名匹配名单文件中的行 */
export interface StarSyncEntry {
  name: string;
  star: number;
}

/** 解析单行文本里「名字 [星级]」的星级部分；无星级返回 undefined */
function readTrailingStar(line: string): number | undefined {
  const parts = line.split(/\s+/);
  const last = parts[parts.length - 1] ?? '';
  return /^[1-5]$/.test(last) ? Number(last) : undefined;
}

/** TXT：逐行匹配姓名（整行按空白拆开后的首段），替换或追加星级数字 */
async function syncTextFile(filePath: string, entries: Map<string, number>): Promise<void> {
  const content = await readFile(filePath, 'utf8');
  const updatedLines = content
    .replace(/^\uFEFF/, '')
    .split(/\r\n|\n|\r/)
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        return line;
      }
      const parts = trimmed.split(/\s+/);
      const name = parts[0] ?? '';
      if (!entries.has(name)) {
        return line;
      }
      const star = entries.get(name) as number;
      const hasTrailingStar = readTrailingStar(trimmed) !== undefined;
      const updated = hasTrailingStar ? [name, String(star)].join(' ') : [name, String(star)].join(' ');
      return line.replace(trimmed, updated);
    });
  await writeFile(filePath, updatedLines.join('\n'), 'utf8');
}

/** CSV：第二列为星级，逐行替换该列（保持其余列原样，不做整体重排） */
async function syncCsvFile(filePath: string, entries: Map<string, number>): Promise<void> {
  const content = await readFile(filePath, 'utf8');
  const updatedLines = content
    .replace(/^\uFEFF/, '')
    .split(/\r\n|\n|\r/)
    .map((line) => {
      if (line.trim().length === 0) {
        return line;
      }
      const cells = line.split(',');
      const name = String(cells[0] ?? '').trim().replace(/^"|"$/g, '');
      if (!entries.has(name)) {
        return line;
      }
      cells[1] = String(entries.get(name));
      return cells.join(',');
    });
  await writeFile(filePath, updatedLines.join('\n'), 'utf8');
}

/** XLSX：读首表后按姓名更新第二列，整体写回（注意：会丢失原表格样式） */
async function syncXlsxFile(filePath: string, entries: Map<string, number>): Promise<void> {
  const content = await readFile(filePath);
  const workbook = XLSX.read(content, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (firstSheetName === undefined) {
    return;
  }
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { defval: '', header: 1, raw: false });
  for (const row of rows) {
    const name = String(row[0] ?? '').trim();
    if (entries.has(name)) {
      row[1] = entries.get(name);
    }
  }
  const updatedSheet = XLSX.utils.aoa_to_sheet(rows);
  workbook.Sheets[firstSheetName] = updatedSheet;
  await writeFile(filePath, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

/** 把星级改动同步回名单源文件；任何失败都静默忽略 */
export async function syncStarsToRosterFile(
  filePath: string,
  entries: StarSyncEntry[],
): Promise<void> {
  try {
    const entryMap = new Map(
      entries
        .filter((entry) => entry.name.trim().length > 0)
        .map((entry) => [entry.name.trim(), entry.star]),
    );
    if (entryMap.size === 0) {
      return;
    }

    const extension = extname(filePath).toLowerCase();
    if (extension === '.txt') {
      await syncTextFile(filePath, entryMap);
    } else if (extension === '.csv') {
      await syncCsvFile(filePath, entryMap);
    } else if (extension === '.xlsx') {
      await syncXlsxFile(filePath, entryMap);
    }
  } catch {
    // 名单文件可能被移动、删除或占用：按需求静默忽略，不影响应用运行
  }
}
