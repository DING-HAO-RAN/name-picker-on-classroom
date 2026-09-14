/** 导入名单的单条记录：名字 + 可选星级（1-5，默认 1） */
export interface ImportedRosterEntry {
  name: string;
  star: number;
}

/** 把任意单元格值解析成 1-5 的星级；缺失或非法时返回默认 1 星 */
export function parseStarCell(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5) {
    return value;
  }
  const text = String(value ?? '').trim();
  if (/^[1-5]$/.test(text)) {
    return Number(text);
  }
  return 1;
}
