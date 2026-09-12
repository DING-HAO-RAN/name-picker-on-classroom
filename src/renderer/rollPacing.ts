/** 抽取滚动节奏：名字切换的等待时间上限与下限（毫秒） */
export const ROLL_MIN_INTERVAL_MS = 60;
export const ROLL_MAX_INTERVAL_MS = 240;

/** 抖动系数范围：0.75 - 1.25 倍，让切换速度不均匀 */
const JITTER_MIN_FACTOR = 0.75;
const JITTER_RANGE = 0.5;

/**
 * 计算下一次名字切换前的等待时间。
 *
 * 采用二次缓出曲线：开头密集快速、接近结束时逐渐变慢，
 * 再叠加 ±25% 抖动，使节奏不均匀，最后一刻才揭晓，悬念更强。
 *
 * @param elapsedMs 动画已持续的时间
 * @param totalMs 动画总时长
 * @param random 随机源，默认 Math.random，测试时可注入以得到确定结果
 */
export function getRollIntervalMs(
  elapsedMs: number,
  totalMs: number,
  random: () => number = Math.random,
): number {
  if (!Number.isFinite(totalMs) || totalMs <= 0) {
    return ROLL_MIN_INTERVAL_MS;
  }

  const progress = Math.min(1, Math.max(0, elapsedMs / totalMs));
  const eased = progress * progress;
  const baseInterval = ROLL_MIN_INTERVAL_MS + (ROLL_MAX_INTERVAL_MS - ROLL_MIN_INTERVAL_MS) * eased;
  const jitterFactor = JITTER_MIN_FACTOR + random() * JITTER_RANGE;

  return Math.round(baseInterval * jitterFactor);
}

/**
 * 从候选名字中挑一个，尽量避免与上一帧同名，
 * 否则视觉上会像「卡住不动」，看起来不够自然。
 */
export function pickRollingName(
  candidates: string[],
  previousName: string | undefined,
  random: () => number = Math.random,
): string {
  if (candidates.length === 0) {
    return '候选人';
  }

  const index = Math.floor(random() * candidates.length);
  const picked = candidates[index] ?? candidates[0];
  if (candidates.length > 1 && picked === previousName) {
    return candidates[(index + 1) % candidates.length];
  }

  return picked;
}
