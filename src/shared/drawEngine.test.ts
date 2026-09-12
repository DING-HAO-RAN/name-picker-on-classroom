import { describe, expect, it, vi } from 'vitest';
import type { StudentRecord } from './types';
import { drawStudents, resetRound, validateWeight } from './drawEngine';

function student(id: string, weight = 1, drawnThisRound = false): StudentRecord {
  return {
    id,
    name: `测试学生-${id}`,
    weight,
    drawnThisRound,
  };
}

describe('加权无放回抽取核心', () => {
  it('使用注入的随机函数按累计权重抽取，并标记本轮状态', () => {
    const students = [student('a'), student('b', 3), student('c')];
    const random = vi.fn(() => 0.5);

    const result = drawStudents(students, 1, random);

    expect(result.selected.map((item) => item.id)).toEqual(['b']);
    expect(result.selected[0]?.drawnThisRound).toBe(true);
    expect(result.updatedStudents).toEqual([
      student('a'),
      student('b', 3, true),
      student('c'),
    ]);
    expect(random).toHaveBeenCalledTimes(1);
    expect(students).toEqual([student('a'), student('b', 3), student('c')]);
  });

  it('排除权重为零的记录', () => {
    const students = [student('zero', 0), student('available')];

    const result = drawStudents(students, 1, () => 0);

    expect(result.selected.map((item) => item.id)).toEqual(['available']);
    expect(result.updatedStudents).toEqual([
      student('zero', 0),
      student('available', 1, true),
    ]);
  });

  it('同一批次不会重复抽到同一条记录', () => {
    const students = [student('a'), student('b'), student('c')];

    const result = drawStudents(students, 3, () => 0);

    expect(result.selected.map((item) => item.id)).toHaveLength(3);
    expect(new Set(result.selected.map((item) => item.id)).size).toBe(3);
    expect(result.updatedStudents.every((item) => item.drawnThisRound)).toBe(true);
    expect(result.shortage).toBe(false);
  });

  it('排除本轮已经抽到的记录', () => {
    const students = [student('already-drawn', 100, true), student('available')];

    const result = drawStudents(students, 1, () => 0);

    expect(result.selected.map((item) => item.id)).toEqual(['available']);
    expect(result.updatedStudents).toEqual([
      student('already-drawn', 100, true),
      student('available', 1, true),
    ]);
  });

  it('可抽取人数不足时只返回可抽取记录并报告 shortage', () => {
    const students = [student('available'), student('zero', 0), student('already-drawn', 1, true)];

    const result = drawStudents(students, 3, () => 0);

    expect(result.selected.map((item) => item.id)).toEqual(['available']);
    expect(result.shortage).toBe(true);
    expect(result.updatedStudents).toEqual([
      student('available', 1, true),
      student('zero', 0),
      student('already-drawn', 1, true),
    ]);
  });

  it('重置本轮后所有记录恢复参与资格且不修改输入', () => {
    const students = [student('a', 2, true), student('b', 0, false), student('c', 1, true)];

    const result = resetRound(students);

    expect(result).toEqual([
      student('a', 2),
      student('b', 0),
      student('c', 1),
    ]);
    expect(result.every((item) => !item.drawnThisRound)).toBe(true);
    expect(students).toEqual([
      student('a', 2, true),
      student('b', 0),
      student('c', 1, true),
    ]);
  });

  it.each([Number.NaN, 0, -1, 1.5, Number.POSITIVE_INFINITY])(
    '拒绝非法抽取人数 %s',
    (count) => {
      expect(() => drawStudents([student('a')], count, () => 0)).toThrowError(RangeError);
    },
  );

  it('多个 Number.MAX_VALUE 权重相加时 random 为零仍选择首项', () => {
    const students = [
      student('max-a', Number.MAX_VALUE),
      student('max-b', Number.MAX_VALUE),
    ];

    const result = drawStudents(students, 1, () => 0);

    expect(result.selected.map((item) => item.id)).toEqual(['max-a']);
    expect(result.shortage).toBe(false);
  });

  it('极大有限权重相加溢出时仍按权重比例选择', () => {
    const students = [
      student('max', Number.MAX_VALUE),
      student('half-max', Number.MAX_VALUE / 2),
    ];

    const result = drawStudents(students, 1, () => 0.5);

    expect(result.selected.map((item) => item.id)).toEqual(['max']);
    expect(result.shortage).toBe(false);
  });

  it('开启可重复抽取时，本轮已抽中学生仍可参与且不修改已抽状态', () => {
    const students = [student('already', 10, true), student('candidate', 1)];
    const random = vi.fn(() => 0);

    const result = drawStudents(students, 1, random, { allowDuplicates: true });

    expect(result.selected.map((item) => item.id)).toEqual(['already']);
    // 不强制更新为 true，原状态保留
    expect(result.updatedStudents).toEqual([
      student('already', 10, true),
      student('candidate', 1, false),
    ]);
  });

  it('开启可重复抽取时，单次抽取多人依然互不重复', () => {
    const students = [student('a'), student('b'), student('c')];

    const result = drawStudents(students, 2, () => 0, { allowDuplicates: true });

    expect(result.selected).toHaveLength(2);
    expect(new Set(result.selected.map((item) => item.id)).size).toBe(2);
    // 所有学生的 drawnThisRound 状态不被锁定
    expect(result.updatedStudents.every((item) => !item.drawnThisRound)).toBe(true);
  });

  it.each([
    [0, true],
    [1, true],
    [Number.MAX_VALUE, true],
    [-0.1, false],
    [Number.NaN, false],
    [Number.POSITIVE_INFINITY, false],
    [Number.NEGATIVE_INFINITY, false],
  ])('validateWeight(%s) 只接受有限的非负数', (value, expected) => {
    expect(validateWeight(value)).toBe(expected);
  });
});
