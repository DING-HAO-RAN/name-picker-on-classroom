import type { StudentRecord } from './types';

export interface DrawResult {
  selected: StudentRecord[];
  updatedStudents: StudentRecord[];
  shortage: boolean;
  /** 本次抽取是否抽中了保底池人物（未启用保底时为 false） */
  hitPity: boolean;
}

export interface DrawOptions {
  allowDuplicates?: boolean;
  /** 保底池成员的学生 id；与 pityThreshold / pityCounter 配合生效 */
  pityStudentIds?: string[];
  /** 保底阈值：连续未抽中保底池人物达到该次数后，本次抽取必中保底池 */
  pityThreshold?: number;
  /** 当前连续未抽中保底池人物的次数 */
  pityCounter?: number;
  /** 星级过滤：只抽取这些星级的学生（开启「按星级抽取」时传入） */
  allowedStars?: number[];
}

export function validateWeight(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/** 判断学生是否属于保底池成员 */
function isPityMember(student: StudentRecord, pityIds: Set<string>): boolean {
  return pityIds.has(student.id);
}

export function drawStudents(
  students: StudentRecord[],
  count: number,
  random: () => number = Math.random,
  options?: DrawOptions,
): DrawResult {
  if (!Number.isInteger(count) || count <= 0) {
    throw new RangeError('抽取人数必须是正整数。');
  }

  const allowDuplicates = options?.allowDuplicates ?? false;
  // 星级过滤：启用时只保留所选星级的学生
  const allowedStars = options?.allowedStars;
  const allowedStarSet =
    allowedStars && allowedStars.length > 0 ? new Set(allowedStars) : null;
  const candidates = students
    .map((student, index) => ({ student, index }))
    .filter(
      ({ student }) =>
        (allowDuplicates || !student.drawnThisRound) &&
        validateWeight(student.weight) &&
        student.weight > 0 &&
        (allowedStarSet === null || allowedStarSet.has(student.star)),
    );
  const remaining = candidates.slice();
  const selected: StudentRecord[] = [];
  const selectedIndices = new Set<number>();

  const pityIds = new Set(options?.pityStudentIds ?? []);
  const pityThreshold = options?.pityThreshold;
  const pityCounter = options?.pityCounter ?? 0;
  const pityAvailable =
    pityIds.size > 0 &&
    typeof pityThreshold === 'number' &&
    pityThreshold > 0 &&
    remaining.some(({ student }) => isPityMember(student, pityIds));

  // 保底触发：连续未抽中保底池人物的次数已达阈值，且候选中还有保底池成员——
  // 先从保底池成员中按权重抽出一名，再按普通规则补足剩余名额
  if (pityAvailable && pityCounter >= (pityThreshold as number)) {
    const pityCandidates = remaining.filter(({ student }) => isPityMember(student, pityIds));
    const winnerIndex = pickWeightedIndex(
      pityCandidates.map(({ student }) => student),
      random,
    );
    const [winner] = pityCandidates.splice(winnerIndex, 1);
    selected.push({
      ...winner.student,
      drawnThisRound: allowDuplicates ? winner.student.drawnThisRound : true,
    });
    remaining.splice(
      remaining.findIndex(({ index }) => index === winner.index),
      1,
    );
    selectedIndices.add(winner.index);
  }

  while (selected.length < count && remaining.length > 0) {
    const winnerIndex = pickWeightedIndex(
      remaining.map(({ student }) => student),
      random,
    );
    const [winner] = remaining.splice(winnerIndex, 1);
    selected.push({
      ...winner.student,
      drawnThisRound: allowDuplicates ? winner.student.drawnThisRound : true,
    });
    selectedIndices.add(winner.index);
  }

  const updatedStudents = students.map((student, index) => ({
    ...student,
    drawnThisRound: allowDuplicates
      ? student.drawnThisRound
      : selectedIndices.has(index) || student.drawnThisRound,
  }));

  const hitPity =
    pityIds.size > 0 && selected.some((student) => isPityMember(student, pityIds));

  return {
    selected,
    updatedStudents,
    shortage: selected.length < count,
    hitPity,
  };
}

/** 按权重随机挑出一个下标：经典「按权重分段命中」算法，权重可为任意非负比例 */
function pickWeightedIndex(students: StudentRecord[], random: () => number): number {
  const maxWeight = students.reduce((maximum, student) => Math.max(maximum, student.weight), 0);
  const totalWeight = students.reduce((total, student) => total + student.weight / maxWeight, 0);
  if (totalWeight <= 0) {
    return students.length - 1;
  }

  const target = random() * totalWeight;
  let cumulativeWeight = 0;
  for (let index = 0; index < students.length; index += 1) {
    cumulativeWeight += students[index].weight / maxWeight;
    if (target < cumulativeWeight) {
      return index;
    }
  }
  return students.length - 1;
}

export function resetRound(students: StudentRecord[]): StudentRecord[] {
  return students.map((student) => ({ ...student, drawnThisRound: false }));
}
