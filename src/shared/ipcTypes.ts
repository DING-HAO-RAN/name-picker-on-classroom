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
  branding: 'name-picker:branding',
  syncStars: 'name-picker:sync-stars',
} as const;

export interface ImportResult {
  sourceName: string;
  /** 名单文件完整路径（导入时记录），用于星级改动同步回写 */
  sourcePath?: string;
  students: StudentRecord[];
}

/** 自绘标题栏可以请求的窗口操作，主进程只接受这组固定取值 */
export type WindowControlAction = 'minimize' | 'toggle-maximize' | 'close' | 'get-maximized';

/**
 * 悬浮球可以请求的操作：
 * - restore 恢复主界面 / menu 右键菜单 / quit 退出
 * - drag-move：payload { dx, dy }（自上次上报以来指针移动的增量）。
 *   Chromium 的 screenX/Y 与 setPosition 同为 DIP 逻辑像素，增量直接使用，
 *   鼠标与触控统一；不走 rAF（透明窗口可能被 Chromium 误判遮挡而暂停 rAF）
 */
export type FloatingControlAction =
  | 'restore'
  | 'menu'
  | 'quit'
  | 'drag-start'
  | 'drag-move'
  | 'drag-end';

export interface FloatingDragPayload {
  dx?: number;
  dy?: number;
}

export interface FloatingControlsApi {
  control(action: FloatingControlAction, payload?: FloatingDragPayload): Promise<void>;
}

/** 开机自启设置：读取/写入系统登录启动项 */
export interface LaunchSettingsApi {
  getCurrent(): Promise<boolean>;
  setEnabled(enabled: boolean): Promise<void>;
}

/** 品牌自定义：应用到窗口标题与窗口图标 */
export interface BrandingControlsApi {
  apply(branding: { windowTitle?: string; iconData?: string }): Promise<void>;
}

/** 星级回写：把设置里改动的星级同步回名单源文件（失败静默忽略） */
export interface StarSyncApi {
  sync(sourcePath: string, entries: { name: string; star: number }[]): Promise<void>;
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
  /** 品牌自定义；仅在 Electron 宿主中存在 */
  brandingControls?: BrandingControlsApi;
  /** 星级回写；仅在 Electron 宿主中存在 */
  starSync?: StarSyncApi;
}
