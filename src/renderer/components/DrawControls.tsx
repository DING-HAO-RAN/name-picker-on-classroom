export interface DrawControlsProps {
  count: number;
  maxCount: number;
  hasRoster?: boolean;
  animationEnabled: boolean;
  disabled?: boolean;
  isAnimating?: boolean;
  onCountChange: (count: number) => void;
  onAnimationChange: (enabled: boolean) => void;
  onDraw: (count: number, animate: boolean) => void;
  onResetRound: () => void;
}

export function DrawControls({
  count,
  maxCount,
  hasRoster = maxCount > 0,
  animationEnabled,
  disabled = false,
  isAnimating = false,
  onCountChange,
  onAnimationChange,
  onDraw,
  onResetRound,
}: DrawControlsProps) {
  const hasCandidates = maxCount > 0;
  const upperBound = Math.max(1, maxCount);
  const safeCount = Math.min(Math.max(1, count), upperBound);
  const controlsDisabled = disabled || isAnimating;

  function changeCount(nextCount: number): void {
    if (!hasCandidates || controlsDisabled) {
      return;
    }

    const normalizedCount = Math.min(Math.max(1, Math.floor(nextCount)), upperBound);
    onCountChange(normalizedCount);
  }

  function handleInputChange(value: string): void {
    const nextCount = Number(value);
    if (Number.isFinite(nextCount)) {
      changeCount(nextCount);
    }
  }

  return (
    <section className="draw-controls" aria-labelledby="draw-controls-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">课堂操作</p>
          <h2 id="draw-controls-title">准备抽取</h2>
        </div>
        {isAnimating ? <span className="control-status">结果准备中</span> : null}
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
            value={safeCount}
            disabled={controlsDisabled || !hasCandidates}
            onChange={(event) => handleInputChange(event.target.value)}
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
        <p className="control-hint">最多可抽取 {maxCount} 人</p>
      </div>

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
          <small>让结果稍后出现，课堂节奏更有期待感。</small>
        </span>
      </label>

      <div className="draw-actions">
        <button
          className="primary-button draw-button"
          type="button"
          disabled={controlsDisabled || !hasCandidates}
          aria-busy={isAnimating}
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
      </div>
    </section>
  );
}
