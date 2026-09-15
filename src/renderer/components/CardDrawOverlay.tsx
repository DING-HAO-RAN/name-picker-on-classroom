import { useEffect, useRef, useState } from 'react';
import type { StudentRecord } from '../../shared/types';

/** 星级 -> 卡面主题（对应《原神》式稀有度配色：白/蓝/紫/红/金） */
export const STAR_THEME_CLASSES = [
  'card-draw__face--star1',
  'card-draw__face--star2',
  'card-draw__face--star3',
  'card-draw__face--star4',
  'card-draw__face--star5',
] as const;

export interface CardDrawOverlayProps {
  /** 本次抽中的学生（每张卡对应一人） */
  students: StudentRecord[];
  /** 本次抽取是否命中保底池（命中时卡片带保底光效） */
  hitPity: boolean;
  /** 全部卡片翻面后点击「收下结果」时触发 */
  onFinish: () => void;
}

/**
 * 抽卡式抽取动画：全屏舞台上摆出若干张背面朝上的卡牌，
 * 卡背与正面同为该学生星级的配色（翻面前只显示颜色），点击任意卡牌即翻转揭晓；
 * 全部翻开后可收下结果。
 */
export function CardDrawOverlay({ students, hitPity, onFinish }: CardDrawOverlayProps) {
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const overlayRef = useRef<HTMLDivElement>(null);

  // 打开时锁定焦点到舞台，Esc 不关闭（避免误触跳过揭晓）
  useEffect(() => {
    overlayRef.current?.focus();
  }, []);

  const allRevealed = revealed.size >= students.length && students.length > 0;

  function reveal(index: number): void {
    setRevealed((current) => {
      if (current.has(index)) {
        return current;
      }
      const next = new Set(current);
      next.add(index);
      return next;
    });
  }

  return (
    <div
      ref={overlayRef}
      className="card-draw"
      role="dialog"
      aria-modal="true"
      aria-label="抽卡结果揭晓"
      tabIndex={-1}
    >
      <p className="card-draw__title">{allRevealed ? '本次抽取结果' : '点击卡片，揭晓命运'}</p>

      <div className="card-draw__stage">
        {students.map((student, index) => {
          const isRevealed = revealed.has(index);
          const star = Math.min(Math.max(student.star, 1), 5);
          const isPityMember = hitPity && index === 0;
          const starThemeClass = STAR_THEME_CLASSES[star - 1];
          return (
            <button
              key={`${student.id}-${index}`}
              type="button"
              className={`card-draw__slot${isRevealed ? ' card-draw__slot--revealed' : ''}`}
              aria-label={isRevealed ? `${student.name}，${star} 星` : `第 ${index + 1} 张卡，点击翻面`}
              onClick={() => reveal(index)}
            >
              {/* 卡片容器：内层 3D 翻转；入场时从中央牌堆飞到位（deal-index 控制延迟） */}
              <span
                className="card-draw__flipper"
                style={{ '--deal-index': String(index) } as React.CSSProperties}
              >
                {/* 背面：与正面同星级配色（深色渐变变体），翻面前只显示颜色，不透露名字与星级 */}
                <span
                  className={`card-draw__face card-draw__face--back ${starThemeClass}${
                    isPityMember ? ' card-draw__face--pity' : ''
                  }`}
                >
                  <span className="card-draw__band" aria-hidden="true" />
                  <span className="card-draw__back-glow" aria-hidden="true" />
                  <span className="card-draw__back-mark" aria-hidden="true">✦</span>
                </span>
                {/* 正面：星级配色 + 名字 + 星星行（只按星星个数区分等级，不显示文字） */}
                <span
                  className={`card-draw__face card-draw__face--front ${starThemeClass}${
                    isPityMember ? ' card-draw__face--pity' : ''
                  }`}
                >
                  {isPityMember ? (
                    <span className="card-draw__pity-tag" aria-hidden="true">
                      保底
                    </span>
                  ) : null}
                  <span className="card-draw__band" aria-hidden="true" />
                  <span className="card-draw__name">{student.name}</span>
                  <span className="card-draw__stars" aria-hidden="true">
                    {Array.from({ length: star }, (_, starIndex) => (
                      <span
                        key={starIndex}
                        className="card-draw__star"
                        style={{ animationDelay: `${starIndex * 90}ms` }}
                      >
                        ★
                      </span>
                    ))}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {allRevealed ? (
        <button type="button" className="card-draw__finish" onClick={onFinish}>
          收下结果
        </button>
      ) : (
        <p className="card-draw__hint">
          还剩 {students.length - revealed.size} 张卡未翻开
        </p>
      )}
    </div>
  );
}
