import { useEffect, useRef } from 'react';
import type { StudentRecord } from '../../shared/types';

export interface FullscreenResultOverlayProps {
  /** 是否显示全屏结果弹层 */
  isOpen: boolean;
  /** 抽中的学生列表 */
  students: StudentRecord[];
  /** 展示持续时间（毫秒），默认 1000ms */
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
 * 无论是否开启动画，抽取完成后默认全屏放大展示结果 1 秒，增强课堂点名的仪式感与大屏可见度。
 */
export function FullscreenResultOverlay({
  isOpen,
  students,
  durationMs = 1000,
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

    // 抽取结果定格后，倒计时指定时间（默认1秒）自动关闭
    const closeDelay = Math.max(500, durationMs);
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
          {isRolling ? '请屏息以待…' : '点击任意处或等待 1 秒自动关闭'}
        </p>
      </div>
    </div>
  );
}
