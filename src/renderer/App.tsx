import { useCallback, useEffect, useRef, useState } from 'react';
import { drawStudents, resetRound, validateWeight } from '../shared/drawEngine';
import {
  DEFAULT_FULLSCREEN_DISPLAY_MS,
  LEGACY_FULLSCREEN_DISPLAY_MS,
  MAX_HISTORY_ITEMS,
} from '../shared/types';
import type {
  AnimationStyle,
  AppSettings,
  CloseAction,
  ColorTheme,
  DrawHistoryItem,
  RosterState,
  StudentRecord,
  Theme,
} from '../shared/types';
import { getRollIntervalMs, pickRollingName } from './rollPacing';
import { AppTitleBar } from './components/AppTitleBar';
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
  fullscreenDisplayMs: DEFAULT_FULLSCREEN_DISPLAY_MS,
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

/**
 * 旧版本把结果全屏停留时长固定为 1 秒，这里把历史存档迁移到新的默认值。
 * 新版本的可选范围从 1500 毫秒起，因此 1000 只可能来自历史存档。
 */
function migrateLegacySettings(settings: AppSettings): {
  settings: AppSettings;
  migrated: boolean;
} {
  if (settings.fullscreenDisplayMs !== LEGACY_FULLSCREEN_DISPLAY_MS) {
    return { settings, migrated: false };
  }

  return {
    settings: { ...settings, fullscreenDisplayMs: DEFAULT_FULLSCREEN_DISPLAY_MS },
    migrated: true,
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
  const [animationStyle, setAnimationStyle] = useState<AnimationStyle>(
    DEFAULT_SETTINGS.animationStyle ?? 'slot',
  );
  const [allowDuplicates, setAllowDuplicates] = useState(DEFAULT_SETTINGS.allowDuplicates);
  const [theme, setTheme] = useState<Theme>(DEFAULT_SETTINGS.theme);
  const [colorTheme, setColorTheme] = useState<ColorTheme>(
    DEFAULT_SETTINGS.colorTheme ?? 'ink',
  );
  const [closeAction, setCloseAction] = useState<CloseAction>(
    DEFAULT_SETTINGS.closeAction ?? 'background',
  );
  const [showFloatingBall, setShowFloatingBall] = useState<boolean>(
    DEFAULT_SETTINGS.showFloatingBall ?? true,
  );
  // 开机自启：状态以系统登录项为准（Electron 宿主中可用），不参与 saveState
  const [launchAtStartup, setLaunchAtStartup] = useState<boolean>(false);
  const [canToggleLaunchAtStartup, setCanToggleLaunchAtStartup] = useState<boolean>(false);
  const [resultStudents, setResultStudents] = useState<StudentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // 上一次保存是否失败：失败后锁定写操作，直到重试成功
  const [saveFailed, setSaveFailed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);

  // 动画与全屏展示状态
  const [rollingNames, setRollingNames] = useState<string[]>([]);
  // 每次名字切换自增：作为 React key 让文字过渡动效重新播放
  const [rollTick, setRollTick] = useState(0);
  const [marqueeStudentId, setMarqueeStudentId] = useState<string | null>(null);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [isRollingFullscreen, setIsRollingFullscreen] = useState(false);

  const rosterRef = useRef(roster);
  const animationEnabledRef = useRef(animationEnabled);
  const animationStyleRef = useRef(animationStyle);
  const allowDuplicatesRef = useRef(allowDuplicates);
  const themeRef = useRef(theme);
  const colorThemeRef = useRef(colorTheme);
  const closeActionRef = useRef(closeAction);
  const showFloatingBallRef = useRef(showFloatingBall);
  // 当前自定义背景图（dataURL）：从设置读取，导入名单时也需要原样保留
  const backgroundImage = roster.settings.backgroundImage;
  const backgroundImageRef = useRef(backgroundImage);
  backgroundImageRef.current = backgroundImage;
  const saveQueueRef = useRef<Promise<void> | null>(null);
  const pendingSaveCountRef = useRef(0);
  const interactionLockRef = useRef(false);
  const animationTimerRef = useRef<number | null>(null);
  const rollTimerRef = useRef<number | null>(null);
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

  const updateTheme = useCallback((nextTheme: Theme): void => {
    themeRef.current = nextTheme;
    setTheme(nextTheme);
  }, []);

  const updateColorTheme = useCallback((nextColorTheme: ColorTheme): void => {
    colorThemeRef.current = nextColorTheme;
    setColorTheme(nextColorTheme);
  }, []);

  const updateCloseAction = useCallback((nextCloseAction: CloseAction): void => {
    closeActionRef.current = nextCloseAction;
    setCloseAction(nextCloseAction);
  }, []);

  const updateShowFloatingBall = useCallback((show: boolean): void => {
    showFloatingBallRef.current = show;
    setShowFloatingBall(show);
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
        if (!disposedRef.current) {
          setSaveFailed(false);
        }
        return true;
      } catch {
        if (!disposedRef.current) {
          setSaveFailed(true);
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
          const migratedSettings = migrateLegacySettings(savedState.settings);
          const normalizedState: RosterState = {
            ...savedState,
            history: normalizeHistory(savedState.history),
            settings: migratedSettings.settings,
          };
          updateRoster(normalizedState);
          updateAnimationEnabled(normalizedState.settings.animationEnabled);
          if (normalizedState.settings.animationStyle) {
            updateAnimationStyle(normalizedState.settings.animationStyle);
          }
          if (typeof normalizedState.settings.allowDuplicates === 'boolean') {
            updateAllowDuplicates(normalizedState.settings.allowDuplicates);
          }
          updateTheme(normalizedState.settings.theme);
          if (normalizedState.settings.colorTheme) {
            updateColorTheme(normalizedState.settings.colorTheme);
          }
          if (normalizedState.settings.closeAction) {
            updateCloseAction(normalizedState.settings.closeAction);
          }
          if (typeof normalizedState.settings.showFloatingBall === 'boolean') {
            updateShowFloatingBall(normalizedState.settings.showFloatingBall);
          }
          setSelectedCount(1);

          // 开机自启：读取系统登录项当前状态用于开关回显
          const launchSettings = window.namePicker?.launchSettings;
          if (launchSettings) {
            setCanToggleLaunchAtStartup(true);
            void launchSettings
              .getCurrent()
              .then((enabled) => setLaunchAtStartup(enabled), () => undefined);
          }

          if (
            hasValidRoster(normalizedState) &&
            (normalizedState.history.length !== savedState.history.length ||
              migratedSettings.migrated)
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
      if (rollTimerRef.current !== null) {
        window.clearTimeout(rollTimerRef.current);
      }
      interactionLockRef.current = false;
    };
  }, [saveState, updateAllowDuplicates, updateAnimationEnabled, updateAnimationStyle, updateColorTheme, updateRoster, updateTheme]);

  const handleImport = useCallback(async (): Promise<void> => {
    const api = getNamePickerApi();
    if (
      !api ||
      isLoading ||
      isImporting ||
      isSaving ||
      saveFailed ||
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
          theme: themeRef.current,
          colorTheme: colorThemeRef.current,
          // 重新导入名单时保留已设置的自定义背景图；未设置时不写入该键
          ...(backgroundImageRef.current
            ? { backgroundImage: backgroundImageRef.current }
            : {}),
        },
      };

      updateRoster(nextState);
      updateAnimationEnabled(nextState.settings.animationEnabled);
      setSelectedCount(1);
      setResultStudents([]);
      setRollingNames([]);
      setMarqueeStudentId(null);
      setIsFullscreenOpen(false);
      // 重新选取名单成功后回到主界面，方便确认新名单
      setIsSettingsDrawerOpen(false);
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
  }, [isAnimating, isImporting, isLoading, isSaving, saveFailed, saveState, updateAnimationEnabled, updateRoster]);

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

  // 更新自定义背景图：dataUrl 为 null 表示恢复默认背景
  const handleBackgroundImageChange = useCallback(
    (dataUrl: string | null): void => {
      if (isLoading || isImporting || isSaving || isAnimating || interactionLockRef.current) {
        return;
      }

      interactionLockRef.current = true;
      const currentRoster = rosterRef.current;
      const nextSettings: AppSettings = { ...currentRoster.settings };
      if (dataUrl) {
        nextSettings.backgroundImage = dataUrl;
      } else {
        delete nextSettings.backgroundImage;
      }
      const nextState: RosterState = {
        ...currentRoster,
        history: normalizeHistory(currentRoster.history),
        settings: nextSettings,
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

  const handleFullscreenDurationChange = useCallback(
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
          fullscreenDisplayMs: durationMs,
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
        saveFailed ||
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
      if (rollTimerRef.current !== null) {
        window.clearTimeout(rollTimerRef.current);
        rollTimerRef.current = null;
      }

      // 如果不展示动画，直接呈现结果并全屏展示
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

      const pickCount = drawResult.selected.length;
      let elapsed = 0;
      let previousNames: string[] = [];

      // 翻一次名字：每个位置都尽量避免与上一帧同名，避免看起来「卡住」
      const rollNames = (): void => {
        const nextNames = Array.from({ length: pickCount }, (_, index) =>
          pickRollingName(candidateNames, previousNames[index]),
        );
        previousNames = nextNames;
        setRollingNames(nextNames);
        setRollTick((tick) => tick + 1);

        if (currentStyle === 'marquee') {
          const randomCandidate = candidates[Math.floor(Math.random() * candidates.length)];
          if (randomCandidate) {
            setMarqueeStudentId(randomCandidate.id);
          }
        }
      };

      // 递归定时器：间隔由缓出曲线加抖动给出，节奏先快后慢且不均匀
      const scheduleNextRoll = (): void => {
        const interval = getRollIntervalMs(elapsed, duration);
        rollTimerRef.current = window.setTimeout(() => {
          rollTimerRef.current = null;
          elapsed += interval;
          // 剩余时间不足以再翻一次时收手，把最后一步交给结算定时器
          if (elapsed >= duration) {
            return;
          }
          rollNames();
          scheduleNextRoll();
        }, interval);
      };

      // 先立即给出一屏名字，避免动画开头出现空档
      rollNames();
      scheduleNextRoll();

      // 动画计时结束，定格结果并触发全屏展示
      animationTimerRef.current = window.setTimeout(() => {
        if (rollTimerRef.current !== null) {
          window.clearTimeout(rollTimerRef.current);
          rollTimerRef.current = null;
        }
        animationTimerRef.current = null;

        setIsAnimating(false);
        setRollingNames([]);
        setMarqueeStudentId(null);
        setResultStudents(drawResult.selected);

        // 定格后进入全屏结果展示
        setIsRollingFullscreen(false);
        setIsFullscreenOpen(true);

        resultDisplayed = true;
        releaseInteractionLock();
      }, duration);
    },
    [isAnimating, isImporting, isLoading, isSaving, saveFailed, saveState, updateAnimationEnabled, updateRoster],
  );

  const handleResetRound = useCallback((): void => {
    const currentRoster = rosterRef.current;
    if (
      isLoading ||
      isImporting ||
      isSaving ||
      saveFailed ||
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
  }, [isAnimating, isImporting, isLoading, isSaving, saveFailed, saveState, updateRoster]);

  const handleThemeChange = useCallback(
    (nextTheme: Theme): void => {
      if (isLoading || isImporting || isSaving || isAnimating || interactionLockRef.current) {
        return;
      }

      interactionLockRef.current = true;
      updateTheme(nextTheme);
      const currentRoster = rosterRef.current;
      const nextState: RosterState = {
        ...currentRoster,
        history: normalizeHistory(currentRoster.history),
        settings: {
          ...currentRoster.settings,
          theme: nextTheme,
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
    [isAnimating, isImporting, isLoading, isSaving, saveState, updateRoster, updateTheme],
  );

  // 更新配色方案：跟随界面主题的选择模式，空名单时只改界面不落盘
  const handleColorThemeChange = useCallback(
    (nextColorTheme: ColorTheme): void => {
      if (isLoading || isImporting || isSaving || isAnimating || interactionLockRef.current) {
        return;
      }

      interactionLockRef.current = true;
      updateColorTheme(nextColorTheme);
      const currentRoster = rosterRef.current;
      const nextState: RosterState = {
        ...currentRoster,
        history: normalizeHistory(currentRoster.history),
        settings: {
          ...currentRoster.settings,
          colorTheme: nextColorTheme,
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
    [isAnimating, isImporting, isLoading, isSaving, saveState, updateColorTheme, updateRoster],
  );

  // 更新点击关闭时的默认行为
  const handleCloseActionChange = useCallback(
    (nextCloseAction: CloseAction): void => {
      if (isLoading || isImporting || isSaving || isAnimating || interactionLockRef.current) {
        return;
      }

      interactionLockRef.current = true;
      updateCloseAction(nextCloseAction);
      const currentRoster = rosterRef.current;
      const nextState: RosterState = {
        ...currentRoster,
        history: normalizeHistory(currentRoster.history),
        settings: {
          ...currentRoster.settings,
          closeAction: nextCloseAction,
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
    [isAnimating, isImporting, isLoading, isSaving, saveState, updateCloseAction, updateRoster],
  );

  // 更新后台运行时是否显示悬浮球
  const handleShowFloatingBallChange = useCallback(
    (show: boolean): void => {
      if (isLoading || isImporting || isSaving || isAnimating || interactionLockRef.current) {
        return;
      }

      interactionLockRef.current = true;
      updateShowFloatingBall(show);
      const currentRoster = rosterRef.current;
      const nextState: RosterState = {
        ...currentRoster,
        history: normalizeHistory(currentRoster.history),
        settings: {
          ...currentRoster.settings,
          showFloatingBall: show,
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
    [isAnimating, isImporting, isLoading, isSaving, saveState, updateRoster, updateShowFloatingBall],
  );

  // 开机自启：直接写系统登录项，失败时回滚开关状态
  const handleLaunchAtStartupChange = useCallback(
    (enabled: boolean): void => {
      const launchSettings = window.namePicker?.launchSettings;
      if (!launchSettings) {
        return;
      }

      const previous = launchAtStartup;
      setLaunchAtStartup(enabled);
      launchSettings
        .setEnabled(enabled)
        .then(() => launchSettings.getCurrent())
        .then((actual) => setLaunchAtStartup(actual))
        .catch(() => setLaunchAtStartup(previous));
    },
    [launchAtStartup],
  );

  // 保存失败后重试：重新写入当前快照，成功后解除写锁定
  const handleRetrySave = useCallback((): void => {
    setErrorMessage(null);
    void saveState(rosterRef.current);
  }, [saveState]);

  // 清除本机数据：成功后恢复初始名单与默认设置，并关闭设置抽屉
  const handleClearLocalData = useCallback(async (): Promise<void> => {
    const api = getNamePickerApi();
    if (!api) {
      return;
    }

    try {
      await api.clearState();
      updateRoster(createEmptyState());
      updateAnimationEnabled(DEFAULT_SETTINGS.animationEnabled);
      updateAnimationStyle(DEFAULT_SETTINGS.animationStyle ?? 'slot');
      updateAllowDuplicates(DEFAULT_SETTINGS.allowDuplicates ?? false);
      updateTheme(DEFAULT_SETTINGS.theme);
      updateColorTheme(DEFAULT_SETTINGS.colorTheme ?? 'ink');
      updateCloseAction(DEFAULT_SETTINGS.closeAction ?? 'background');
      updateShowFloatingBall(DEFAULT_SETTINGS.showFloatingBall ?? true);
      setSelectedCount(1);
      setResultStudents([]);
      setRollingNames([]);
      setMarqueeStudentId(null);
      setIsFullscreenOpen(false);
      setIsRollingFullscreen(false);
      setSaveFailed(false);
      setErrorMessage(null);
      setIsSettingsDrawerOpen(false);
    } catch {
      // 只暴露固定文案，不透出底层错误细节
      setErrorMessage('清除本机数据失败，请重试。');
    }
  }, [updateAllowDuplicates, updateAnimationEnabled, updateAnimationStyle, updateRoster, updateTheme]);

  // 键盘快捷键：Ctrl/Cmd+O 导入、空格抽取、R 重置；输入框内或设置抽屉打开时不响应
  useEffect(() => {
    function isEditableTarget(target: EventTarget | null): boolean {
      return (
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, [contenteditable="true"]') !== null
      );
    }

    function handleShortcutKeyDown(event: KeyboardEvent): void {
      if (isLoading || isImporting || isSaving || saveFailed || isAnimating || isSettingsDrawerOpen) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }

      const isModifierPressed = event.ctrlKey || event.metaKey;
      if (isModifierPressed && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        void handleImport();
        return;
      }
      if (isModifierPressed || event.altKey) {
        return;
      }

      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault();
        handleDraw(selectedCount, animationEnabledRef.current);
        return;
      }

      if (event.key.toLowerCase() === 'r') {
        event.preventDefault();
        handleResetRound();
      }
    }

    document.addEventListener('keydown', handleShortcutKeyDown);
    return () => {
      document.removeEventListener('keydown', handleShortcutKeyDown);
    };
  }, [
    handleDraw,
    handleImport,
    handleResetRound,
    isAnimating,
    isImporting,
    isLoading,
    isSaving,
    isSettingsDrawerOpen,
    saveFailed,
    selectedCount,
  ]);

  const hasRoster = roster.students.length > 0;
  const availableStudentCount = getAvailableStudentCount(roster.students, allowDuplicates);

  // 同名（重名）学生集合：用于在名单中标注，方便教师区分
  const duplicateNameSet = new Set(
    roster.students
      .map((student) => student.name)
      .filter((name, index, allNames) => allNames.indexOf(name) !== index),
  );

  // 自定义背景：独立固定图层 + object-fit: fill 拉伸铺满整个窗口，
  // 保证任何比例的图片都完整显示且不留黑边
  const backgroundLayer = backgroundImage ? (
    <div className="app-bg-layer" aria-hidden="true">
      <img className="app-bg-layer__image" src={backgroundImage} alt="" draggable={false} />
      <div className="app-bg-layer__veil" />
    </div>
  ) : null;

  return (
    <main
      className={`app-shell theme-${theme} color-${colorTheme}${
        backgroundImage ? ' app-shell--custom-bg' : ''
      }`}
    >
      {backgroundLayer}
      {/* 自绘标题栏：主进程使用 frame: false，这里固定在最上方按主题绘制标题与窗口按钮 */}
      <AppTitleBar />

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
          {/* 加载中只展示加载提示：避免先闪出「名单为空」再切换成已有名单 */}
          {isLoading ? null : !hasRoster ? (
            <ImportDropzone
              onImport={handleImport}
              isImporting={isImporting}
              disabled={isSaving || saveFailed}
            />
          ) : (
            <>
              {/* 抽中人名结果区移至学生名单上方 */}
              <ResultCards
                students={resultStudents}
                isAnimating={isAnimating}
                animationStyle={animationStyle}
                rollingNames={rollingNames}
                rollTick={rollTick}
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
                    const isDuplicateName = duplicateNameSet.has(student.name);
                    const canBeDrawn = Number.isFinite(student.weight) && student.weight > 0;
                    const statusText = student.drawnThisRound
                      ? '本轮已抽取'
                      : canBeDrawn
                        ? '等待抽取'
                        : '暂不参与抽取';
                    return (
                      <li
                        className={`student-list-item ${isMarqueeActive ? 'student-list-item--marquee' : ''}`}
                        key={student.id}
                      >
                        <span className="student-name">
                          {student.name}
                          {isDuplicateName ? (
                            <span className="student-name-badge" aria-label="同名学生">
                              同名
                            </span>
                          ) : null}
                        </span>
                        <span className="student-status">{statusText}</span>
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
            saveFailed={saveFailed}
            onCountChange={setSelectedCount}
            onAnimationChange={handleAnimationChange}
            onAllowDuplicatesChange={handleAllowDuplicatesChange}
            onDraw={handleDraw}
            onResetRound={handleResetRound}
            onRetrySave={handleRetrySave}
          />
        </aside>
      </div>

      {isSettingsDrawerOpen ? (
        <SettingsDrawer
          students={roster.students}
          history={roster.history}
          disabled={isLoading || isImporting || isAnimating || isSaving || saveFailed}
          animationStyle={animationStyle}
          onAnimationStyleChange={handleAnimationStyleChange}
          animationDurationMs={roster.settings.animationDurationMs}
          onAnimationDurationChange={handleAnimationDurationChange}
          fullscreenDisplayMs={
            roster.settings.fullscreenDisplayMs ?? DEFAULT_FULLSCREEN_DISPLAY_MS
          }
          onFullscreenDisplayChange={handleFullscreenDurationChange}
          theme={theme}
          onThemeChange={handleThemeChange}
          colorTheme={colorTheme}
          onColorThemeChange={handleColorThemeChange}
          closeAction={closeAction}
          onCloseActionChange={handleCloseActionChange}
          showFloatingBall={showFloatingBall}
          onShowFloatingBallChange={handleShowFloatingBallChange}
          canToggleLaunchAtStartup={canToggleLaunchAtStartup}
          launchAtStartup={launchAtStartup}
          onLaunchAtStartupChange={handleLaunchAtStartupChange}
          onClearLocalData={handleClearLocalData}
          onImport={handleImport}
          isImporting={isImporting}
          backgroundImage={backgroundImage}
          onBackgroundImageChange={handleBackgroundImageChange}
          onWeightChange={handleWeightChange}
          onResetWeights={handleResetWeights}
          onClearHistory={handleClearHistory}
          onClose={() => setIsSettingsDrawerOpen(false)}
        />
      ) : null}

      {/* 抽取完名字后全屏结果展示组件 */}
      <FullscreenResultOverlay
        isOpen={isFullscreenOpen}
        students={resultStudents}
        durationMs={roster.settings.fullscreenDisplayMs ?? DEFAULT_FULLSCREEN_DISPLAY_MS}
        isRolling={isRollingFullscreen}
        rollingNames={rollingNames}
        onClose={() => setIsFullscreenOpen(false)}
      />

      <ToastMessage message={errorMessage} onDismiss={() => setErrorMessage(null)} />
    </main>
  );
}
