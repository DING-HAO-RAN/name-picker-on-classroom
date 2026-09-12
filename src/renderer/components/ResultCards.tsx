import type { AnimationStyle, StudentRecord } from '../../shared/types';

export interface ResultCardsProps {
  students: StudentRecord[];
  isAnimating: boolean;
  animationStyle?: AnimationStyle;
  rollingNames?: string[];
}

export function ResultCards({
  students,
  isAnimating,
  animationStyle = 'slot',
  rollingNames = [],
}: ResultCardsProps) {
  // 正在执行抽取动画
  if (isAnimating) {
    // 模式一：大卡片动态滚动
    if (animationStyle === 'slot' && rollingNames.length > 0) {
      return (
        <section className="result-section result-section--rolling" aria-live="polite">
          <div className="section-heading">
            <div>
              <p className="section-kicker">正在滚动抽取</p>
              <h2 id="result-title">抽取中…</h2>
            </div>
            <span className="result-count">{rollingNames.length} 人</span>
          </div>
          <ul className="result-card-list" aria-label="正在滚动的候选人">
            {rollingNames.map((name, index) => (
              <li className="result-card result-card--rolling" key={`rolling-${index}`}>
                <span className="result-card-mark result-card-mark--rolling" aria-hidden="true">
                  🎲
                </span>
                <span className="result-card-name slot-roll-text">{name}</span>
              </li>
            ))}
          </ul>
        </section>
      );
    }

    // 其他动画模式进行中的状态提示
    return (
      <section className="result-section result-section--waiting" aria-live="polite">
        <p className="result-waiting" role="status">
          {animationStyle === 'marquee' ? '跑马灯定位中，正在锁定目标…' : '正在整理抽取结果…'}
        </p>
      </section>
    );
  }

  if (students.length === 0) {
    return null;
  }

  return (
    <section className="result-section" aria-labelledby="result-title" aria-live="polite">
      <div className="section-heading">
        <div>
          <p className="section-kicker">刚刚完成</p>
          <h2 id="result-title">本次抽取结果</h2>
        </div>
        <span className="result-count">{students.length} 人</span>
      </div>
      <ul className="result-card-list" aria-label="本次抽取的学生">
        {students.map((student) => (
          <li className="result-card" key={student.id} data-student-id={student.id}>
            <span className="result-card-mark" aria-hidden="true">
              ✓
            </span>
            <span className="result-card-name">{student.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
