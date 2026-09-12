import { useCallback, useEffect, useRef, useState } from 'react';
import { drawStudents, resetRound, validateWeight } from '../shared/drawEngine';
import { MAX_HISTORY_ITEMS } from '../shared/types';
import type { AnimationStyle, AppSettings, DrawHistoryItem, RosterState, StudentRecord } from '../shared/types';
import { ClassroomHeader } from './components/ClassroomHeader';
import { DrawControls } from './components/DrawControls';
import { FullscreenResultOverlay } from './components/FullscreenResultOverlay';
import { ImportDropzone } from './components/ImportDropzone';
import { ResultCards } from './components/ResultCards';
import { SettingsDrawer } from './components/SettingsDrawer';
import { ToastMessage } from './components/ToastMessage';

const DEFAULT_SETTINGS: AppSettings = {
  animationEnabled: true,
  animationDurationMs: 800,
  animationStyle: 'slot',
  allowDuplicates: false,
  fullscreenDisplayMs: 1000,
  theme: 'light',
};

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

function normalizeHistory(history: DrawHistoryItem[]): DrawHistoryItem[] {
  return history.slice(0, MAX_HISTORY_ITEMS);
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

function getAvailableStudentCount(students: StudentRecord[], allowDuplicates = false): number {
  return students.filter(
    (student) =>
      (allowDuplicates || !student.drawnThisRound) &&
      Number.isFinite(student.weight) &&
      student.weight > 0,
  ).length;
}

export function App() {
  const [roster, setRoster] = useState<RosterState>(createEmptyState);
  const [selectedCount, setSelectedCount] = useState(1);
  const [animationEnabled, setAnimationEnabled] = useState(DEFAULT_SETTINGS.animationEnabled);
  const [animationStyle, setAnimationStyle] = useState<AnimationStyle>(DEFAULT_SETTINGS.animationStyle);
  const [allowDuplicates, setAllowDuplicates] = useState(DEFAULT_SETTINGS.allowDuplicates);
  const [resultStudents, setResultStudents] = useState<StudentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);

  // 动画与全屏展示状态
  const [rollingNames, setRollingNames] = useState<string[]>([]);
  const [marqueeStudentId, setMarqueeStudentId] = useState<string | null>(null);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [isRollingFullscreen, setIsRollingFullscreen] = useState(false);

  const rosterRef = useRef(roster);
  const animationEnabledRef = useRef(animationEnabled);
  const animationStyleRef = useRef(animationStyle);
  const allowDuplicatesRef = useRef(allowDuplicates);
  const saveQueueRef = useRef<Promise<void> | null>(null);
  const pendingSaveCountRef = useRef(0);
  const interactionLockRef = useRef(false);
  const animationTimerRef = useRef<number | null>(null);
  const rollIntervalRef = useRef<number | null>(null);
  const disposedRef = useRef(false);

  const updateRoster = useCallback((nextState: RosterState): void => {
    rosterRef.current = nextState;
    setRoster(nextState);
  }, []);

  const updateAnimationEnabled = useCallback((enabled: boolean): void => {
    animationEnabledRef.current = enabled;
    setAnimationEnabled(enabled);
  }, []);

  const updateAnimationStyle = useCallback((style: AnimationStyle): void => {
    animationStyleRef.current = style;
    setAnimationStyle(style);
  }, []);

  const updateAllowDuplicates = useCallback((allowed: boolean): void => {
    allowDuplicatesRef.current = allowed;
    setAllowDuplicates(allowed);
  }, []);

  const saveState = useCallback(async (nextState: RosterState): Promise<boolean> => {
    const api = getNamePickerApi();
    if (!api) {
      return true;
    }

    pendingSaveCountRef.current += 1;
    if (!disposedRef.current) {
      setIsSaving(true);
    }

    const finishSave = (): void => {
      pendingSaveCountRef.current = Math.max(0, pendingSaveCountRef.current - 1);
      if (pendingSaveCountRef.current === 0 && !disposedRef.current) {
        setIsSaving(false);
      }
    };

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
    const trackedSave = queuedSave.then(
      (result) => {
        finishSave();
        return result;
      },
      (error) => {
        finishSave();
        throw error;
      },
    );
    saveQueueRef.current = trackedSave.then(
      () => undefined,
      () => undefined,
    );
    return trackedSave;
  }, []);

  const handleWeightChange = useCallback(
    (id: string, weight: number): void => {
      if (
        isLoading ||
        isImporting ||
        isSaving ||
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
        history: normalizeHistory(currentRoster.history),
      };
      updateRoster(nextState);
      void saveState(nextState);
    },
    [isAnimating, isImporting, isLoading, isSaving, saveState, updateRoster],
  );

  const handleResetWeights = useCallback((): void => {
    if (isLoading || isImporting || isSaving || isAnimating) {
      return;
    }

    const currentRoster = rosterRef.current;
    if (currentRoster.students.length === 0) {
      return;
    }

    const nextState: RosterState = {
      ...currentRoster,
      students: currentRoster.students.map((student) => ({ ...student, weight: 1 })),
      history: normalizeHistory(currentRoster.history),
    };
    updateRoster(nextState);
    void saveState(nextState);
  }, [isAnimating, isImporting, isLoading, isSaving, saveState, updateRoster]);

  const handleClearHistory = useCallback((): void => {
    if (isLoading || isImporting || isSaving || isAnimating) {
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
  }, [isAnimating, isImporting, isLoading, isSaving, saveState, updateRoster]);

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
          const normalizedState: RosterState = {
            ...savedState,
            history: normalizeHistory(savedState.history),
          };
          updateRoster(normalizedState);
          updateAnimationEnabled(normalizedState.settings.animationEnabled);
          if (normalizedState.settings.animationStyle) {
            updateAnimationStyle(normalizedState.settings.animationStyle);
          }
          if (typeof normalizedState.settings.allowDuplicates === 'boolean') {
            updateAllowDuplicates(normalizedState.settings.allowDuplicates);
          }
          setSelectedCount(1);

          if (
            hasValidRoster(normalizedState) &&
            normalizedState.history.length !== savedState.history.length
          ) {
            await saveState(normalizedState);
          }
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
      if (rollIntervalRef.current !== null) {
        window.clearInterval(rollIntervalRef.current);
      }
      interactionLockRef.current = false;
    };
  }, [saveState, updateAllowDuplicates, updateAnimationEnabled, updateAnimationStyle, updateRoster]);

  const handleImport = useCallback(async (): Promise<void> => {
    const api = getNamePickerApi();
    if (
      !api ||
      isLoading ||
      isImporting ||
      isSaving ||
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
          animationStyle: animationStyleRef.current,
          allowDuplicates: allowDuplicatesRef.current,
          theme: 'light',
        },
      };

      updateRoster(nextState);
      updateAnimationEnabled(nextState.settings.animationEnabled);
      setSelectedCount(1);
      setResultStudents([]);
      setRollingNames([]);
      setMarqueeStudentId(null);
      setIsFullscreenOpen(false);
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
  }, [isAnimating, isImporting, isLoading, isSaving, saveState, updateAnimationEnabled, updateRoster]);

  const handleAnimationChange = useCallback(
    (enabled: boolean): void => {
      if (isLoading || isImporting || isSaving || isAnimating || interactionLockRef.current) {
        return;
      }

      interactionLockRef.current = true;
      updateAnimationEnabled(enabled);
      const currentRoster = rosterRef.current;
      const nextState: RosterState = {
        ...currentRoster,
        history: normalizeHistory(currentRoster.history),
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
    [isAnimating, isImporting, isLoading, isSaving, saveState, updateAnimationEnabled, updateRoster],
  );

  const handleAllowDuplicatesChange = useCallback(
    (allowed: boolean): void => {
      if (isLoading || isImporting || isSaving || isAnimating || interactionLockRef.current) {
        return;
      }

      interactionLockRef.current = true;
      updateAllowDuplicates(allowed);
      const currentRoster = rosterRef.current;
      const nextState: RosterState = {
        ...currentRoster,
        history: normalizeHistory(currentRoster.history),
        settings: {
          ...currentRoster.settings,
          allowDuplicates: allowed,
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
    [isAnimating, isImporting, isLoading, isSaving, saveState, updateAllowDuplicates, updateRoster],
  );

  const handleAnimationStyleChange = useCallback(
    (style: AnimationStyle): void => {
      if (isLoading || isImporting || isSaving || isAnimating || interactionLockRef.current) {
        return;
      }

      interactionLockRef.current = true;
      updateAnimationStyle(style);
      const currentRoster = rosterRef.current;
      const nextState: RosterState = {
        ...currentRoster,
        history: normalizeHistory(currentRoster.history),
        settings: {
          ...currentRoster.settings,
          animationStyle: style,
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
    [isAnimating, isImporting, isLoading, isSaving, saveState, updateAnimationStyle, updateRoster],
  );

  const handleAnimationDurationChange = useCallback(
    (durationMs: number): void => {
      if (isLoading || isImporting || isSaving || isAnimating || interactionLockRef.current) {
        return;
      }

      interactionLockRef.current = true;
      const currentRoster = rosterRef.current;
      const nextState: RosterState = {
        ...currentRoster,
        history: normalizeHistory(currentRoster.history),
        settings: {
          ...currentRoster.settings,
          animationDurationMs: durationMs,
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
    [isAnimating, isImporting, isLoading, isSaving, saveState, updateRoster],
  );

  const handleDraw = useCallback(
    (count: number, animate: boolean): void => {
      const currentRoster = rosterRef.current;
      const isAllowDup = allowDuplicatesRef.current;
      if (
        isLoading ||
        isImporting ||
        isSaving ||
        isAnimating ||
        interactionLockRef.current ||
        currentRoster.students.length === 0
      ) {
        return;
      }

      const availableCount = getAvailableStudentCount(currentRoster.students, isAllowDup);
      if (availableCount === 0) {
        setErrorMessage('本轮没有可抽取的学生，请先重置本轮。');
        return;
      }

      interactionLockRef.current = true;
      setErrorMessage(null);

      // 计算加权抽签结果（传入是否允许重复参数）
      const drawResult = drawStudents(currentRoster.students, count, Math.random, {
        allowDuplicates: isAllowDup,
      });

      const shouldAnimate = animate === animationEnabledRef.current
        ? animate
        : animationEnabledRef.current;

      const nextHistory = drawResult.selected.length > 0
        ? normalizeHistory([createHistoryItem(drawResult.selected), ...currentRoster.history])
        : normalizeHistory(currentRoster.history);

      const nextState: RosterState = {
        ...currentRoster,
        students: drawResult.updatedStudents,
        history: nextHistory,
        settings: {
          ...currentRoster.settings,
          animationEnabled: shouldAnimate,
          allowDuplicates: isAllowDup,
          animationStyle: animationStyleRef.current,
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
        setRollingNames([]);
        setMarqueeStudentId(null);
        resultDisplayed = true;
        releaseInteractionLock();
        return;
      }

      const duration = Math.max(0, nextState.settings.animationDurationMs);
      const currentStyle = animationStyleRef.current;
      const candidates = currentRoster.students.filter(
        (s) => (isAllowDup || !s.drawnThisRound) && validateWeight(s.weight) && s.weight > 0,
      );
      const candidateNames = candidates.map((s) => s.name);

      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current);
        animationTimerRef.current = null;
      }
      if (rollIntervalRef.current !== null) {
        window.clearInterval(rollIntervalRef.current);
        rollIntervalRef.current = null;
      }

      // 如果不展示动画，直接呈现结果并默认全屏展示 1 秒
      if (!shouldAnimate || duration === 0) {
        setResultStudents(drawResult.selected);
        setIsAnimating(false);
        setRollingNames([]);
        setMarqueeStudentId(null);
        setIsRollingFullscreen(false);
        setIsFullscreenOpen(true);
        resultDisplayed = true;
        releaseInteractionLock();
        return;
      }

      // 开始滚动动画
      setIsAnimating(true);
      setResultStudents([]);

      // spotlight 全屏聚焦弹窗模式下，提前开启全屏遮罩
      if (currentStyle === 'spotlight') {
        setIsRollingFullscreen(true);
        setIsFullscreenOpen(true);
      }

      // 启动高速名字翻滚定时器（60ms）
      rollIntervalRef.current = window.setInterval(() => {
        if (candidateNames.length > 0) {
          const countToPick = drawResult.selected.length;
          const randomBatch = Array.from({ length: countToPick }, () => {
            const index = Math.floor(Math.random() * candidateNames.length);
            return candidateNames[index] ?? '候选人';
          });
          setRollingNames(randomBatch);

          if (currentStyle === 'marquee') {
            const randomCandidate = candidates[Math.floor(Math.random() * candidates.length)];
            if (randomCandidate) {
              setMarqueeStudentId(randomCandidate.id);
            }
          }
        }
      }, 60);

      // 动画计时结束，定格结果并触发全屏展示 1 秒
      animationTimerRef.current = window.setTimeout(() => {
        if (rollIntervalRef.current !== null) {
          window.clearInterval(rollIntervalRef.current);
          rollIntervalRef.current = null;
        }
        animationTimerRef.current = null;

        setIsAnimating(false);
        setRollingNames([]);
        setMarqueeStudentId(null);
        setResultStudents(drawResult.selected);

        // 默认将结果全屏显示 1 秒
        setIsRollingFullscreen(false);
        setIsFullscreenOpen(true);

        resultDisplayed = true;
        releaseInteractionLock();
      }, duration);
    },
    [isAnimating, isImporting, isLoading, isSaving, saveState, updateAnimationEnabled, updateRoster],
  );

  const handleResetRound = useCallback((): void => {
    const currentRoster = rosterRef.current;
    if (
      isLoading ||
      isImporting ||
      isSaving ||
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
      history: normalizeHistory(currentRoster.history),
    };
    updateRoster(nextState);
    setResultStudents([]);
    setRollingNames([]);
    setMarqueeStudentId(null);
    setIsFullscreenOpen(false);
    setErrorMessage(null);
    void saveState(nextState).then(
      () => {
        interactionLockRef.current = false;
      },
      () => {
        interactionLockRef.current = false;
      },
    );
  }, [isAnimating, isImporting, isLoading, isSaving, saveState, updateRoster]);

  const hasRoster = roster.students.length > 0;
  const availableStudentCount = getAvailableStudentCount(roster.students, allowDuplicates);

  return (
    <main className="app-shell">
      <ClassroomHeader
        sourceName={roster.sourceName}
        studentCount={roster.students.length}
        settingsDisabled={isLoading || isImporting || isAnimating || isSaving}
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
            <ImportDropzone
              onImport={handleImport}
              isImporting={isImporting || isLoading}
              disabled={isSaving}
            />
          ) : (
            <>
              {/* 抽中人名结果区移至学生名单上方 */}
              <ResultCards
                students={resultStudents}
                isAnimating={isAnimating}
                animationStyle={animationStyle}
                rollingNames={rollingNames}
              />

              {/* 全部学生名单区域 */}
              <section className="roster-section" aria-labelledby="roster-title">
                <div className="section-heading">
                  <div>
                    <p className="section-kicker">课堂名单</p>
                    <h2 id="roster-title">学生列表</h2>
                  </div>
                  <span className="roster-count">{roster.students.length} 人</span>
                </div>
                <ul className="student-list" aria-label="学生名单">
                  {roster.students.map((student) => {
                    const isMarqueeActive = marqueeStudentId === student.id;
                    return (
                      <li
                        className={`student-list-item ${isMarqueeActive ? 'student-list-item--marquee' : ''}`}
                        key={student.id}
                      >
                        <span>{student.name}</span>
                        <span className="student-status">
                          {student.drawnThisRound ? '本轮已抽取' : '等待抽取'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          )}
        </section>

        <aside className="control-column" aria-label="抽取控制">
          <DrawControls
            count={selectedCount}
            maxCount={availableStudentCount}
            hasRoster={hasRoster}
            animationEnabled={animationEnabled}
            allowDuplicates={allowDuplicates}
            disabled={isLoading || isImporting}
            isAnimating={isAnimating}
            isSaving={isSaving}
            onCountChange={setSelectedCount}
            onAnimationChange={handleAnimationChange}
            onAllowDuplicatesChange={handleAllowDuplicatesChange}
            onDraw={handleDraw}
            onResetRound={handleResetRound}
          />
          {hasRoster ? (
            <ImportDropzone
              compact
              hasRoster
              onImport={handleImport}
              isImporting={isImporting || isAnimating || isLoading}
              disabled={isSaving}
            />
          ) : null}
        </aside>
      </div>

      {isSettingsDrawerOpen ? (
        <SettingsDrawer
          students={roster.students}
          history={roster.history}
          disabled={isLoading || isImporting || isAnimating || isSaving}
          animationStyle={animationStyle}
          onAnimationStyleChange={handleAnimationStyleChange}
          animationDurationMs={roster.settings.animationDurationMs}
          onAnimationDurationChange={handleAnimationDurationChange}
          onWeightChange={handleWeightChange}
          onResetWeights={handleResetWeights}
          onClearHistory={handleClearHistory}
          onClose={() => setIsSettingsDrawerOpen(false)}
        />
      ) : null}

      {/* 抽取完名字后全屏结果展示组件（默认展示 1 秒） */}
      <FullscreenResultOverlay
        isOpen={isFullscreenOpen}
        students={resultStudents}
        durationMs={roster.settings.fullscreenDisplayMs ?? 1000}
        isRolling={isRollingFullscreen}
        rollingNames={rollingNames}
        onClose={() => setIsFullscreenOpen(false)}
      />

      <ToastMessage message={errorMessage} onDismiss={() => setErrorMessage(null)} />
    </main>
  );
}
