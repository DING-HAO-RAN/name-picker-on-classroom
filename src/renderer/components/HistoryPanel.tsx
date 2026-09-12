import { useEffect, useRef, useState } from 'react';
import { MAX_HISTORY_ITEMS } from '../../shared/types';
import type { DrawHistoryItem } from '../../shared/types';

export interface HistoryPanelProps {
  history: DrawHistoryItem[];
  onClearHistory: () => void;
  disabled?: boolean;
  /** 是否默认展开；默认折叠，避免设置面板一开始就堆满记录 */
  defaultExpanded?: boolean;
}

export { MAX_HISTORY_ITEMS };

function formatDrawTime(drawnAt: string): string {
  const date = new Date(drawnAt);
  if (Number.isNaN(date.getTime())) {
    return '时间未知';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function HistoryPanel({
  history,
  onClearHistory,
  disabled = false,
  defaultExpanded = false,
}: HistoryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const visibleHistory = history.slice(0, MAX_HISTORY_ITEMS);

  useEffect(() => {
    if (isConfirmingClear) {
      cancelButtonRef.current?.focus();
    }
  }, [isConfirmingClear]);

  useEffect(() => {
    if (history.length === 0) {
      setIsConfirmingClear(false);
    }
  }, [history.length]);

  function requestClear(): void {
    if (disabled || visibleHistory.length === 0) {
      return;
    }
    setIsConfirmingClear(true);
  }

  function confirmClear(): void {
    setIsConfirmingClear(false);
    onClearHistory();
  }

  return (
    <section className="history-panel" aria-labelledby="history-panel-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">课堂记录</p>
          <h3 id="history-panel-title">
            <button
              type="button"
              className="settings-collapse-toggle"
              aria-expanded={isExpanded}
              onClick={() => setIsExpanded((expanded) => !expanded)}
            >
              <span className="settings-collapse-caret" aria-hidden="true">
                {isExpanded ? '▾' : '▸'}
              </span>
              最近抽取
            </button>
          </h3>
        </div>
        <span className="settings-count">{visibleHistory.length} 条</span>
      </div>

      {/* 折叠时整块内容不渲染，保持设置面板简洁 */}
      {isExpanded ? (
        <>
          {visibleHistory.length > 0 ? (
            <ol className="history-list" aria-label="抽取历史记录">
              {visibleHistory.map((item) => (
                <li className="history-item" key={item.id} data-history-id={item.id}>
                  <div className="history-item-heading">
                    <time dateTime={item.drawnAt}>{formatDrawTime(item.drawnAt)}</time>
                    <span>{item.studentNames.length} 人</span>
                  </div>
                  <p>{item.studentNames.length > 0 ? item.studentNames.join('、') : '未记录姓名'}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty-history-message" role="status">
              暂无抽取记录。
            </p>
          )}

          {!isConfirmingClear ? (
            <button
              type="button"
              className="secondary-button history-clear-button"
              disabled={disabled || visibleHistory.length === 0}
              onClick={requestClear}
            >
              清除历史记录
            </button>
          ) : (
            <div className="history-clear-confirm" role="alertdialog" aria-label="确认清除历史记录">
              <p>确定清除全部历史记录？</p>
              <div className="history-confirm-actions">
                <button
                  ref={cancelButtonRef}
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsConfirmingClear(false)}
                >
                  取消
                </button>
                <button type="button" className="primary-button" onClick={confirmClear}>
                  确认清除历史记录
                </button>
              </div>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
