import type { StudentRecord } from './types';

export interface DrawResult {
  selected: StudentRecord[];
  updatedStudents: StudentRecord[];
  shortage: boolean;
}

export function validateWeight(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function drawStudents(
  students: StudentRecord[],
  count: number,
  random: () => number = Math.random,
): DrawResult {
  const candidates = students
    .map((student, index) => ({ student, index }))
    .filter(
      ({ student }) =>
        !student.drawnThisRound && validateWeight(student.weight) && student.weight > 0,
    );
  const remaining = candidates.slice();
  const selected: StudentRecord[] = [];
  const selectedIndices = new Set<number>();

  while (selected.length < count && remaining.length > 0) {
    const maxWeight = remaining.reduce(
      (maximum, { student }) => Math.max(maximum, student.weight),
      0,
    );
    const totalWeight = remaining.reduce(
      (total, { student }) => total + student.weight / maxWeight,
      0,
    );
    if (totalWeight <= 0) {
      break;
    }

    const target = random() * totalWeight;
    let cumulativeWeight = 0;
    let winnerIndex = remaining.length - 1;

    for (let index = 0; index < remaining.length; index += 1) {
      cumulativeWeight += remaining[index].student.weight / maxWeight;
      if (target < cumulativeWeight) {
        winnerIndex = index;
        break;
      }
    }

    const [winner] = remaining.splice(winnerIndex, 1);
    selected.push({ ...winner.student, drawnThisRound: true });
    selectedIndices.add(winner.index);
  }

  const updatedStudents = students.map((student, index) => ({
    ...student,
    drawnThisRound: selectedIndices.has(index) || student.drawnThisRound,
  }));

  return {
    selected,
    updatedStudents,
    shortage: selected.length < count,
  };
}

export function resetRound(students: StudentRecord[]): StudentRecord[] {
  return students.map((student) => ({ ...student, drawnThisRound: false }));
}
