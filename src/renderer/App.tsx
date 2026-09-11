import { useCallback, useEffect, useRef, useState } from 'react';
import { drawStudents, resetRound } from '../shared/drawEngine';
import type { RosterState, StudentRecord } from '../shared/types';
import { ClassroomHeader } from './components/ClassroomHeader';
import { DrawControls } from './components/DrawControls';
import { ImportDropzone } from './components/ImportDropzone';
import { ResultCards } from './components/ResultCards';
import { ToastMessage } from './components/ToastMessage';

const DEFAULT_SETTINGS = {
  animationEnabled: true,
  animationDurationMs: 800,
  theme: 'light' as const,
};

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

export function App() {
  const [roster, setRoster] = useState<RosterState>(createEmptyState);
  const [selectedCount, setSelectedCount] = useState(1);
  const [animationEnabled, setAnimationEnabled] = useState(DEFAULT_SETTINGS.animationEnabled);
  const [resultStudents, setResultStudents] = useState<StudentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 后续设置任务将在此状态上挂载设置抽屉，不提前改变课堂主路径。
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
  const animationTimerRef = useRef<number | null>(null);
  const animationLockRef = useRef(false);

  const saveState = useCallback(async (nextState: RosterState): Promise<boolean> => {
    const api = getNamePickerApi();
    if (!api) {
      return true;
    }

    try {
      await api.saveState(nextState);
      return true;
    } catch {
      setErrorMessage('名单状态保存失败，请重试。');
      return false;
    }
  }, []);

  useEffect(() => {
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
          setRoster(savedState);
          setAnimationEnabled(savedState.settings.animationEnabled);
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
      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current);
      }
      animationLockRef.current = false;
    };
  }, []);

  const handleImport = useCallback(async (): Promise<void> => {
    const api = getNamePickerApi();
    if (!api || isLoading || isImporting || isAnimating) {
      return;
    }

    setErrorMessage(null);
    setIsImporting(true);

    try {
      const importedRoster = await api.importRoster();
      const nextState: RosterState = {
        sourceName: importedRoster.sourceName,
        students: importedRoster.students.map((student) => ({ ...student })),
        history: [],
        settings: {
          ...roster.settings,
          animationEnabled,
          theme: 'light',
        },
      };

      setRoster(nextState);
      setSelectedCount(1);
      setResultStudents([]);
      await saveState(nextState);
    } catch {
      setErrorMessage('导入名单失败，请重试。');
    } finally {
      setIsImporting(false);
    }
  }, [animationEnabled, isAnimating, isImporting, isLoading, roster.settings, saveState]);

  const handleAnimationChange = useCallback(
    (enabled: boolean): void => {
      setAnimationEnabled(enabled);
      const nextState: RosterState = {
        ...roster,
        settings: {
          ...roster.settings,
          animationEnabled: enabled,
        },
      };
      setRoster(nextState);
      void saveState(nextState);
    },
    [roster, saveState],
  );

  const handleDraw = useCallback(
    (count: number, animate: boolean): void => {
      if (
        isLoading ||
        isAnimating ||
        animationLockRef.current ||
        roster.students.length === 0
      ) {
        return;
      }

      setErrorMessage(null);
      const drawResult = drawStudents(roster.students, count);
      const nextState: RosterState = {
        ...roster,
        students: drawResult.updatedStudents,
        settings: {
          ...roster.settings,
          animationEnabled: animate,
        },
      };
      setRoster(nextState);
      void saveState(nextState);

      if (drawResult.selected.length === 0) {
        setResultStudents([]);
        setErrorMessage('本轮没有可抽取的学生，请先重置本轮。');
        return;
      }

      const duration = Math.max(0, nextState.settings.animationDurationMs);
      if (!animate || duration === 0) {
        setResultStudents(drawResult.selected);
        setIsAnimating(false);
        return;
      }

      animationLockRef.current = true;
      setIsAnimating(true);
      setResultStudents([]);
      animationTimerRef.current = window.setTimeout(() => {
        animationTimerRef.current = null;
        animationLockRef.current = false;
        setResultStudents(drawResult.selected);
        setIsAnimating(false);
      }, duration);
    },
    [isAnimating, isLoading, roster, saveState],
  );

  const handleResetRound = useCallback((): void => {
    if (isLoading || isAnimating || roster.students.length === 0) {
      return;
    }

    const nextState: RosterState = {
      ...roster,
      students: resetRound(roster.students),
    };
    setRoster(nextState);
    setResultStudents([]);
    setErrorMessage(null);
    void saveState(nextState);
  }, [isAnimating, isLoading, roster, saveState]);

  const hasRoster = roster.students.length > 0;

  return (
    <main
      className="app-shell"
      data-drawer-open={isSettingsDrawerOpen ? 'true' : 'false'}
    >
      <ClassroomHeader sourceName={roster.sourceName} studentCount={roster.students.length} />

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
            maxCount={roster.students.length}
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

      <ToastMessage message={errorMessage} onDismiss={() => setErrorMessage(null)} />

      <div
        className="settings-drawer-slot"
        data-drawer-slot="settings"
        data-open={isSettingsDrawerOpen ? 'true' : 'false'}
        aria-hidden="true"
      />
    </main>
  );
}
