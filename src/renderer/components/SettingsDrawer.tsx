import { useEffect, useRef } from 'react';
import type { AnimationStyle, DrawHistoryItem, StudentRecord } from '../../shared/types';
import { HistoryPanel } from './HistoryPanel';
import { StudentWeightList } from './StudentWeightList';

export interface SettingsDrawerProps {
  students: StudentRecord[];
  onWeightChange: (id: string, weight: number) => void;
  onResetWeights: () => void;
  onClose: () => void;
  history?: DrawHistoryItem[];
  onClearHistory?: () => void;
  disabled?: boolean;
  animationStyle?: AnimationStyle;
  onAnimationStyleChange?: (style: AnimationStyle) => void;
  animationDurationMs?: number;
  onAnimationDurationChange?: (duration: number) => void;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute('aria-hidden'));
}

export function SettingsDrawer({
  students,
  onWeightChange,
  onResetWeights,
  onClose,
  history = [],
  onClearHistory = () => undefined,
  disabled = false,
  animationStyle = 'slot',
  onAnimationStyleChange,
  animationDurationMs = 1800,
  onAnimationDurationChange,
}: SettingsDrawerProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      previousActiveElementRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    closeButtonRef.current?.focus();

    function handleDocumentKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      }
    }

    document.addEventListener('keydown', handleDocumentKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDocumentKeyDown);
      const previousElement = previousActiveElementRef.current;
      if (previousElement && document.contains(previousElement)) {
        previousElement.focus();
      }
    };
  }, []);

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLElement>): void {
    if (event.key !== 'Tab' || !dialogRef.current) {
      return;
    }

    const focusableElements = getFocusableElements(dialogRef.current);
    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  return (
    <div className="settings-drawer" data-testid="settings-drawer">
      <div
        className="settings-drawer__backdrop"
        data-testid="settings-drawer-backdrop"
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        ref={dialogRef}
        className="settings-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-drawer-title"
        onKeyDown={handleDialogKeyDown}
      >
        <div className="settings-drawer__header">
          <div>
            <p className="section-kicker">课堂设置</p>
            <h2 id="settings-drawer-title">设置</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="settings-drawer__close secondary-button"
            aria-label="关闭设置"
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        <div className="settings-drawer__content">
          {/* 动画效果设置区域 */}
          <section className="settings-group" aria-labelledby="animation-settings-title">
            <h3 id="animation-settings-title" className="settings-group-title">
              抽取动画效果
            </h3>
            <div className="settings-field">
              <label htmlFor="animation-style-select">动画样式</label>
              <select
                id="animation-style-select"
                className="settings-select"
                value={animationStyle}
                disabled={disabled}
                onChange={(e) => onAnimationStyleChange?.(e.target.value as AnimationStyle)}
              >
                <option value="slot">大卡片动态滚动（默认推荐）</option>
                <option value="marquee">学生列表跳跃跑马灯</option>
                <option value="spotlight">全屏聚焦弹窗轮播</option>
              </select>
              <small className="settings-field-hint">
                {animationStyle === 'slot' && '卡片区快速翻滚名字，平滑减速定格，大屏视觉冲击力强。'}
                {animationStyle === 'marquee' && '名单卡片高速轮巡高亮跳动，锁定抽中同学。'}
                {animationStyle === 'spotlight' && '自动居中大屏弹窗飞速轮换人名，气场拉满。'}
              </small>
            </div>

            <div className="settings-field">
              <label htmlFor="animation-duration-select">动画时长</label>
              <select
                id="animation-duration-select"
                className="settings-select"
                value={animationDurationMs}
                disabled={disabled}
                onChange={(e) => onAnimationDurationChange?.(Number(e.target.value))}
              >
                <option value={1200}>快速（1.2 秒）</option>
                <option value={1800}>标准（1.8 秒）</option>
                <option value={2800}>悬念（2.8 秒）</option>
              </select>
            </div>
          </section>

          <StudentWeightList
            students={students}
            onWeightChange={onWeightChange}
            disabled={disabled}
          />
          <button
            type="button"
            className="secondary-button settings-reset-button"
            disabled={disabled || students.length === 0}
            onClick={onResetWeights}
          >
            恢复默认权重
          </button>
          <HistoryPanel
            history={history}
            disabled={disabled}
            onClearHistory={onClearHistory}
          />
        </div>
      </aside>
    </div>
  );
}
