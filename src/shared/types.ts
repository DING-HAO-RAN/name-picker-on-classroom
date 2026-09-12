export const MAX_HISTORY_ITEMS = 50;

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

export interface AppSettings {
  animationEnabled: boolean;
  animationDurationMs: number;
  animationStyle?: AnimationStyle;
  allowDuplicates?: boolean;
  fullscreenDisplayMs?: number;
  theme: 'light';
}

export interface RosterState {
  sourceName: string;
  students: StudentRecord[];
  history: DrawHistoryItem[];
  settings: AppSettings;
}
