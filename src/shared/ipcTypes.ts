import type { RosterState, StudentRecord } from './types';

export const IPC_CHANNELS = {
  importRoster: 'name-picker:import-roster',
  loadState: 'name-picker:load-state',
  saveState: 'name-picker:save-state',
  clearState: 'name-picker:clear-state',
  windowControl: 'name-picker:window-control',
  windowMaximizedChanged: 'name-picker:window-maximized-changed',
  floatingControl: 'name-picker:floating-control',
} as const;

export interface ImportResult {
  sourceName: string;
  students: StudentRecord[];
}

/** 自绘标题栏可以请求的窗口操作，主进程只接受这组固定取值 */
export type WindowControlAction = 'minimize' | 'toggle-maximize' | 'close' | 'get-maximized';

/** 悬浮球可以请求的操作：恢复主界面、弹出右键菜单、真正退出、拖动移动位置 */
export type FloatingControlAction = 'restore' | 'menu' | 'quit' | 'move';

export interface FloatingControlsApi {
  /** move 时 payload 为 { x, y }（屏幕坐标，球心对准该点） */
  control(action: FloatingControlAction, payload?: { x?: number; y?: number }): Promise<void>;
}

export interface WindowControlsApi {
  minimize(): Promise<void>;
  /** 最大化与还原之间切换 */
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  /** 订阅最大化状态变化（含系统双击标题栏触发的变更），返回取消订阅函数 */
  onMaximizedChange(listener: (isMaximized: boolean) => void): () => void;
}

export interface SerializedIpcError {
  code: string;
  message: string;
}

export interface IpcSuccessEnvelope<T> {
  ok: true;
  data: T;
}

export interface IpcFailureEnvelope {
  ok: false;
  error: SerializedIpcError;
}

export type IpcResponse<T> = IpcSuccessEnvelope<T> | IpcFailureEnvelope;

export interface NamePickerApi {
  importRoster(): Promise<ImportResult>;
  loadState(): Promise<RosterState | null>;
  saveState(state: RosterState): Promise<void>;
  clearState(): Promise<void>;
  /** 自绘标题栏窗口控制；仅在 Electron 宿主中存在 */
  windowControls?: WindowControlsApi;
  /** 悬浮球控制；仅在悬浮球窗口（?window=floating）中存在 */
  floatingControls?: FloatingControlsApi;
}
