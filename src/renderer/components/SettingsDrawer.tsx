import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_FULLSCREEN_DISPLAY_MS,
  MAX_ANIMATION_DURATION_MS,
  MAX_FULLSCREEN_DISPLAY_MS,
  MIN_FULLSCREEN_DISPLAY_MS,
  type AnimationStyle,
  type DrawHistoryItem,
  type StudentRecord,
  type Theme,
} from '../../shared/types';
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
  /** 抽取结果全屏停留时长（毫秒） */
  fullscreenDisplayMs?: number;
  onFullscreenDisplayChange?: (durationMs: number) => void;
  theme?: Theme;
  onThemeChange?: (theme: Theme) => void;
  /** 清除本机保存的名单、权重与历史；由上层负责调用主进程并更新界面 */
  onClearLocalData?: () => void | Promise<void>;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute('aria-hidden'));
}

/** 把任意输入收敛到 0 - MAX_ANIMATION_DURATION_MS 的整数毫秒 */
function clampAnimationDuration(rawValue: string): number {
  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.min(Math.max(0, Math.round(parsedValue)), MAX_ANIMATION_DURATION_MS);
}

/** 把任意输入收敛到 MIN - MAX 毫秒的整数，避免写出越界停留时长 */
function clampFullscreenDisplay(rawValue: string): number {
  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_FULLSCREEN_DISPLAY_MS;
  }

  return Math.min(
    Math.max(MIN_FULLSCREEN_DISPLAY_MS, Math.round(parsedValue)),
    MAX_FULLSCREEN_DISPLAY_MS,
  );
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
  fullscreenDisplayMs = DEFAULT_FULLSCREEN_DISPLAY_MS,
  onFullscreenDisplayChange,
  theme = 'light',
  onThemeChange,
  onClearLocalData,
}: SettingsDrawerProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const cancelClearButtonRef = useRef<HTMLButtonElement>(null);
  const isClearConfirmOpenRef = useRef(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    isClearConfirmOpenRef.current = isClearConfirmOpen;
  }, [isClearConfirmOpen]);

  // 二次确认弹出后，把焦点交给“取消”，避免误触破坏性操作
  useEffect(() => {
    if (isClearConfirmOpen) {
      cancelClearButtonRef.current?.focus();
    }
  }, [isClearConfirmOpen]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      previousActiveElementRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    closeButtonRef.current?.focus();

    function handleDocumentKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        // 确认框打开时优先关闭确认框，而不是整个设置抽屉
        if (isClearConfirmOpenRef.current) {
          setIsClearConfirmOpen(false);
          return;
        }
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

  async function handleConfirmClear(): Promise<void> {
    setIsClearConfirmOpen(false);
    await onClearLocalData?.();
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
              <label htmlFor="animation-duration-input">动画时长（毫秒）</label>
              <input
                id="animation-duration-input"
                className="settings-input"
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_ANIMATION_DURATION_MS}
                step={100}
                value={animationDurationMs}
                disabled={disabled}
                onChange={(e) => onAnimationDurationChange?.(clampAnimationDuration(e.target.value))}
              />
              <small className="settings-field-hint">
                支持 0 - {MAX_ANIMATION_DURATION_MS} 毫秒，数值越大悬念越强。
              </small>
            </div>

            <div className="settings-field">
              <label htmlFor="fullscreen-duration-input">结果全屏停留时长（毫秒）</label>
              <input
                id="fullscreen-duration-input"
                className="settings-input"
                type="number"
                inputMode="numeric"
                min={MIN_FULLSCREEN_DISPLAY_MS}
                max={MAX_FULLSCREEN_DISPLAY_MS}
                step={500}
                value={fullscreenDisplayMs}
                disabled={disabled}
                onChange={(e) =>
                  onFullscreenDisplayChange?.(clampFullscreenDisplay(e.target.value))
                }
              />
              <small className="settings-field-hint">
                抽取结果自动全屏展示的时长，默认{' '}
                {DEFAULT_FULLSCREEN_DISPLAY_MS / 1000} 秒；支持 {MIN_FULLSCREEN_DISPLAY_MS} -{' '}
                {MAX_FULLSCREEN_DISPLAY_MS} 毫秒。
              </small>
            </div>

            <div className="settings-field">
              <label htmlFor="theme-select">界面主题</label>
              <select
                id="theme-select"
                className="settings-select"
                value={theme}
                disabled={disabled}
                onChange={(e) => onThemeChange?.(e.target.value as Theme)}
              >
                <option value="light">明亮模式</option>
                <option value="dark">深色模式</option>
              </select>
              <small className="settings-field-hint">
                {theme === 'light' && '明亮的课堂投影配色，适合白天与常规教室。'}
                {theme === 'dark' && '深色低眩光配色，适合暗光教室与长时间投屏。'}
              </small>
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

          {/* 本机数据管理区域 */}
          <section className="settings-group settings-group--danger" aria-labelledby="local-data-title">
            <h3 id="local-data-title" className="settings-group-title">
              本机数据
            </h3>
            <p className="settings-group-hint">
              名单、权重和抽取历史只保存在本机，清除后无法恢复。
            </p>
            <button
              type="button"
              className="danger-button settings-clear-button"
              disabled={disabled}
              onClick={() => setIsClearConfirmOpen(true)}
            >
              清除本机数据
            </button>
          </section>
        </div>
      </aside>

      {isClearConfirmOpen ? (
        <div className="confirm-overlay">
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label="确认清除本机数据"
          >
            <h4 className="confirm-dialog__title">确认清除本机数据</h4>
            <p className="confirm-dialog__description">
              将删除本机保存的名单、权重和抽取历史，操作无法撤销。
            </p>
            <div className="confirm-dialog__actions">
              <button
                ref={cancelClearButtonRef}
                type="button"
                className="secondary-button"
                onClick={() => setIsClearConfirmOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => void handleConfirmClear()}
              >
                确认清除本机数据
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
