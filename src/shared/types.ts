export const MAX_HISTORY_ITEMS = 50;

// 动画时长上限（毫秒）：渲染器、主进程校验与本地存储共用同一边界
export const MAX_ANIMATION_DURATION_MS = 5000;

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

export interface AppSettings {
  animationEnabled: boolean;
  animationDurationMs: number;
  animationStyle?: AnimationStyle;
  allowDuplicates?: boolean;
  fullscreenDisplayMs?: number;
  theme: Theme;
}

export interface RosterState {
  sourceName: string;
  students: StudentRecord[];
  history: DrawHistoryItem[];
  settings: AppSettings;
}
