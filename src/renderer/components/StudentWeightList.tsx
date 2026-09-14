import { useEffect, useMemo, useRef, useState } from 'react';
import type { WeightPreset } from '../../shared/types';
import { MAX_WEIGHT_PERCENT } from '../../shared/types';
import type { StudentRecord } from '../../shared/types';

export interface StudentWeightListProps {
  students: StudentRecord[];
  /** 提交权重：percent 为 0-100 的百分比（内部换算为 0-1 存储） */
  onWeightChange: (id: string, weight: number) => void;
  disabled?: boolean;
  /** 是否默认展开；默认折叠，避免设置面板一开始就堆满名单 */
  defaultExpanded?: boolean;
  /** 权重预设列表 */
  weightPresets?: WeightPreset[];
  /** 套用指定预设 */
  onApplyWeightPreset?: (name: string) => void;
  /** 删除指定预设 */
  onDeleteWeightPreset?: (name: string) => void;
  /** 保存当前权重分配为预设 */
  onSaveWeightPreset?: (name: string) => void;
  /** 提交学生星级（1-5） */
  onStarChange?: (id: string, star: number) => void;
}

const INVALID_WEIGHT_MESSAGE = '权重格式无效：请输入 0-100 的数字，支持一位小数，例如 35 或 12.5。';
// 权重草稿格式：只允许数字和至多一个小数点，兼容「3」「35.」「12.5」等输入中间态
const WEIGHT_DRAFT_PATTERN = /^\d{0,3}(\.\d*)?$/;

/** 把界面百分比换算成内部权重（0-1） */
function percentToWeight(percent: number): number {
  const clamped = Math.min(Math.max(percent, 0), MAX_WEIGHT_PERCENT);
  return clamped / MAX_WEIGHT_PERCENT;
}

