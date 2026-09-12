import { useEffect, useRef } from 'react';
import {
  DEFAULT_FULLSCREEN_DISPLAY_MS,
  MIN_FULLSCREEN_DISPLAY_MS,
  type StudentRecord,
} from '../../shared/types';

export interface FullscreenResultOverlayProps {
  /** 是否显示全屏结果弹层 */
  isOpen: boolean;
  /** 抽中的学生列表 */
  students: StudentRecord[];
  /** 展示持续时间（毫秒），默认 3 秒，可在设置中调整 */
  durationMs?: number;
  /** 是否正在滚动抽选中（用于全屏聚焦轮播模式） */
  isRolling?: boolean;
  /** 滚动中临时显示的学生名字列表（对应抽取人数） */
  rollingNames?: string[];
  /** 关闭回调 */
  onClose: () => void;
}

/**
 * 抽取结果全屏沉浸式展示组件
 * 抽取完成后按设置的全屏停留时长展示结果，增强课堂点名的仪式感与大屏可见度。
 */
export function FullscreenResultOverlay({
  isOpen,
  students,
  durationMs = DEFAULT_FULLSCREEN_DISPLAY_MS,
  isRolling = false,
  rollingNames = [],
  onClose,
}: FullscreenResultOverlayProps) {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // 如果当前处于滚动动画阶段，不启动自动关闭计时器
    if (isRolling) {
      return;
    }

    // 抽取结果定格后，按设置的停留时长自动关闭
    const closeDelay = Math.max(MIN_FULLSCREEN_DISPLAY_MS, durationMs);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onClose();
    }, closeDelay);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOpen, isRolling, durationMs, onClose]);

  if (!isOpen) {
    return null;
  }

  // 决定当前展示的名字列表
  const displayNames: string[] = isRolling
    ? rollingNames.length > 0
      ? rollingNames
      : ['抽取中…']
    : students.map((s) => s.name);

  const displaySeconds = Number(
    (Math.max(MIN_FULLSCREEN_DISPLAY_MS, durationMs) / 1000).toFixed(1),
  );

  return (
    <div
      className="fullscreen-result-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="抽取结果全屏展示"
      onClick={onClose}
    >
      <div
        className={`fullscreen-result-container ${isRolling ? 'is-rolling' : 'is-settled'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fullscreen-badge">
          {isRolling ? '🎯 幸运儿正在产生…' : '🎉 本次中签'}
        </div>

        <div className="fullscreen-names-grid" data-count={displayNames.length}>
          {displayNames.map((name, index) => (
            <div key={`${name}-${index}`} className="fullscreen-name-card">
              <span className="fullscreen-name-text">{name}</span>
            </div>
          ))}
        </div>

        <p className="fullscreen-tip">
          {isRolling ? '请屏息以待…' : `点击任意处或等待 ${displaySeconds} 秒自动关闭`}
        </p>
      </div>
    </div>
  );
}
