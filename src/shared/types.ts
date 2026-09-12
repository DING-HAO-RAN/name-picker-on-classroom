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

export interface StudentRecord {
  id: string;
  name: string;
  weight: number;
  drawnThisRound: boolean;
}

export interface DrawHistoryItem {
  id: string;
  drawnAt: string;
  studentNames: string[];
}

// 抽取动画样式：slot 大卡片滚动 | marquee 名单跳跃跑马灯 | spotlight 全屏聚焦弹窗轮播
export type AnimationStyle = 'slot' | 'marquee' | 'spotlight';

// 界面主题：light 明亮模式 | dark 深色模式
export type Theme = 'light' | 'dark';

// 颜色主题（配色方案）：ink 墨青（默认）| sunset 暖阳 | meadow 青禾 | dusk 黛蓝 | plum 绛霞
// 每个主题同时替换主色与界面纸感底色，而不只是强调色
export type ColorTheme = 'ink' | 'sunset' | 'meadow' | 'dusk' | 'plum';

export const COLOR_THEMES: ColorTheme[] = ['ink', 'sunset', 'meadow', 'dusk', 'plum'];

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
}

export interface RosterState {
  sourceName: string;
  students: StudentRecord[];
  history: DrawHistoryItem[];
  settings: AppSettings;
}