/** 把内部权重换算成界面百分比 */
function weightToPercent(weight: number): number {
  return Math.round(Math.min(Math.max(weight, 0), 1) * MAX_WEIGHT_PERCENT * 10) / 10;
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
  weightPresets,
  onApplyWeightPreset,
  onDeleteWeightPreset,
  onSaveWeightPreset,
  onStarChange,
}: StudentWeightListProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [searchQuery, setSearchQuery] = useState('');
  // 权重输入的纯草稿态：输入过程只保留原文（百分比），失焦或回车时一次性收敛提交，
  // 输入过程中不触发任何状态刷新，保证可以连续输入
  const [draftWeights, setDraftWeights] = useState<Record<string, string>>(() =>
    Object.fromEntries(students.map((student) => [student.id, String(weightToPercent(student.weight))])),
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
        // 只有外部权重真的变化时才刷新草稿，输入中的草稿不会被中途打断
        nextWeights[student.id] = studentChanged
          ? String(weightToPercent(student.weight))
          : currentWeights[student.id] ?? String(weightToPercent(student.weight));
      });
      return nextWeights;
    });
    previousStudentsRef.current = students;
  }, [students]);

  /** 把某学生的草稿收敛提交：0-100 百分比，空串视为放弃修改 */
  function commitWeightDraft(student: StudentRecord): void {
    const rawValue = draftWeights[student.id];
    if (rawValue === undefined) {
      return;
    }
    const trimmedValue = rawValue.trim();
    setDraftWeights((currentWeights) => ({ ...currentWeights, [student.id]: '' }));
    setValidationErrors((currentErrors) => {
      if (!currentErrors[student.id]) {
        return currentErrors;
      }
      const nextErrors = { ...currentErrors };
      delete nextErrors[student.id];
      return nextErrors;
    });
    if (trimmedValue === '') {
      return;
    }
    if (!WEIGHT_DRAFT_PATTERN.test(trimmedValue)) {
      setValidationErrors((currentErrors) => ({
        ...currentErrors,
        [student.id]: INVALID_WEIGHT_MESSAGE,
      }));
      return;
    }
    const parsedPercent = Number(trimmedValue);
    if (!Number.isFinite(parsedPercent) || parsedPercent < 0 || parsedPercent > MAX_WEIGHT_PERCENT) {
      setValidationErrors((currentErrors) => ({
        ...currentErrors,
        [student.id]: INVALID_WEIGHT_MESSAGE,
      }));
      return;
    }
    onWeightChange(student.id, percentToWeight(parsedPercent));
  }

  /** 滑动条实时设置权重（拖动本身即连续意图，直接提交） */
  function handleSliderChange(student: StudentRecord, percent: number): void {
    setDraftWeights((currentWeights) => ({ ...currentWeights, [student.id]: '' }));
    onWeightChange(student.id, percentToWeight(percent));
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
          <p className="settings-group-hint">
            权重以百分比表示：100 代表标准概率，数字越大越容易被抽中，0 表示暂不参与抽取。
          </p>

          {weightPresets && weightPresets.length > 0 ? (
            <div className="weight-preset-inline">
              <label className="settings-search-label" htmlFor="weight-preset-quick">
                套用权重预设
              </label>
              <select
                id="weight-preset-quick"
                className="settings-select"
                disabled={disabled}
                value=""
                onChange={(event) => {
                  if (event.target.value) {
                    onApplyWeightPreset?.(event.target.value);
                  }
                  event.target.value = '';
                }}
              >
                <option value="" disabled>
                  选择要套用的预设
                </option>
                {weightPresets.map((preset) => (
                  <option key={preset.name} value={preset.name}>
                    {preset.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="secondary-button weight-preset-delete"
                disabled={disabled}
                onClick={() => {
                  const select = document.getElementById(
                    'weight-preset-quick',
                  ) as HTMLSelectElement | null;
                  if (select?.value) {
                    onDeleteWeightPreset?.(select.value);
                  }
                }}
              >
                删除所选预设
              </button>
            </div>
          ) : null}

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
                const sliderId = `student-weight-slider-${student.id}`;
                const inputId = `student-weight-${student.id}`;
                const errorId = `${inputId}-error`;
                const hasError = Boolean(validationErrors[student.id]);
                // 滑条实时跟随已提交的权重；文本草稿存在时互不打扰
                const sliderPercent = weightToPercent(student.weight);
                // 草稿可解析时按草稿值显示状态（如输入 0 立即提示暂不参与）
                const rawDraft = draftWeights[student.id]?.trim();
                const draftPercent =
                  rawDraft && WEIGHT_DRAFT_PATTERN.test(rawDraft) ? Number(rawDraft) : undefined;
                const shownPercent = draftPercent ?? sliderPercent;
                return (
                  <li className="student-weight-item" key={student.id} data-student-id={student.id}>
                    <div className="student-weight-name">
                      <span>{student.name}</span>
                      {duplicateNames.has(student.name) ? (
                        <small className="duplicate-name-label">同名</small>
                      ) : null}
                    </div>
                    <div className="student-weight-editor">
                      {/* 星级：1-5 星，决定抽卡卡面颜色（白/蓝/紫/红/金）；累计抽中 5 次自动升星（上限 4 星） */}
                      <label htmlFor={`student-star-${student.id}`} className="visually-hidden">
                        {student.name}星级
                      </label>
                      <select
                        id={`student-star-${student.id}`}
                        className={`student-star-select student-star-select--${student.star}`}
                        value={student.star}
                        disabled={disabled}
                        aria-label={`${student.name}星级`}
                        onChange={(event) =>
                          onStarChange?.(student.id, Number(event.target.value))
                        }
                      >
                        <option value="1">1★ 白</option>
                        <option value="2">2★ 蓝</option>
                        <option value="3">3★ 紫</option>
                        <option value="4">4★ 红</option>
                        <option value="5">5★ 金</option>
                      </select>
                      {/* 滑条：拖动即设置，与文本框联动 */}
                      <label htmlFor={sliderId} className="visually-hidden">
                        {student.name}权重滑动条（百分比）
                      </label>
                      <input
                        id={sliderId}
                        className="student-weight-slider"
                        type="range"
                        min={0}
                        max={MAX_WEIGHT_PERCENT}
                        step={0.5}
                        value={sliderPercent}
                        disabled={disabled}
                        aria-valuetext={`${sliderPercent}%`}
                        onChange={(event) =>
                          handleSliderChange(student, Number(event.target.value))
                        }
                      />
                      <label htmlFor={inputId} className="visually-hidden">
                        {student.name}权重（百分比）
                      </label>
                      <input
                        id={inputId}
                        className="student-weight-input"
                        type="text"
                        inputMode="decimal"
                        aria-label={`${student.name}权重百分比`}
                        aria-invalid={hasError}
                        aria-describedby={hasError ? errorId : undefined}
                        value={draftWeights[student.id] ?? String(weightToPercent(student.weight))}
                        disabled={disabled}
                        placeholder="0-100"
                        onChange={(event) =>
                          setDraftWeights((currentWeights) => ({
                            ...currentWeights,
                            [student.id]: event.target.value,
                          }))
                        }
                        onBlur={() => commitWeightDraft(student)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            commitWeightDraft(student);
                          }
                        }}
                      />
                      <span className="student-weight-unit">%</span>
                      {shownPercent === 0 && !hasError ? (
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
