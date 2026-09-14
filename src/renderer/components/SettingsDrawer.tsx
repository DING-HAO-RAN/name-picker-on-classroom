import { useEffect, useRef, useState } from 'react';
import {
  COLOR_THEMES,
  DEFAULT_BRANDING,
  DEFAULT_FULLSCREEN_DISPLAY_MS,
  MAX_ANIMATION_DURATION_MS,
  MAX_BACKGROUND_IMAGE_LENGTH,
  MAX_FULLSCREEN_DISPLAY_MS,
  MAX_PITY_THRESHOLD,
  MAX_SOUND_DATA_LENGTH,
  MIN_FULLSCREEN_DISPLAY_MS,
  type AnimationStyle,
  type BrandingSettings,
  type CloseAction,
  type ColorTheme,
  type DrawHistoryItem,
  type StudentRecord,
  type Theme,
  type WeightPreset,
} from '../../shared/types';
import { HistoryPanel } from './HistoryPanel';
import { PillSwitch } from './PillSwitch';
import { StudentWeightList } from './StudentWeightList';

/** 颜色主题的界面文案 */
const COLOR_THEME_LABELS: Record<ColorTheme, string> = {
  ink: '墨青（默认）',
  sunset: '暖阳',
  meadow: '青禾',
  dusk: '黛蓝',
  plum: '绛霞',
};

/** 允许作为背景的图片 MIME 类型 */
const ACCEPTED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/bmp',
  'image/gif',
]);

/** 原始图片文件大小上限（字节），约对应 dataURL 上限 MAX_BACKGROUND_IMAGE_LENGTH */
const MAX_BACKGROUND_FILE_BYTES = 6 * 1024 * 1024;

/** 音效文件大小上限（字节），约对应 dataURL 上限 MAX_SOUND_DATA_LENGTH */
const MAX_SOUND_FILE_BYTES = 3 * 1024 * 1024;

/** 允许作为音效的音频 MIME 类型 */
const ACCEPTED_AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
  'audio/mp4',
  'audio/aac',
]);

export interface SettingsDrawerProps {
  students: StudentRecord[];
  onWeightChange: (id: string, weight: number) => void;
  onResetWeights: () => void;
  onClose: () => void;
  history?: DrawHistoryItem[];
  onClearHistory?: () => void;
  disabled?: boolean;
  animationStyle?: AnimationStyle;
  onAnimationStyleChange?: (style: AnimationStyle) => void;
  animationDurationMs?: number;
  onAnimationDurationChange?: (duration: number) => void;
  /** 抽取结果全屏停留时长（毫秒） */
  fullscreenDisplayMs?: number;
  onFullscreenDisplayChange?: (durationMs: number) => void;
  theme?: Theme;
  onThemeChange?: (theme: Theme) => void;
  /** 配色方案；缺省表示默认墨青 */
  colorTheme?: ColorTheme;
  onColorThemeChange?: (colorTheme: ColorTheme) => void;
  /** 点击关闭时的默认行为；缺省表示后台运行 */
  closeAction?: CloseAction;
  onCloseActionChange?: (closeAction: CloseAction) => void;
  /** 后台运行时是否显示悬浮球；缺省表示显示 */
  showFloatingBall?: boolean;
  onShowFloatingBallChange?: (show: boolean) => void;
  /** 开机自启是否可用（Electron 宿主中可用） */
  canToggleLaunchAtStartup?: boolean;
  /** 开机自启当前状态 */
  launchAtStartup?: boolean;
  onLaunchAtStartupChange?: (enabled: boolean) => void;
  /** 清除本机保存的名单、权重与历史；由上层负责调用主进程并更新界面 */
  onClearLocalData?: () => void | Promise<void>;
  /** 重新选取人员名单：由上层调用主进程导入并更新界面 */
  onImport?: () => void | Promise<void>;
  /** 是否正在导入名单 */
  isImporting?: boolean;
  /** 当前自定义背景图（dataURL）；为空表示使用主题默认背景 */
  backgroundImage?: string;
  /** 选择/清除背景图：传 null 表示恢复默认背景 */
  onBackgroundImageChange?: (dataUrl: string | null) => void;
  /** 保底池设置；缺省表示未启用 */
  pityPool?: { enabled: boolean; studentIds: string[]; threshold: number };
  onPityPoolChange?: (pityPool: { enabled: boolean; studentIds: string[]; threshold: number }) => void;
  /** 保底计数：连续抽取未抽中保底池人物的次数（只读展示） */
  pityCounter?: number;
  /** 结果音效开关；缺省表示关闭 */
  soundEnabled?: boolean;
  onSoundEnabledChange?: (enabled: boolean) => void;
  /** 抽中音效（dataURL）；缺省表示未设置 */
  soundDrawnData?: string;
  /** 抽中保底池人物时的特殊音效（dataURL）；缺省表示沿用普通音效 */
  soundPityData?: string;
  /** 选择/清除抽中音效：传 null 表示清除 */
  onSoundDrawnChange?: (dataUrl: string | null) => void;
  /** 选择/清除保底特殊音效：传 null 表示清除 */
  onSoundPityChange?: (dataUrl: string | null) => void;
  /** 权重预设列表 */
  weightPresets?: WeightPreset[];
  /** 保存当前权重分配为预设 */
  onSaveWeightPreset?: (name: string) => void;
  /** 套用指定预设 */
  onApplyWeightPreset?: (name: string) => void;
  /** 删除指定预设 */
  onDeleteWeightPreset?: (name: string) => void;
  /** 提交学生星级（1-5） */
  onStarChange?: (id: string, star: number) => void;
  /** 品牌自定义设置 */
  branding?: BrandingSettings;
  /** 更新品牌自定义（会实时应用窗口标题与图标） */
  onBrandingChange?: (branding: BrandingSettings) => void;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute('aria-hidden'));
}

