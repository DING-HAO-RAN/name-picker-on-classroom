import { useCallback, useEffect, useRef, useState } from 'react';
import { drawStudents, resetRound, validateWeight } from '../shared/drawEngine';
import type { DrawHistoryItem, RosterState, StudentRecord } from '../shared/types';
import { ClassroomHeader } from './components/ClassroomHeader';
import { DrawControls } from './components/DrawControls';
import { ImportDropzone } from './components/ImportDropzone';
import { ResultCards } from './components/ResultCards';
import { SettingsDrawer } from './components/SettingsDrawer';
import { ToastMessage } from './components/ToastMessage';

const DEFAULT_SETTINGS = {
  animationEnabled: true,
  animationDurationMs: 800,
  theme: 'light' as const,
};
const MAX_HISTORY_ITEMS = 50;

function createHistoryId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `draw-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createHistoryItem(students: StudentRecord[]): DrawHistoryItem {
  return {
    id: createHistoryId(),
    drawnAt: new Date().toISOString(),
    studentNames: students.map((student) => student.name),
  };
}

function createEmptyState(): RosterState {
  return {
    sourceName: '',
    students: [],
    history: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

function getNamePickerApi(): Window['namePicker'] | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.namePicker ?? null;
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  return typeof error.code === 'string' ? error.code : undefined;
}

function hasValidRoster(state: RosterState): boolean {
  return state.sourceName.trim().length > 0 && state.students.length > 0;
}

function getAvailableStudentCount(students: StudentRecord[]): number {
  return students.filter(
    (student) => !student.drawnThisRound && Number.isFinite(student.weight) && student.weight > 0,
  ).length;
}

export function App() {
  const [roster, setRoster] = useState<RosterState>(createEmptyState);
  const [selectedCount, setSelectedCount] = useState(1);
  const [animationEnabled, setAnimationEnabled] = useState(DEFAULT_SETTINGS.animationEnabled);
  const [resultStudents, setResultStudents] = useState<StudentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
  const rosterRef = useRef(roster);
  const animationEnabledRef = useRef(animationEnabled);
  const saveQueueRef = useRef<Promise<void> | null>(null);
  const interactionLockRef = useRef(false);
  const animationTimerRef = useRef<number | null>(null);
  const disposedRef = useRef(false);

  const updateRoster = useCallback((nextState: RosterState): void => {
    rosterRef.current = nextState;
    setRoster(nextState);
  }, []);

  const updateAnimationEnabled = useCallback((enabled: boolean): void => {
    animationEnabledRef.current = enabled;
    setAnimationEnabled(enabled);
  }, []);

  const saveState = useCallback(async (nextState: RosterState): Promise<boolean> => {
    const api = getNamePickerApi();
    if (!api) {
      return true;
    }

    const performSave = async (): Promise<boolean> => {
      try {
        await api.saveState(nextState);
        return true;
      } catch {
        if (!disposedRef.current) {
          setErrorMessage('名单状态保存失败，请重试。');
        }
        return false;
      }
    };
    const queuedSave = saveQueueRef.current
      ? saveQueueRef.current.then(performSave)
      : performSave();
    saveQueueRef.current = queuedSave.then(
      () => undefined,
      () => undefined,
    );
    return queuedSave;
  }, []);

  const handleWeightChange = useCallback(
    (id: string, weight: number): void => {
      if (
        isLoading ||
        isImporting ||
        isAnimating ||
        !validateWeight(weight)
      ) {
        return;
      }

      const currentRoster = rosterRef.current;
      if (!currentRoster.students.some((student) => student.id === id)) {
        return;
      }

      const nextState: RosterState = {
        ...currentRoster,
        students: currentRoster.students.map((student) =>
          student.id === id ? { ...student, weight } : student,
        ),
      };
      updateRoster(nextState);
      void saveState(nextState);
    },
    [isAnimating, isImporting, isLoading, saveState, updateRoster],
  );

  const handleResetWeights = useCallback((): void => {
    if (isLoading || isImporting || isAnimating) {
      return;
    }

    const currentRoster = rosterRef.current;
    if (currentRoster.students.length === 0) {
      return;
    }

    const nextState: RosterState = {
      ...currentRoster,
      students: currentRoster.students.map((student) => ({ ...student, weight: 1 })),
    };
    updateRoster(nextState);
    void saveState(nextState);
  }, [isAnimating, isImporting, isLoading, saveState, updateRoster]);

  const handleClearHistory = useCallback((): void => {
    if (isLoading || isImporting || isAnimating) {
      return;
    }

    const currentRoster = rosterRef.current;
    if (currentRoster.history.length === 0) {
      return;
    }

    const nextState: RosterState = {
      ...currentRoster,
      history: [],
    };
    updateRoster(nextState);
    void saveState(nextState);
  }, [isAnimating, isImporting, isLoading, saveState, updateRoster]);

  useEffect(() => {
    disposedRef.current = false;
    let disposed = false;

    async function loadSavedState(): Promise<void> {
      const api = getNamePickerApi();
      if (!api) {
        if (!disposed) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const savedState = await api.loadState();
        if (disposed) {
          return;
        }

        if (savedState) {
          updateRoster(savedState);
          updateAnimationEnabled(savedState.settings.animationEnabled);
          setSelectedCount(1);
        }
      } catch {
        if (!disposed) {
          setErrorMessage('本地名单加载失败，请重试。');
        }
      } finally {
        if (!disposed) {
          setIsLoading(false);
        }
      }
    }

    void loadSavedState();

    return () => {
      disposed = true;
      disposedRef.current = true;
      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current);
      }
      interactionLockRef.current = false;
    };
  }, [updateAnimationEnabled, updateRoster]);

  const handleImport = useCallback(async (): Promise<void> => {
    const api = getNamePickerApi();
    if (
      !api ||
      isLoading ||
      isImporting ||
      isAnimating ||
      interactionLockRef.current
    ) {
      return;
    }

    interactionLockRef.current = true;
    setErrorMessage(null);
    setIsImporting(true);

    try {
      const importedRoster = await api.importRoster();
      const currentRoster = rosterRef.current;
      const nextState: RosterState = {
        sourceName: importedRoster.sourceName,
        students: importedRoster.students.map((student) => ({ ...student })),
        history: [],
        settings: {
          ...currentRoster.settings,
          animationEnabled: animationEnabledRef.current,
          theme: 'light',
        },
      };

      updateRoster(nextState);
      updateAnimationEnabled(nextState.settings.animationEnabled);
      setSelectedCount(1);
      setResultStudents([]);
      await saveState(nextState);
    } catch (error) {
      if (getErrorCode(error) === 'IMPORT_CANCELLED') {
        setErrorMessage('已取消导入。');
      } else {
        setErrorMessage('导入名单失败，请重试。');
      }
    } finally {
      interactionLockRef.current = false;
      setIsImporting(false);
    }
  }, [isAnimating, isImporting, isLoading, saveState, updateAnimationEnabled, updateRoster]);

  const handleAnimationChange = useCallback(
    (enabled: boolean): void => {
      if (isLoading || isImporting || isAnimating || interactionLockRef.current) {
        return;
      }

      interactionLockRef.current = true;
      updateAnimationEnabled(enabled);
      const currentRoster = rosterRef.current;
      const nextState: RosterState = {
        ...currentRoster,
        settings: {
          ...currentRoster.settings,
          animationEnabled: enabled,
        },
      };
      updateRoster(nextState);

      if (!hasValidRoster(nextState)) {
        interactionLockRef.current = false;
        return;
      }

      void saveState(nextState).finally(() => {
        interactionLockRef.current = false;
      });
    },
    [isAnimating, isImporting, isLoading, saveState, updateAnimationEnabled, updateRoster],
  );

  const handleDraw = useCallback(
    (count: number, animate: boolean): void => {
      const currentRoster = rosterRef.current;
      if (
        isLoading ||
        isImporting ||
        isAnimating ||
        interactionLockRef.current ||
        currentRoster.students.length === 0
      ) {
        return;
      }

      if (getAvailableStudentCount(currentRoster.students) === 0) {
        setErrorMessage('本轮没有可抽取的学生，请先重置本轮。');
        return;
      }

      interactionLockRef.current = true;
      setErrorMessage(null);
      const drawResult = drawStudents(currentRoster.students, count);
      const shouldAnimate = animate === animationEnabledRef.current
        ? animate
        : animationEnabledRef.current;
      const nextHistory = drawResult.selected.length > 0
        ? [createHistoryItem(drawResult.selected), ...currentRoster.history].slice(0, MAX_HISTORY_ITEMS)
        : currentRoster.history;
      const nextState: RosterState = {
        ...currentRoster,
        students: drawResult.updatedStudents,
        history: nextHistory,
        settings: {
          ...currentRoster.settings,
          animationEnabled: shouldAnimate,
        },
      };
      updateRoster(nextState);
      updateAnimationEnabled(shouldAnimate);

      let saveCompleted = false;
      let resultDisplayed = false;
      const releaseInteractionLock = (): void => {
        if (saveCompleted && resultDisplayed) {
          interactionLockRef.current = false;
        }
      };
      void saveState(nextState).then(
        () => {
          saveCompleted = true;
          releaseInteractionLock();
        },
        () => {
          saveCompleted = true;
          releaseInteractionLock();
        },
      );

      if (drawResult.shortage) {
        setErrorMessage(`仅抽到 ${drawResult.selected.length} 人，当前可抽取学生不足。`);
      }

      if (drawResult.selected.length === 0) {
        if (!drawResult.shortage) {
          setErrorMessage('本轮没有可抽取的学生，请先重置本轮。');
        }
        setResultStudents([]);
        resultDisplayed = true;
        releaseInteractionLock();
        return;
      }

      const duration = Math.max(0, nextState.settings.animationDurationMs);
      if (!shouldAnimate || duration === 0) {
        setResultStudents(drawResult.selected);
        setIsAnimating(false);
        resultDisplayed = true;
        releaseInteractionLock();
        return;
      }

      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current);
      }
      setIsAnimating(true);
      setResultStudents([]);
      animationTimerRef.current = window.setTimeout(() => {
        animationTimerRef.current = null;
        setResultStudents(drawResult.selected);
        setIsAnimating(false);
        resultDisplayed = true;
        releaseInteractionLock();
      }, duration);
    },
    [isAnimating, isImporting, isLoading, saveState, updateAnimationEnabled, updateRoster],
  );

  const handleResetRound = useCallback((): void => {
    const currentRoster = rosterRef.current;
    if (
      isLoading ||
      isImporting ||
      isAnimating ||
      interactionLockRef.current ||
      currentRoster.students.length === 0
    ) {
      return;
    }

    interactionLockRef.current = true;
    const nextState: RosterState = {
      ...currentRoster,
      students: resetRound(currentRoster.students),
    };
    updateRoster(nextState);
    setResultStudents([]);
    setErrorMessage(null);
    void saveState(nextState).then(
      () => {
        interactionLockRef.current = false;
      },
      () => {
        interactionLockRef.current = false;
      },
    );
  }, [isAnimating, isImporting, isLoading, saveState, updateRoster]);

  const hasRoster = roster.students.length > 0;
  const availableStudentCount = getAvailableStudentCount(roster.students);

  return (
    <main className="app-shell">
      <ClassroomHeader
        sourceName={roster.sourceName}
        studentCount={roster.students.length}
        onOpenSettings={() => setIsSettingsDrawerOpen(true)}
      />

      {isLoading ? (
        <p className="loading-message" role="status">
          正在加载名单…
        </p>
      ) : null}

      <div className="classroom-layout">
        <section className="classroom-main" aria-label="课堂名单和抽取结果">
          {!hasRoster ? (
            <ImportDropzone onImport={handleImport} isImporting={isImporting || isLoading} />
          ) : (
            <section className="roster-section" aria-labelledby="roster-title">
              <div className="section-heading">
                <div>
                  <p className="section-kicker">课堂名单</p>
                  <h2 id="roster-title">学生列表</h2>
                </div>
                <span className="roster-count">{roster.students.length} 人</span>
              </div>
              <ul className="student-list" aria-label="学生名单">
                {roster.students.map((student) => (
                  <li className="student-list-item" key={student.id}>
                    <span>{student.name}</span>
                    <span className="student-status">
                      {student.drawnThisRound ? '本轮已抽取' : '等待抽取'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ResultCards students={resultStudents} isAnimating={isAnimating} />
        </section>

        <aside className="control-column" aria-label="抽取控制">
          <DrawControls
            count={selectedCount}
            maxCount={availableStudentCount}
            hasRoster={hasRoster}
            animationEnabled={animationEnabled}
            disabled={isLoading || isImporting}
            isAnimating={isAnimating}
            onCountChange={setSelectedCount}
            onAnimationChange={handleAnimationChange}
            onDraw={handleDraw}
            onResetRound={handleResetRound}
          />
          {hasRoster ? (
            <ImportDropzone
              compact
              hasRoster
              onImport={handleImport}
              isImporting={isImporting || isAnimating || isLoading}
            />
          ) : null}
        </aside>
      </div>

      {isSettingsDrawerOpen ? (
        <SettingsDrawer
          students={roster.students}
          history={roster.history}
          disabled={isLoading || isImporting || isAnimating}
          onWeightChange={handleWeightChange}
          onResetWeights={handleResetWeights}
          onClearHistory={handleClearHistory}
          onClose={() => setIsSettingsDrawerOpen(false)}
        />
      ) : null}

      <ToastMessage message={errorMessage} onDismiss={() => setErrorMessage(null)} />
    </main>
  );
}
