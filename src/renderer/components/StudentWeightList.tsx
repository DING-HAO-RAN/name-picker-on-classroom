import { useEffect, useMemo, useRef, useState } from 'react';
import { validateWeight } from '../../shared/drawEngine';
import type { StudentRecord } from '../../shared/types';

export interface StudentWeightListProps {
  students: StudentRecord[];
  onWeightChange: (id: string, weight: number) => void;
  disabled?: boolean;
  /** 是否默认展开；默认折叠，避免设置面板一开始就堆满名单 */
  defaultExpanded?: boolean;
}

const INVALID_WEIGHT_MESSAGE = '权重格式无效：请输入非负数字，支持小数，例如 1.5。';
// 权重草稿格式：只允许数字和至多一个小数点，兼容「1.」「.5」等输入中间态
const WEIGHT_DRAFT_PATTERN = /^\d*(\.\d*)?$/;

function getInitialDraftWeights(students: StudentRecord[]): Record<string, string> {
  return Object.fromEntries(students.map((student) => [student.id, String(student.weight)]));
}

function getDuplicateNames(students: StudentRecord[]): Set<string> {
  const counts = new Map<string, number>();
  students.forEach((student) => {
    counts.set(student.name, (counts.get(student.name) ?? 0) + 1);
  });
  return new Set(
    Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([name]) => name),
  );
}

export function StudentWeightList({
  students,
  onWeightChange,
  disabled = false,
  defaultExpanded = false,
}: StudentWeightListProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftWeights, setDraftWeights] = useState<Record<string, string>>(() =>
    getInitialDraftWeights(students),
  );
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const previousStudentsRef = useRef(students);
  const duplicateNames = useMemo(() => getDuplicateNames(students), [students]);
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const visibleStudents = students.filter((student) =>
    student.name.toLocaleLowerCase().includes(normalizedQuery),
  );

  useEffect(() => {
    const previousStudents = new Map(
      previousStudentsRef.current.map((student) => [student.id, student]),
    );

    setDraftWeights((currentWeights) => {
      const nextWeights: Record<string, string> = {};
      students.forEach((student) => {
        const previousStudent = previousStudents.get(student.id);
        const studentChanged =
          previousStudent === undefined ||
          previousStudent.name !== student.name ||
          previousStudent.weight !== student.weight;
        nextWeights[student.id] = studentChanged
          ? String(student.weight)
          : currentWeights[student.id] ?? String(student.weight);
      });
      return nextWeights;
    });
    setValidationErrors((currentErrors) => {
      const nextErrors: Record<string, string> = {};
      students.forEach((student) => {
        const previousStudent = previousStudents.get(student.id);
        const studentChanged =
          previousStudent === undefined ||
          previousStudent.name !== student.name ||
          previousStudent.weight !== student.weight;
        if (!studentChanged && currentErrors[student.id]) {
          nextErrors[student.id] = currentErrors[student.id];
        }
      });
      return nextErrors;
    });
    previousStudentsRef.current = students;
  }, [students]);

  function handleWeightInput(student: StudentRecord, value: string): void {
    setDraftWeights((currentWeights) => ({
      ...currentWeights,
      [student.id]: value,
    }));

    const trimmedValue = value.trim();
    // 清空输入是中间态：不报错也不提交，等输入完成或失焦后恢复原值
    if (trimmedValue.length === 0) {
      clearWeightError(student.id);
      return;
    }

    // 格式确认：先做字符级校验（拒绝负号、字母、多个小数点），再做数值校验
    if (!WEIGHT_DRAFT_PATTERN.test(trimmedValue)) {
      setValidationErrors((currentErrors) => ({
        ...currentErrors,
        [student.id]: INVALID_WEIGHT_MESSAGE,
      }));
      return;
    }

    const parsedWeight = Number(trimmedValue);
    if (!Number.isFinite(parsedWeight) || !validateWeight(parsedWeight)) {
      setValidationErrors((currentErrors) => ({
        ...currentErrors,
        [student.id]: INVALID_WEIGHT_MESSAGE,
      }));
      return;
    }

    clearWeightError(student.id);
    onWeightChange(student.id, parsedWeight);
  }

  /** 清除指定学生的权重错误提示 */
  function clearWeightError(id: string): void {
    setValidationErrors((currentErrors) => {
      if (!currentErrors[id]) {
        return currentErrors;
      }
      const nextErrors = { ...currentErrors };
      delete nextErrors[id];
      return nextErrors;
    });
  }

  function getDraftWeight(student: StudentRecord): number {
    const value = draftWeights[student.id];
    if (value === undefined || value.trim().length === 0) {
      return student.weight;
    }
    const parsedWeight = Number(value);
    return validateWeight(parsedWeight) ? parsedWeight : student.weight;
  }

  return (
    <section className="student-weight-list" aria-labelledby="student-weight-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">抽取偏好</p>
          <h3 id="student-weight-title">
            <button
              type="button"
              className="settings-collapse-toggle"
              aria-expanded={isExpanded}
              onClick={() => setIsExpanded((expanded) => !expanded)}
            >
              <span className="settings-collapse-caret" aria-hidden="true">
                {isExpanded ? '▾' : '▸'}
              </span>
              学生权重
            </button>
          </h3>
        </div>
        <span className="settings-count">{students.length} 人</span>
      </div>

      {/* 折叠时整块内容不渲染：既保持面板简洁，也避免焦点落到不可见控件上 */}
      {isExpanded ? (
        <>
          <label className="settings-search-label" htmlFor="student-name-search">
            搜索学生姓名
          </label>
          <input
            id="student-name-search"
            className="settings-search-input"
            type="search"
            placeholder="输入姓名筛选"
            value={searchQuery}
            disabled={disabled}
            onChange={(event) => setSearchQuery(event.target.value)}
          />

          {duplicateNames.size > 0 ? (
            <p className="duplicate-name-hint" role="status">
              发现同名学生，请根据各行分别调整权重。
            </p>
          ) : null}

          <p className="settings-search-summary" aria-live="polite">
            显示 {visibleStudents.length} / {students.length} 名学生
          </p>

          {visibleStudents.length > 0 ? (
            <ul className="student-weight-items" aria-label="学生权重列表">
              {visibleStudents.map((student) => {
                const inputId = `student-weight-${student.id}`;
                const errorId = `${inputId}-error`;
                const currentWeight = getDraftWeight(student);
                const hasError = Boolean(validationErrors[student.id]);
                return (
                  <li className="student-weight-item" key={student.id} data-student-id={student.id}>
                    <div className="student-weight-name">
                      <span>{student.name}</span>
                      {duplicateNames.has(student.name) ? (
                        <small className="duplicate-name-label">同名</small>
                      ) : null}
                    </div>
                    <div className="student-weight-editor">
                      <label htmlFor={inputId} className="visually-hidden">
                        {student.name}权重
                      </label>
                      <input
                        id={inputId}
                        className="student-weight-input"
                        type="text"
                        inputMode="decimal"
                        aria-label={`${student.name}权重`}
                        aria-invalid={hasError}
                        aria-describedby={hasError ? errorId : undefined}
                        value={draftWeights[student.id] ?? String(student.weight)}
                        disabled={disabled}
                        placeholder="1 或 1.5"
                        onChange={(event) => handleWeightInput(student, event.target.value)}
                      />
                      {currentWeight === 0 && !hasError ? (
                        <small className="student-weight-status">暂不参与抽取</small>
                      ) : null}
                      {hasError ? (
                        <small id={errorId} className="student-weight-error" role="alert">
                          {validationErrors[student.id]}
                        </small>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty-search-message" role="status">
              没有找到匹配的学生。
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}
