import type { RosterState, StudentRecord } from './types';

export const IPC_CHANNELS = {
  importRoster: 'name-picker:import-roster',
  loadState: 'name-picker:load-state',
  saveState: 'name-picker:save-state',
  clearState: 'name-picker:clear-state',
  windowControl: 'name-picker:window-control',
  windowMaximizedChanged: 'name-picker:window-maximized-changed',
  floatingControl: 'name-picker:floating-control',
  launchSettings: 'name-picker:launch-settings',
} as const;

export interface ImportResult {
  sourceName: string;
  students: StudentRecord[];
}

/** 自绘标题栏可以请求的窗口操作，主进程只接受这组固定取值 */
export type WindowControlAction = 'minimize' | 'toggle-maximize' | 'close' | 'get-maximized';

/**
 * 悬浮球可以请求的操作：
 * - restore 恢复主界面 / menu 右键菜单 / quit 退出
 * - drag-start / drag-move / drag-end：指针拖动三段式，
 *   坐标全部由主进程 getCursorScreenPoint 提供（DIP，兼容 DPI 缩放与触控）
 */
export type FloatingControlAction =
  | 'restore'
  | 'menu'
  | 'quit'
  | 'drag-start'
  | 'drag-move'
  | 'drag-end';

export interface FloatingControlsApi {
  control(action: FloatingControlAction): Promise<void>;
}

/** 开机自启设置：读取/写入系统登录启动项 */
export interface LaunchSettingsApi {
  getCurrent(): Promise<boolean>;
  setEnabled(enabled: boolean): Promise<void>;
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
  /** 开机自启设置；仅在 Electron 宿主中存在 */
  launchSettings?: LaunchSettingsApi;
}
