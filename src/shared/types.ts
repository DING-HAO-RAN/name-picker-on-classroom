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

export interface AppSettings {
  animationEnabled: boolean;
  animationDurationMs: number;
  theme: 'light';
}

export interface RosterState {
  sourceName: string;
  students: StudentRecord[];
  history: DrawHistoryItem[];
  settings: AppSettings;
}
