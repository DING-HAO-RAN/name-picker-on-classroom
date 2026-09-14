export const MAX_HISTORY_ITEMS = 50;

// 动画时长上限（毫秒）：渲染器、主进程校验与本地存储共用同一边界
export const MAX_ANIMATION_DURATION_MS = 5000;

// 抽取结果全屏停留时长（毫秒）：默认 3 秒，可在设置中调整
export const DEFAULT_FULLSCREEN_DISPLAY_MS = 3000;
export const MIN_FULLSCREEN_DISPLAY_MS = 1500;
export const MAX_FULLSCREEN_DISPLAY_MS = 10000;

// 旧版本把它固定为 1000 毫秒且不对外开放。新的可选范围从 1500 毫秒起，
// 因此 1000 只可能来自历史存档，不会和用户主动选择的值冲突，可安全迁移。
export const LEGACY_FULLSCREEN_DISPLAY_MS = 1000;

// 自定义背景图（dataURL）的字符长度上限：约对应 6MB 原图，
// 避免单张超大图片把本机状态文件无限撑大
export const MAX_BACKGROUND_IMAGE_LENGTH = 8_000_000;

// 音效文件（dataURL）的字符长度上限：约对应 3MB 音频
export const MAX_SOUND_DATA_LENGTH = 4_000_000;

// 保底次数上限：达到该次数后下一次抽取必中保底池
export const MAX_PITY_THRESHOLD = 999;

// 权重显示标度：内部 weight 存 0-1 相对权重，界面以 0-100 百分比显示（weight × 100）
export const MAX_WEIGHT_PERCENT = 100;

/** 保底池设置：从名单中选出的「保底成员」与必中阈值 */
export interface PityPoolSettings {
  enabled: boolean;
  /** 保底池成员的学生 id 列表 */
  studentIds: string[];
  /** 保底次数：连续未抽中保底池人物达到该次数后，下一次抽取必中保底池 */
  threshold: number;
}

/** 权重预设：保存一份按学生 id 记录的权重百分比方案，可随时套用 */
export interface WeightPreset {
  name: string;
  /** 学生 id -> 权重百分比（0-100） */
  weights: Record<string, number>;
}

/** 品牌自定义：应用各处显示的名称与图标 */
export interface BrandingSettings {
  /** 主界面头部标题 */
  appTitle: string;
  /** 窗口（进程）标题：任务栏与窗口管理器显示 */
  windowTitle: string;
  /** 程序名字：关于与界面中的产品名 */
  productName: string;
  /** 顶部标题栏文字 */
  menuTitle: string;
  /** 应用图标（dataURL）；作用于窗口图标，改动 exe 内置图标需重新打包 */
  iconData?: string;
}

export const DEFAULT_BRANDING: BrandingSettings = {
  appTitle: '名字抽取器',
  windowTitle: '名字抽取器',
  productName: '名字抽取器',
  menuTitle: '名字抽取器',
};

export interface StudentRecord {
  id: string;
  name: string;
  weight: number;
  drawnThisRound: boolean;
  /** 星级（1-5）：1 白 | 2 蓝 | 3 紫 | 4 红 | 5 金；抽卡卡面颜色随星级变化 */
  star: number;
  /** 累计被抽中次数：每满 5 次自动升 1 星，最高升到 4 星 */
  drawCount: number;
}

export interface DrawHistoryItem {
  id: string;
  drawnAt: string;
  studentNames: string[];
}

// 抽取动画样式：slot 大卡片滚动 | marquee 名单跳跃跑马灯 | spotlight 全屏聚焦弹窗轮播 | card 抽卡翻面
export type AnimationStyle = 'slot' | 'marquee' | 'spotlight' | 'card';

// 界面主题：light 明亮模式 | dark 深色模式
export type Theme = 'light' | 'dark';

// 颜色主题（配色方案）：ink 墨青（默认）| sunset 暖阳 | meadow 青禾 | dusk 黛蓝 | plum 绛霞
// 每个主题同时替换主色与界面纸感底色，而不只是强调色
export type ColorTheme = 'ink' | 'sunset' | 'meadow' | 'dusk' | 'plum';

export const COLOR_THEMES: ColorTheme[] = ['ink', 'sunset', 'meadow', 'dusk', 'plum'];

// 点击关闭按钮时的默认行为：background 缩到后台（默认）| quit 直接退出
export type CloseAction = 'background' | 'quit';

export const CLOSE_ACTIONS: CloseAction[] = ['background', 'quit'];

export interface AppSettings {
  animationEnabled: boolean;
  animationDurationMs: number;
  animationStyle?: AnimationStyle;
  allowDuplicates?: boolean;
  fullscreenDisplayMs?: number;
  theme: Theme;
  /** 配色方案；缺省表示默认墨青 */
  colorTheme?: ColorTheme;
  /** 主界面自定义背景图（dataURL）；缺省表示使用主题默认背景 */
  backgroundImage?: string;
  /** 点击关闭时的默认行为；缺省表示缩到后台运行 */
  closeAction?: CloseAction;
  /** 后台运行时是否显示悬浮球；缺省表示显示 */
  showFloatingBall?: boolean;
  /** 开机自启（UI 回显用，实际生效由主进程登录项管理） */
  launchAtStartup?: boolean;
  /** 保底池设置；缺省表示未启用 */
  pityPool?: PityPoolSettings;
  /** 保底计数：连续抽取未抽中保底池人物的次数（随存档持久化） */
  pityCounter?: number;
  /** 结果音效开关；缺省表示关闭 */
  soundEnabled?: boolean;
  /** 抽中音效（dataURL）；缺省表示未设置 */
  soundDrawnData?: string;
  /** 抽中保底池人物时的特殊音效（dataURL）；缺省时沿用普通抽中音效 */
  soundPityData?: string;
  /** 权重预设列表；缺省表示还没有保存预设 */
  weightPresets?: WeightPreset[];
  /** 品牌自定义；缺省全部使用默认文案与图标 */
  branding?: BrandingSettings;
}

export interface RosterState {
  sourceName: string;
  students: StudentRecord[];
  history: DrawHistoryItem[];
  settings: AppSettings;
}
