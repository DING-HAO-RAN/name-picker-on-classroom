import { useState } from 'react';

export interface DrawControlsProps {
  count: number;
  maxCount: number;
  hasRoster?: boolean;
  animationEnabled: boolean;
  allowDuplicates?: boolean;
  disabled?: boolean;
  isAnimating?: boolean;
  isSaving?: boolean;
  /** 上一次保存是否失败；失败时锁定写操作并提供重试入口 */
  saveFailed?: boolean;
  onCountChange: (count: number) => void;
  onAnimationChange: (enabled: boolean) => void;
  onAllowDuplicatesChange?: (allowDuplicates: boolean) => void;
  onDraw: (count: number, animate: boolean) => void;
  onResetRound: () => void;
  onRetrySave?: () => void;
}

export function DrawControls({
  count,
  maxCount,
  hasRoster = maxCount > 0,
  animationEnabled,
  allowDuplicates = false,
  disabled = false,
  isAnimating = false,
  isSaving = false,
  saveFailed = false,
  onCountChange,
  onAnimationChange,
  onAllowDuplicatesChange,
  onDraw,
  onResetRound,
  onRetrySave,
}: DrawControlsProps) {
  const hasCandidates = maxCount > 0;
  const upperBound = Math.max(1, maxCount);
  const safeCount = Math.min(Math.max(1, count), upperBound);
  // 保存失败时一并锁定所有会改变名单的控件，避免继续写入不一致状态
  const controlsDisabled = disabled || isAnimating || isSaving || saveFailed;
  // 人数输入的草稿态：输入过程中保留原文，避免每次按键都被收敛成一个数字
  const [countDraft, setCountDraft] = useState<string | null>(null);
  const displayCount = countDraft ?? String(safeCount);

  function changeCount(nextCount: number): void {
    if (!hasCandidates || controlsDisabled) {
      return;
    }

    const normalizedCount = Math.min(Math.max(1, Math.floor(nextCount)), upperBound);
    setCountDraft(null);
    onCountChange(normalizedCount);
  }

  function handleCountInput(value: string): void {
    setCountDraft(value);
    const parsedCount = Number(value);
    // 空串或非数字是输入中间态，等失焦时再收敛；完整合法的整数立即提交
    if (value.trim() !== '' && Number.isInteger(parsedCount)) {
      const normalizedCount = Math.min(Math.max(1, parsedCount), upperBound);
      onCountChange(normalizedCount);
    }
  }

  const saveStatusText = isSaving
    ? '正在保存…'
    : saveFailed
      ? '尚未保存'
      : isAnimating
        ? '结果准备中'
        : '已保存';

  return (
    <section className="draw-controls" aria-labelledby="draw-controls-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">课堂操作</p>
          <h2 id="draw-controls-title">准备抽取</h2>
        </div>
        <span
          className="control-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label="名单保存状态"
        >
          {saveStatusText}
        </span>
      </div>

      <div className="count-control">
        <label htmlFor="draw-count">抽取人数</label>
        <div className="stepper">
          <button
            className="step-button"
            type="button"
            aria-label="减少抽取人数"
            disabled={controlsDisabled || safeCount <= 1}
            onClick={() => changeCount(safeCount - 1)}
          >
            −
          </button>
          <input
            id="draw-count"
            name="draw-count"
            type="number"
            inputMode="numeric"
            min={1}
            max={upperBound}
            value={displayCount}
            disabled={controlsDisabled || !hasCandidates}
            onChange={(event) => handleCountInput(event.target.value)}
            onBlur={() => setCountDraft(null)}
          />
          <button
            className="step-button"
            type="button"
            aria-label="增加抽取人数"
            disabled={controlsDisabled || safeCount >= upperBound}
            onClick={() => changeCount(safeCount + 1)}
          >
            +
          </button>
        </div>
        <p className="control-hint">
          {allowDuplicates
            ? `可重复抽取模式（有效总数 ${maxCount} 人）`
            : `最多可抽取 ${maxCount} 人`}
        </p>
      </div>

      <div className="controls-switches">
        <label className="switch-row">
          <input
            type="checkbox"
            aria-label="允许重复抽取"
            checked={allowDuplicates}
            disabled={controlsDisabled}
            onChange={(event) => onAllowDuplicatesChange?.(event.target.checked)}
          />
          <span>
            <strong>允许重复抽取</strong>
            <small>已抽中的同学仍可再次被抽中（单次抽取多人时互不重复）。</small>
          </span>
        </label>

        <label className="switch-row">
          <input
            type="checkbox"
            aria-label="显示抽取动画"
            checked={animationEnabled}
            disabled={controlsDisabled}
            onChange={(event) => onAnimationChange(event.target.checked)}
          />
          <span>
            <strong>显示抽取动画</strong>
            <small>快速滚动翻转人名，更具课堂悬念与期待感。</small>
          </span>
        </label>
      </div>

      <div className="draw-actions">
        <button
          className="primary-button draw-button"
          type="button"
          disabled={controlsDisabled || !hasCandidates}
          aria-busy={isAnimating || isSaving}
          onClick={() => onDraw(safeCount, animationEnabled)}
        >
          {isAnimating ? '正在抽取…' : '开始抽取'}
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={controlsDisabled || !hasRoster}
          onClick={onResetRound}
        >
          重置本轮
        </button>
        {saveFailed ? (
          // 保存失败后唯一可用的写操作：重试保存当前快照
          <button
            className="secondary-button retry-save-button"
            type="button"
            onClick={() => onRetrySave?.()}
          >
            重试保存
          </button>
        ) : null}
      </div>
    </section>
  );
}