/** 把任意输入收敛到 0 - MAX_ANIMATION_DURATION_MS 的整数毫秒 */
function clampAnimationDuration(rawValue: string): number {
  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.min(Math.max(0, Math.round(parsedValue)), MAX_ANIMATION_DURATION_MS);
}

/** 把任意输入收敛到 MIN - MAX 毫秒的整数，避免写出越界停留时长 */
function clampFullscreenDisplay(rawValue: string): number {
  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_FULLSCREEN_DISPLAY_MS;
  }

  return Math.min(
    Math.max(MIN_FULLSCREEN_DISPLAY_MS, Math.round(parsedValue)),
    MAX_FULLSCREEN_DISPLAY_MS,
  );
}

export function SettingsDrawer({
  students,
  onWeightChange,
  onResetWeights,
  onClose,
  history = [],
  onClearHistory = () => undefined,
  disabled = false,
  animationStyle = 'slot',
  onAnimationStyleChange,
  animationDurationMs = 1800,
  onAnimationDurationChange,
  fullscreenDisplayMs = DEFAULT_FULLSCREEN_DISPLAY_MS,
  onFullscreenDisplayChange,
  theme = 'light',
  onThemeChange,
  colorTheme = 'ink',
  onColorThemeChange,
  closeAction = 'background',
  onCloseActionChange,
  showFloatingBall = true,
  onShowFloatingBallChange,
  canToggleLaunchAtStartup = false,
  launchAtStartup = false,
  onLaunchAtStartupChange,
  onClearLocalData,
  onImport,
  isImporting = false,
  backgroundImage,
  onBackgroundImageChange,
  pityPool,
  onPityPoolChange,
  pityCounter = 0,
  soundEnabled = false,
  onSoundEnabledChange,
  soundDrawnData,
  soundPityData,
  onSoundDrawnChange,
  onSoundPityChange,
  weightPresets,
  onSaveWeightPreset,
  onApplyWeightPreset,
  onDeleteWeightPreset,
  onStarChange,
  branding,
  onBrandingChange,
}: SettingsDrawerProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const backgroundFileInputRef = useRef<HTMLInputElement>(null);
  const soundDrawnInputRef = useRef<HTMLInputElement>(null);
  const soundPityInputRef = useRef<HTMLInputElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const cancelClearButtonRef = useRef<HTMLButtonElement>(null);
  const isClearConfirmOpenRef = useRef(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  // 背景图片选择的错误提示：格式不支持 / 文件过大 / 读取失败
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  // 音效选择的错误提示
  const [soundError, setSoundError] = useState<string | null>(null);
  // 音效试听：记录正在播放的 audio 元素，试听新音效前先停掉旧的
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  // 权重预设名称输入草稿
  const [presetNameDraft, setPresetNameDraft] = useState('');
  // 品牌自定义草稿：标题类输入用草稿态，失焦或回车提交并实时应用
  const brandingIconInputRef = useRef<HTMLInputElement>(null);
  const [draftBranding, setDraftBranding] = useState<BrandingSettings>(
    () => branding ?? { ...DEFAULT_BRANDING },
  );

  useEffect(() => {
    if (branding) {
      setDraftBranding(branding);
    }
  }, [branding]);

  /** 提交整个品牌草稿并实时应用 */
  function commitBrandingDraft(): void {
    onBrandingChange?.({ ...draftBranding });
  }

  /** 提交单个品牌字段：空值回退默认文案 */
  function commitBrandingField(field: 'appTitle' | 'windowTitle' | 'productName' | 'menuTitle'): void {
    const rawValue = draftBranding[field];
    const next: BrandingSettings = {
      ...draftBranding,
      [field]: rawValue.trim().length > 0 ? rawValue.trim().slice(0, 30) : DEFAULT_BRANDING[field],
    };
    setDraftBranding(next);
    onBrandingChange?.(next);
  }

  /** 处理品牌图标选择：校验类型与大小后读成 dataURL 并实时应用 */
  function handleBrandingIconChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      setSoundError('暂不支持该格式，请选择 PNG、JPG、WebP、BMP 或 GIF 图片。');
      return;
    }
    if (file.size > MAX_BACKGROUND_FILE_BYTES) {
      setSoundError('图标超过 6MB，请压缩后再选择。');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.length <= MAX_BACKGROUND_IMAGE_LENGTH) {
        const next = { ...draftBranding, iconData: reader.result as string };
        setDraftBranding(next);
        setSoundError(null);
        onBrandingChange?.(next);
      } else {
        setSoundError('图标超过 6MB，请压缩后再选择。');
      }
    };
    reader.onerror = () => {
      setSoundError('图标读取失败，请重试。');
    };
    reader.readAsDataURL(file);
  }
  // 数字输入的纯草稿态：输入过程只保留原文不提交，失焦或回车时一次性收敛
  const [animationDurationDraft, setAnimationDurationDraft] = useState<string | null>(null);
  const [fullscreenDurationDraft, setFullscreenDurationDraft] = useState<string | null>(null);

  /** 收敛动画时长草稿并提交；空串视为放弃修改 */
  function commitAnimationDurationDraft(): void {
    if (animationDurationDraft === null) {
      return;
    }
    const trimmedDraft = animationDurationDraft.trim();
    setAnimationDurationDraft(null);
    if (trimmedDraft !== '' && Number.isFinite(Number(trimmedDraft))) {
      onAnimationDurationChange?.(clampAnimationDuration(trimmedDraft));
    }
  }

  /** 收敛全屏停留时长草稿并提交；空串视为放弃修改 */
  function commitFullscreenDurationDraft(): void {
    if (fullscreenDurationDraft === null) {
      return;
    }
    const trimmedDraft = fullscreenDurationDraft.trim();
    setFullscreenDurationDraft(null);
    if (trimmedDraft !== '' && Number.isFinite(Number(trimmedDraft))) {
      onFullscreenDisplayChange?.(clampFullscreenDisplay(trimmedDraft));
    }
  }

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    isClearConfirmOpenRef.current = isClearConfirmOpen;
  }, [isClearConfirmOpen]);

  // 二次确认弹出后，把焦点交给“取消”，避免误触破坏性操作
  useEffect(() => {
    if (isClearConfirmOpen) {
      cancelClearButtonRef.current?.focus();
    }
  }, [isClearConfirmOpen]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      previousActiveElementRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    closeButtonRef.current?.focus();

    function handleDocumentKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        // 确认框打开时优先关闭确认框，而不是整个设置抽屉
        if (isClearConfirmOpenRef.current) {
          setIsClearConfirmOpen(false);
          return;
        }
        onCloseRef.current();
      }
    }

    document.addEventListener('keydown', handleDocumentKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDocumentKeyDown);
      const previousElement = previousActiveElementRef.current;
      if (previousElement && document.contains(previousElement)) {
        previousElement.focus();
      }
    };
  }, []);

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLElement>): void {
    if (event.key !== 'Tab' || !dialogRef.current) {
      return;
    }

    const focusableElements = getFocusableElements(dialogRef.current);
    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  async function handleConfirmClear(): Promise<void> {
    setIsClearConfirmOpen(false);
    await onClearLocalData?.();
  }

  /** 处理背景图选择：校验类型与大小后读成 dataURL 交给上层保存 */
  function handleBackgroundFileChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    // 重置 input.value，允许下次重复选择同一张图片
    event.target.value = '';
    if (!file) {
      return;
    }

    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      setBackgroundError('暂不支持该格式，请选择 PNG、JPG、WebP、BMP 或 GIF 图片。');
      return;
    }
    if (file.size > MAX_BACKGROUND_FILE_BYTES) {
      setBackgroundError('图片超过 6MB，请压缩后再选择。');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.length <= MAX_BACKGROUND_IMAGE_LENGTH) {
        setBackgroundError(null);
        onBackgroundImageChange?.(reader.result);
      } else {
        setBackgroundError('图片超过 6MB，请压缩后再选择。');
      }
    };
    reader.onerror = () => {
      setBackgroundError('图片读取失败，请重试。');
    };
    reader.readAsDataURL(file);
  }

  /** 播放一段音效（试听用）；连续试听时先停掉上一次播放 */
  function previewSound(dataUrl: string): void {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
    }
    const audio = new Audio(dataUrl);
    audioPreviewRef.current = audio;
    void audio.play().catch(() => undefined);
  }

  /** 处理音效文件选择：校验类型与大小后读成 dataURL 交给上层保存 */
  function handleSoundFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
    onPicked: (dataUrl: string) => void,
  ): void {
    const file = event.target.files?.[0];
    // 重置 input.value，允许下次重复选择同一文件
    event.target.value = '';
    if (!file) {
      return;
    }

    const fileType = file.type || 'audio/mpeg';
    if (!ACCEPTED_AUDIO_TYPES.has(fileType) && !fileType.startsWith('audio/')) {
      setSoundError('暂不支持该格式，请选择 MP3、WAV、OGG 等音频文件。');
      return;
    }
    if (file.size > MAX_SOUND_FILE_BYTES) {
      setSoundError('音频超过 3MB，请裁剪后再选择。');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.length <= MAX_SOUND_DATA_LENGTH) {
        setSoundError(null);
        onPicked(reader.result);
      } else {
        setSoundError('音频超过 3MB，请裁剪后再选择。');
      }
    };
    reader.onerror = () => {
      setSoundError('音频读取失败，请重试。');
    };
    reader.readAsDataURL(file);
  }

  /** 更新保底池设置（保持不可变更新） */
  function updatePityPool(patch: Partial<NonNullable<typeof pityPool>>): void {
    const current = pityPool ?? { enabled: false, studentIds: [] as string[], threshold: 10 };
    onPityPoolChange?.({
      enabled: patch.enabled ?? current.enabled,
      studentIds: patch.studentIds ?? current.studentIds,
      threshold: patch.threshold ?? current.threshold,
    });
  }

  /** 切换某个学生是否属于保底池 */
  function togglePityMember(studentId: string): void {
    const current = pityPool ?? { enabled: false, studentIds: [] as string[], threshold: 10 };
    const studentIds = current.studentIds.includes(studentId)
      ? current.studentIds.filter((id) => id !== studentId)
      : [...current.studentIds, studentId];
    updatePityPool({ studentIds });
  }

  return (
    <div className="settings-drawer" data-testid="settings-drawer">
      <div
        className="settings-drawer__backdrop"
        data-testid="settings-drawer-backdrop"
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        ref={dialogRef}
        className="settings-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-drawer-title"
        onKeyDown={handleDialogKeyDown}
      >
        <div className="settings-drawer__header">
          <div>
            <p className="section-kicker">课堂设置</p>
            <h2 id="settings-drawer-title">设置</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="settings-drawer__close secondary-button"
            aria-label="关闭设置"
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        <div className="settings-drawer__content">
          {/* 动画效果设置区域 */}
          <section className="settings-group" aria-labelledby="animation-settings-title">
            <h3 id="animation-settings-title" className="settings-group-title">
              抽取动画效果
            </h3>
            <div className="settings-field">
              <label htmlFor="animation-style-select">动画样式</label>
              <select
                id="animation-style-select"
                className="settings-select"
                value={animationStyle}
                disabled={disabled}
                onChange={(e) => onAnimationStyleChange?.(e.target.value as AnimationStyle)}
              >
                <option value="slot">大卡片动态滚动（默认推荐）</option>
                <option value="marquee">学生列表跳跃跑马灯</option>
                <option value="spotlight">全屏聚焦弹窗轮播</option>
                <option value="card">抽卡式：点击卡牌翻面揭晓</option>
              </select>
              <small className="settings-field-hint">
                {animationStyle === 'slot' && '卡片区快速翻滚名字，平滑减速定格，大屏视觉冲击力强。'}
                {animationStyle === 'marquee' && '名单卡片高速轮巡高亮跳动，锁定抽中同学。'}
                {animationStyle === 'spotlight' && '自动居中大屏弹窗飞速轮换人名，气场拉满。'}
                {animationStyle === 'card' &&
                  '点击卡牌翻面揭晓，卡面颜色随学生星级变化（白/蓝/紫/红/金）。'}
              </small>
            </div>

            <div className="settings-field">
              <label htmlFor="animation-duration-input">动画时长（毫秒）</label>
              <input
                id="animation-duration-input"
                className="settings-input"
                type="text"
                inputMode="numeric"
                value={animationDurationDraft ?? String(animationDurationMs)}
                disabled={disabled}
                onChange={(e) => setAnimationDurationDraft(e.target.value)}
                onBlur={commitAnimationDurationDraft}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitAnimationDurationDraft();
                  }
                }}
              />
              <small className="settings-field-hint">
                支持 0 - {MAX_ANIMATION_DURATION_MS} 毫秒，数值越大悬念越强。
              </small>
            </div>

            <div className="settings-field">
              <label htmlFor="fullscreen-duration-input">结果全屏停留时长（毫秒）</label>
              <input
                id="fullscreen-duration-input"
                className="settings-input"
                type="text"
                inputMode="numeric"
                value={fullscreenDurationDraft ?? String(fullscreenDisplayMs)}
                disabled={disabled}
                onChange={(e) => setFullscreenDurationDraft(e.target.value)}
                onBlur={commitFullscreenDurationDraft}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitFullscreenDurationDraft();
                  }
                }}
              />
              <small className="settings-field-hint">
                抽取结果自动全屏展示的时长，默认{' '}
                {DEFAULT_FULLSCREEN_DISPLAY_MS / 1000} 秒；支持 {MIN_FULLSCREEN_DISPLAY_MS} -{' '}
                {MAX_FULLSCREEN_DISPLAY_MS} 毫秒。
              </small>
            </div>

            <div className="settings-field">
              <label htmlFor="theme-select">界面主题</label>
              <select
                id="theme-select"
                className="settings-select"
                value={theme}
                disabled={disabled}
                onChange={(e) => onThemeChange?.(e.target.value as Theme)}
              >
                <option value="light">明亮模式</option>
                <option value="dark">深色模式</option>
              </select>
              <small className="settings-field-hint">
                {theme === 'light' && '明亮的课堂投影配色，适合白天与常规教室。'}
                {theme === 'dark' && '深色低眩光配色，适合暗光教室与长时间投屏。'}
              </small>
            </div>

            <div className="settings-field">
              <label htmlFor="color-theme-select">颜色主题</label>
              <select
                id="color-theme-select"
                className="settings-select"
                value={colorTheme}
                disabled={disabled}
                onChange={(e) => onColorThemeChange?.(e.target.value as ColorTheme)}
              >
                {COLOR_THEMES.map((themeName) => (
                  <option key={themeName} value={themeName}>
                    {COLOR_THEME_LABELS[themeName]}
                  </option>
                ))}
              </select>
              <small className="settings-field-hint">
                {colorTheme === 'ink' && '沉稳的墨青主色，纸墨课堂气质。'}
                {colorTheme === 'sunset' && '温暖的赭橙主色，适合轻松活跃的课堂。'}
                {colorTheme === 'meadow' && '清新的草绿主色，自然明亮。'}
                {colorTheme === 'dusk' && '沉静的靛蓝主色，冷静专注。'}
                {colorTheme === 'plum' && '雅致的绛红主色，柔和有活力。'}
              </small>
            </div>
          </section>

          {/* 背景图片设置区域：导入本机图片替换主界面背景 */}
          <section className="settings-group" aria-labelledby="background-settings-title">
            <h3 id="background-settings-title" className="settings-group-title">
              背景图片
            </h3>
            <p className="settings-group-hint">
              选择一张本机图片作为主界面背景，替换默认底色。
            </p>
            {backgroundImage ? (
              <div className="settings-bg-preview">
                <img src={backgroundImage} alt="当前背景图预览" />
                <button
                  type="button"
                  className="secondary-button settings-bg-reset"
                  disabled={disabled}
                  onClick={() => {
                    setBackgroundError(null);
                    onBackgroundImageChange?.(null);
                  }}
                >
                  恢复默认背景
                </button>
              </div>
            ) : null}
            <input
              ref={backgroundFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/bmp,image/gif"
              className="visually-hidden"
              aria-hidden="true"
              tabIndex={-1}
              onChange={handleBackgroundFileChange}
            />
            <button
              type="button"
              className="secondary-button settings-bg-button"
              disabled={disabled}
              onClick={() => backgroundFileInputRef.current?.click()}
            >
              {backgroundImage ? '更换背景图片' : '选择背景图片'}
            </button>
            {backgroundError ? (
              <p className="settings-bg-error" role="alert">
                {backgroundError}
              </p>
            ) : null}
          </section>

          {/* 窗口与启动：关闭行为、悬浮球与开机自启 */}
          <section className="settings-group" aria-labelledby="window-behavior-title">
            <h3 id="window-behavior-title" className="settings-group-title">
              窗口与启动
            </h3>
            <div className="settings-field">
              <label htmlFor="close-action-select">点击关闭时</label>
              <select
                id="close-action-select"
                className="settings-select"
                value={closeAction}
                disabled={disabled}
                onChange={(e) => onCloseActionChange?.(e.target.value as CloseAction)}
              >
                <option value="background">后台运行（推荐）</option>
                <option value="quit">直接退出程序</option>
              </select>
              <small className="settings-field-hint">
                {closeAction === 'background'
                  ? '点击关闭后程序在后台待命，随时可以快速回到课堂界面。'
                  : '点击关闭后程序完全退出。'}
              </small>
            </div>
            <PillSwitch
              checked={showFloatingBall}
              disabled={disabled || closeAction !== 'background'}
              label="后台运行时显示悬浮球"
              ariaLabel="后台运行时显示悬浮球"
              description={
                showFloatingBall
                  ? '缩到后台时在屏幕右上角显示悬浮球，点击即可一键回到主界面。'
                  : '缩到后台时不显示悬浮球，再次打开应用即可回到主界面。'
              }
              onChange={onShowFloatingBallChange}
            />
            <PillSwitch
              checked={launchAtStartup}
              disabled={disabled || !canToggleLaunchAtStartup}
              label="开机自启"
              ariaLabel="开机自启"
              description={
                canToggleLaunchAtStartup
                  ? '登录 Windows 时自动启动名字抽取器，课前准备更省心。'
                  : '当前环境不支持设置开机自启。'
              }
              onChange={onLaunchAtStartupChange}
            />
          </section>

          {/* 保底池：指定保底成员与必中阈值，避免关键人物长期抽不到 */}
          <section className="settings-group" aria-labelledby="pity-pool-title">
            <h3 id="pity-pool-title" className="settings-group-title">
              保底池
            </h3>
            <PillSwitch
              checked={pityPool?.enabled ?? false}
              disabled={disabled || students.length === 0}
              label="启用保底池"
              ariaLabel="启用保底池"
              description={
                pityPool?.enabled
                  ? '连续抽取达到保底次数仍未抽中保底池成员时，下一次抽取必定抽中。'
                  : '开启后可从名单中挑选重点关注的同学组成保底池。'
              }
              onChange={(enabled) => updatePityPool({ enabled })}
            />
            {pityPool?.enabled ? (
              <>
                <div className="settings-field">
                  <label htmlFor="pity-threshold-input">保底次数</label>
                  <input
                    id="pity-threshold-input"
                    className="settings-input"
                    type="text"
                    inputMode="numeric"
                    value={String(pityPool.threshold)}
                    disabled={disabled}
                    onChange={(event) => {
                      const parsed = Number(event.target.value);
                      if (Number.isFinite(parsed) && parsed >= 1) {
                        updatePityPool({
                          threshold: Math.min(Math.round(parsed), MAX_PITY_THRESHOLD),
                        });
                      }
                    }}
                  />
                  <small className="settings-field-hint">
                    连续 {pityPool.threshold} 次未抽中保底池成员后，下一次抽取必定抽中（1 -{' '}
                    {MAX_PITY_THRESHOLD} 次）。
                  </small>
                </div>
                <p className="settings-group-hint" aria-live="polite">
                  已连续 {pityCounter} 次未抽中保底池成员
                  {pityCounter >= pityPool.threshold ? '，下一次抽取必定抽中！' : ''}；已选{' '}
                  {pityPool.studentIds.length} 人。
                </p>
                <ul className="pity-pool-list" aria-label="选择保底池成员">
                  {students.map((student) => {
                    const isMember = pityPool.studentIds.includes(student.id);
                    return (
                      <li key={student.id}>
                        <button
                          type="button"
                          className={`pity-pool-member${isMember ? ' pity-pool-member--on' : ''}`}
                          disabled={disabled}
                          aria-pressed={isMember}
                          onClick={() => togglePityMember(student.id)}
                        >
                          {student.name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}
          </section>

          {/* 音效：抽取结束后播放，抽中保底池成员可配特殊音效 */}
          <section className="settings-group" aria-labelledby="sound-settings-title">
            <h3 id="sound-settings-title" className="settings-group-title">
              抽取音效
            </h3>
            <PillSwitch
              checked={soundEnabled}
              disabled={disabled}
              label="抽取结束后播放音效"
              ariaLabel="抽取结束后播放音效"
              description={
                soundEnabled
                  ? '名字定格时播放音效；抽中保底池成员时播放特殊音效。'
                  : '开启后可为抽中与保底时刻分别设置提示音。'
              }
              onChange={onSoundEnabledChange}
            />
            {soundEnabled ? (
              <>
                <div className="sound-picker-row">
                  <span className="sound-picker-label">抽中音效</span>
                  <input
                    ref={soundDrawnInputRef}
                    type="file"
                    accept="audio/*"
                    className="visually-hidden"
                    aria-hidden="true"
                    tabIndex={-1}
                    onChange={(event) =>
                      handleSoundFileChange(event, (dataUrl) => onSoundDrawnChange?.(dataUrl))
                    }
                  />
                  <button
                    type="button"
                    className="secondary-button sound-picker-button"
                    disabled={disabled}
                    onClick={() => soundDrawnInputRef.current?.click()}
                  >
                    {soundDrawnData ? '更换' : '选择文件'}
                  </button>
                  {soundDrawnData ? (
                    <>
                      <button
                        type="button"
                        className="secondary-button sound-picker-button"
                        disabled={disabled}
                        onClick={() => previewSound(soundDrawnData)}
                      >
                        试听
                      </button>
                      <button
                        type="button"
                        className="secondary-button sound-picker-button"
                        disabled={disabled}
                        onClick={() => onSoundDrawnChange?.(null)}
                      >
                        清除
                      </button>
                    </>
                  ) : (
                    <small className="sound-picker-status">未设置</small>
                  )}
                </div>
                <div className="sound-picker-row">
                  <span className="sound-picker-label">保底音效</span>
                  <input
                    ref={soundPityInputRef}
                    type="file"
                    accept="audio/*"
                    className="visually-hidden"
                    aria-hidden="true"
                    tabIndex={-1}
                    onChange={(event) =>
                      handleSoundFileChange(event, (dataUrl) => onSoundPityChange?.(dataUrl))
                    }
                  />
                  <button
                    type="button"
                    className="secondary-button sound-picker-button"
                    disabled={disabled}
                    onClick={() => soundPityInputRef.current?.click()}
                  >
                    {soundPityData ? '更换' : '选择文件'}
                  </button>
                  {soundPityData ? (
                    <>
                      <button
                        type="button"
                        className="secondary-button sound-picker-button"
                        disabled={disabled}
                        onClick={() => previewSound(soundPityData)}
                      >
                        试听
                      </button>
                      <button
                        type="button"
                        className="secondary-button sound-picker-button"
                        disabled={disabled}
                        onClick={() => onSoundPityChange?.(null)}
                      >
                        清除
                      </button>
                    </>
                  ) : (
                    <small className="sound-picker-status">未设置（沿用抽中音效）</small>
                  )}
                </div>
                {soundError ? (
                  <p className="settings-bg-error" role="alert">
                    {soundError}
                  </p>
                ) : null}
                <small className="settings-field-hint">
                  支持 MP3、WAV、OGG 等常见音频，3MB 以内；音效随名单保存在本机。
                </small>
              </>
            ) : null}
          </section>

          <StudentWeightList
            students={students}
            onWeightChange={onWeightChange}
            disabled={disabled}
            weightPresets={weightPresets}
            onApplyWeightPreset={onApplyWeightPreset}
            onDeleteWeightPreset={onDeleteWeightPreset}
            onStarChange={onStarChange}
          />

          {/* 权重预设：保存当前权重分配方案，随时套用 */}
          <section className="settings-group" aria-labelledby="weight-preset-title">
            <h3 id="weight-preset-title" className="settings-group-title">
              权重预设
            </h3>
            {weightPresets && weightPresets.length > 0 ? (
              <div className="settings-field">
                <label htmlFor="weight-preset-select">已保存的预设</label>
                <div className="weight-preset-row">
                  <select
                    id="weight-preset-select"
                    className="settings-select"
                    disabled={disabled}
                    defaultValue=""
                    onChange={(event) => {
                      const name = event.target.value;
                      if (name) {
                        onApplyWeightPreset?.(name);
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
                        'weight-preset-select',
                      ) as HTMLSelectElement | null;
                      const name = select?.value;
                      if (name) {
                        onDeleteWeightPreset?.(name);
                      }
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
            ) : (
              <p className="settings-group-hint">还没有保存预设。</p>
            )}
            <div className="settings-field">
              <label htmlFor="weight-preset-name">保存当前权重为预设</label>
              <div className="weight-preset-row">
                <input
                  id="weight-preset-name"
                  className="settings-input"
                  type="text"
                  placeholder="例如：分组提问、重点关照"
                  value={presetNameDraft}
                  disabled={disabled || students.length === 0}
                  maxLength={30}
                  onChange={(event) => setPresetNameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      const name = presetNameDraft.trim();
                      if (name) {
                        onSaveWeightPreset?.(name);
                        setPresetNameDraft('');
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  className="secondary-button weight-preset-save"
                  disabled={disabled || students.length === 0 || presetNameDraft.trim() === ''}
                  onClick={() => {
                    const name = presetNameDraft.trim();
                    if (name) {
                      onSaveWeightPreset?.(name);
                      setPresetNameDraft('');
                    }
                  }}
                >
                  保存预设
                </button>
              </div>
              <small className="settings-field-hint">
                预设按学生记录权重比例，保存在本机，换名单后同名的同学会套用对应权重。
              </small>
            </div>
          </section>

          {/* 品牌自定义：主界面标题、窗口标题、程序名字、标题栏文字与图标 */}
          <section className="settings-group" aria-labelledby="branding-title">
            <h3 id="branding-title" className="settings-group-title">
              个性化
            </h3>
            <p className="settings-group-hint">
              自定义应用各处显示的名称与图标；留空使用默认值。
            </p>
            {(['appTitle', 'windowTitle', 'productName', 'menuTitle'] as const).map((field) => (
              <div className="settings-field" key={field}>
                <label htmlFor={`branding-${field}`}>
                  {field === 'appTitle' && '主界面标题'}
                  {field === 'windowTitle' && '窗口标题（进程标题）'}
                  {field === 'productName' && '程序名字'}
                  {field === 'menuTitle' && '标题栏文字'}
                </label>
                <input
                  id={`branding-${field}`}
                  className="settings-input"
                  type="text"
                  maxLength={30}
                  value={draftBranding[field]}
                  disabled={disabled}
                  placeholder={DEFAULT_BRANDING[field]}
                  onChange={(event) =>
                    setDraftBranding((current) => ({
                      ...current,
                      [field]: event.target.value,
                    }))
                  }
                  onBlur={() => commitBrandingField(field)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitBrandingField(field);
                    }
                  }}
                />
              </div>
            ))}
            <div className="settings-field">
              <span className="settings-search-label">程序图标（窗口图标）</span>
              <input
                ref={brandingIconInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/bmp,image/gif"
                className="visually-hidden"
                aria-hidden="true"
                tabIndex={-1}
                onChange={handleBrandingIconChange}
              />
              <div className="weight-preset-row">
                <button
                  type="button"
                  className="secondary-button weight-preset-save"
                  disabled={disabled}
                  onClick={() => brandingIconInputRef.current?.click()}
                >
                  {draftBranding.iconData ? '更换图标' : '选择图标'}
                </button>
                {draftBranding.iconData ? (
                  <>
                    <img
                      className="branding-icon-preview"
                      src={draftBranding.iconData}
                      alt="图标预览"
                    />
                    <button
                      type="button"
                      className="secondary-button weight-preset-delete"
                      disabled={disabled}
                      onClick={() => {
                        setDraftBranding((current) => ({ ...current, iconData: undefined }));
                        commitBrandingDraft();
                      }}
                    >
                      恢复默认
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              className="secondary-button settings-reset-button"
              disabled={disabled}
              onClick={() => {
                setDraftBranding({ ...DEFAULT_BRANDING });
                onBrandingChange?.({ ...DEFAULT_BRANDING });
              }}
            >
              恢复默认品牌
            </button>
          </section>

          <button
            type="button"
            className="secondary-button settings-reset-button"
            disabled={disabled || students.length === 0}
            onClick={onResetWeights}
          >
            恢复默认权重
          </button>
          <HistoryPanel
            history={history}
            disabled={disabled}
            onClearHistory={onClearHistory}
          />

          {/* 名单管理区域：重新选取人员名单入口从主界面移到这里 */}
          <section className="settings-group" aria-labelledby="roster-management-title">
            <h3 id="roster-management-title" className="settings-group-title">
              名单管理
            </h3>
            <p className="settings-group-hint">
              支持 TXT、CSV 和 XLSX 文件；重新选取名单会开始新一轮课堂抽取，并清空抽取历史。
            </p>
            <button
              type="button"
              className="secondary-button settings-import-button"
              disabled={disabled || isImporting}
              onClick={() => void onImport?.()}
            >
              {isImporting ? '正在导入…' : '重新选取人员名单'}
            </button>
          </section>

          {/* 本机数据管理区域 */}
          <section className="settings-group settings-group--danger" aria-labelledby="local-data-title">
            <h3 id="local-data-title" className="settings-group-title">
              本机数据
            </h3>
            <p className="settings-group-hint">
              名单、权重和抽取历史只保存在本机，清除后无法恢复。
            </p>
            <button
              type="button"
              className="danger-button settings-clear-button"
              disabled={disabled}
              onClick={() => setIsClearConfirmOpen(true)}
            >
              清除本机数据
            </button>
          </section>
        </div>
      </aside>

      {isClearConfirmOpen ? (
        <div className="confirm-overlay">
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label="确认清除本机数据"
          >
            <h4 className="confirm-dialog__title">确认清除本机数据</h4>
            <p className="confirm-dialog__description">
              将删除本机保存的名单、权重和抽取历史，操作无法撤销。
            </p>
            <div className="confirm-dialog__actions">
              <button
                ref={cancelClearButtonRef}
                type="button"
                className="secondary-button"
                onClick={() => setIsClearConfirmOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => void handleConfirmClear()}
              >
                确认清除本机数据
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
