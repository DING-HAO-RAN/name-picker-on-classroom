import { describe, expect, it } from 'vitest';
import { getRollIntervalMs, pickRollingName, ROLL_MAX_INTERVAL_MS, ROLL_MIN_INTERVAL_MS } from './rollPacing';

describe('抽取滚动节奏', () => {
  it('随进度递减变慢：开头明显快于结尾', () => {
    const atStart = getRollIntervalMs(0, 2000, () => 0.5);
    const inMiddle = getRollIntervalMs(1000, 2000, () => 0.5);
    const atEnd = getRollIntervalMs(2000, 2000, () => 0.5);

    expect(atStart).toBeLessThan(inMiddle);
    expect(inMiddle).toBeLessThan(atEnd);
    expect(atStart).toBe(ROLL_MIN_INTERVAL_MS);
    expect(atEnd).toBe(ROLL_MAX_INTERVAL_MS);
  });

  it('抖动让切换间隔非等距，但始终落在合理区间内', () => {
    const intervals = Array.from({ length: 40 }, (_, index) =>
      getRollIntervalMs(index * 50, 2000, () => (index % 2 === 0 ? 0 : 1)),
    );
    const distinctIntervals = new Set(intervals);

    expect(distinctIntervals.size).toBeGreaterThan(1);
    for (const interval of intervals) {
      expect(interval).toBeGreaterThanOrEqual(Math.floor(ROLL_MIN_INTERVAL_MS * 0.75));
      expect(interval).toBeLessThanOrEqual(Math.ceil(ROLL_MAX_INTERVAL_MS * 1.25));
    }
  });

  it.each([
    ['总时长为 0', 0, 0],
    ['总时长为负', 100, -1],
    ['总时长非有限', 100, Number.POSITIVE_INFINITY],
    ['进度超出范围', 5000, 1000],
  ])('非法输入时退回最小间隔（%s）', (_description, elapsedMs, totalMs) => {
    expect(getRollIntervalMs(elapsedMs, totalMs, () => 0.5)).toBeGreaterThanOrEqual(
      ROLL_MIN_INTERVAL_MS,
    );
  });

  it('避免同一位置连续出现同名', () => {
    const candidates = ['甲', '乙'];

    // random 固定取到下标 0（甲），上一帧也是甲时应改取下一位
    expect(pickRollingName(candidates, '甲', () => 0)).toBe('乙');
    expect(pickRollingName(candidates, '乙', () => 0)).toBe('甲');
    // 只有一个候选时不再强求变化
    expect(pickRollingName(['独苗'], '独苗', () => 0)).toBe('独苗');
    // 空候选列表给出兜底文案
    expect(pickRollingName([], undefined, () => 0)).toBe('候选人');
  });
});
