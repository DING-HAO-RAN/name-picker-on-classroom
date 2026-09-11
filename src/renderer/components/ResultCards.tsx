import type { StudentRecord } from '../../shared/types';

export interface ResultCardsProps {
  students: StudentRecord[];
  isAnimating: boolean;
}

export function ResultCards({ students, isAnimating }: ResultCardsProps) {
  if (isAnimating) {
    return (
      <section className="result-section result-section--waiting" aria-live="polite">
        <p className="result-waiting" role="status">
          正在整理抽取结果…
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
          <li className="result-card" key={student.id}>
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
