import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as XLSX from 'xlsx';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { importRoster, RosterImportError } from './importRoster';

let fixtureDirectory: string;

async function writeFixture(fileName: string, content: string | Uint8Array): Promise<string> {
  const filePath = join(fixtureDirectory, fileName);
  await writeFile(filePath, content);
  return filePath;
}

describe('名单导入', () => {
  beforeEach(async () => {
    fixtureDirectory = await mkdtemp(join(tmpdir(), 'name-picker-import-'));
  });

  afterEach(async () => {
    await rm(fixtureDirectory, { force: true, recursive: true });
  });

  it('按行读取 TXT，清理空行和首尾空白', async () => {
    const filePath = await writeFixture('roster.txt', ' 甲同学  \r\n\r\n乙同学\n   \n');

    const result = await importRoster(filePath);

    expect(result.sourceName).toBe('roster.txt');
    expect(result.students.map((student) => student.name)).toEqual(['甲同学', '乙同学']);
    expect(result.students).toEqual([
      expect.objectContaining({ weight: 1, drawnThisRound: false }),
      expect.objectContaining({ weight: 1, drawnThisRound: false }),
    ]);
  });

  it('读取 UTF-8 CSV 第一列并跳过姓名表头', async () => {
    const filePath = await writeFixture(
      'roster.csv',
      '\uFEFF姓名,备注\n 甲同学,甲\n乙同学,乙\n',
    );

    const result = await importRoster(filePath);

    expect(result.students.map((student) => student.name)).toEqual(['甲同学', '乙同学']);
  });

  it('读取 GB18030 编码的 CSV 第一列', async () => {
    const gb18030Content = Buffer.from([0xbc, 0xd7, 0x0d, 0x0a, 0xd2, 0xd2, 0x0d, 0x0a]);
    const filePath = await writeFixture('roster-gb18030.csv', gb18030Content);

    const result = await importRoster(filePath);

    expect(result.students.map((student) => student.name)).toEqual(['甲', '乙']);
  });

  it('读取 XLSX 第一工作表第一列并忽略其他工作表', async () => {
    const workbook = XLSX.utils.book_new();
    const firstSheet = XLSX.utils.aoa_to_sheet([
      [' 甲同学 ', '备注'],
      ['乙同学', '忽略'],
      [],
      ['甲同学', '重复'],
    ]);
    const secondSheet = XLSX.utils.aoa_to_sheet([['不应导入']]);
    XLSX.utils.book_append_sheet(workbook, firstSheet, '第一表');
    XLSX.utils.book_append_sheet(workbook, secondSheet, '第二表');
    const filePath = await writeFixture(
      'roster.xlsx',
      XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }),
    );

    const result = await importRoster(filePath);

    expect(result.students.map((student) => student.name)).toEqual(['甲同学', '乙同学', '甲同学']);
  });

  it('保留同名记录并为每条记录生成不同 ID', async () => {
    const filePath = await writeFixture('duplicate.txt', '甲同学\n甲同学\n');

    const result = await importRoster(filePath);

    expect(result.students.map((student) => student.name)).toEqual(['甲同学', '甲同学']);
    expect(result.students[0]?.id).not.toBe(result.students[1]?.id);
  });

  it('空文件抛出可映射且不泄露本机路径的错误', async () => {
    const filePath = await writeFixture('empty.txt', '  \n\r\n');

    await expect(importRoster(filePath)).rejects.toMatchObject({ code: 'EMPTY_FILE' });

    try {
      await importRoster(filePath);
    } catch (error) {
      expect(error).toBeInstanceOf(RosterImportError);
      expect((error as Error).message).not.toContain(filePath);
    }
  });
});
