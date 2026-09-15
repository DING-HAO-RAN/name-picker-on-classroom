import { basename, extname, win32 } from 'node:path';
import type { OpenDialogOptions } from 'electron';
import {
  IPC_CHANNELS,
  type ImportResult,
  type IpcFailureEnvelope,
  type IpcResponse,
  type SerializedIpcError,
  type WindowControlAction,
} from '../shared/ipcTypes';
import {
  COLOR_THEMES,
  DEFAULT_BRANDING,
  MAX_ANIMATION_DURATION_MS,
  MAX_BACKGROUND_IMAGE_LENGTH,
  MAX_FULLSCREEN_DISPLAY_MS,
  MAX_PITY_THRESHOLD,
  MAX_SOUND_DATA_LENGTH,
  MIN_FULLSCREEN_DISPLAY_MS,
  type RosterState,
  type StudentRecord,
} from '../shared/types';

export interface OpenDialogResult {
  canceled: boolean;
  filePaths: string[];
}

export type ShowOpenDialog = (options: OpenDialogOptions) => Promise<OpenDialogResult>;

/** 主进程窗口控制能力：由 main 进程绑定到真实 BrowserWindow */
export interface IpcWindowControls {
  minimize(): void;
  toggleMaximize(): void;
  close(): void;
  isMaximized(): boolean;
}

/** 开机自启能力：由 main 进程绑定到 app 登录项 */
export interface IpcLaunchControls {
  getCurrent(): boolean;
  setEnabled(enabled: boolean): void;
}

/** 品牌自定义能力：由 main 进程绑定到窗口标题与图标 */
export interface IpcBrandingControls {
  apply(branding: { windowTitle?: string; iconData?: string }): void;
}

export interface IpcHandlerDependencies {
  showOpenDialog: ShowOpenDialog;
  importRoster: (filePath: string) => Promise<ImportResult>;
  store: {
    load: () => Promise<unknown | null>;
    save: (state: RosterState) => Promise<void>;
    clear: () => Promise<void>;
  };
  windowControls?: IpcWindowControls;
  launchControls?: IpcLaunchControls;
  brandingControls?: IpcBrandingControls;
  starSyncControls?: {
    sync(sourcePath: string, entries: { name: string; star: number }[]): Promise<void> | void;
  };
}

export interface IpcHandlers {
  importRoster(): Promise<ImportResult>;
  loadState(): Promise<RosterState | null>;
  saveState(state: unknown): Promise<void>;
  clearState(): Promise<void>;
  /** 执行窗口操作并返回操作后的最大化状态 */
  windowControl(action: unknown): Promise<boolean>;
  /** 读取/设置开机自启；set 时 payload 为 { enabled } */
  launchSettings(action: unknown, payload?: unknown): Promise<boolean>;
  /** 应用品牌自定义：窗口标题与窗口图标 */
  applyBranding(payload: unknown): Promise<void>;
  /** 把星级改动同步回名单源文件（失败静默） */
  syncStars(payload: unknown): Promise<void>;
}

export interface IpcMainLike {
  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void;
}

export const ROSTER_FILE_DIALOG_OPTIONS: OpenDialogOptions = {
  properties: ['openFile'],
  filters: [{ name: '名单文件', extensions: ['txt', 'csv', 'xlsx'] }],
};

const ERROR_MESSAGES = {
  READ_FAILED: '名单文件读取失败。',
  PARSE_FAILED: '名单文件解析失败。',
  UNSUPPORTED_FORMAT: '不支持的名单文件格式。',
  EMPTY_FILE: '名单文件为空。',
  STORAGE_READ_FAILED: '本地名单读取失败。',
  STORAGE_PARSE_FAILED: '本地名单数据损坏。',
  STORAGE_WRITE_FAILED: '本地名单保存失败。',
  STORAGE_CLEAR_FAILED: '本地名单清除失败。',
  IMPORT_CANCELLED: '已取消导入。',
  FILE_DIALOG_FAILED: '文件选择失败。',
  INVALID_STATE: '名单状态数据无效。',
  UNAUTHORIZED_SENDER: '未授权的调用来源。',
  INVALID_WINDOW_ACTION: '不支持的窗口操作。',
  INTERNAL_ERROR: '操作失败。',
} as const;

const FALLBACK_ERROR_MESSAGES = {
  IMPORT_CANCELLED: ERROR_MESSAGES.IMPORT_CANCELLED,
  FILE_DIALOG_FAILED: ERROR_MESSAGES.FILE_DIALOG_FAILED,
  INTERNAL_ERROR: ERROR_MESSAGES.INTERNAL_ERROR,
} as const;

const SUPPORTED_ROSTER_EXTENSIONS = new Set(['.txt', '.csv', '.xlsx']);
const TRUSTED_DEV_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

type UnknownRecord = Record<string, unknown>;

type KnownErrorCode = keyof typeof ERROR_MESSAGES;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(record: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isKnownErrorCode(code: string): code is KnownErrorCode {
  return Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, code);
}

function getErrorCode(error: unknown): string | undefined {
  if (!isRecord(error) || !hasOwn(error, 'code')) {
    return undefined;
  }

  return typeof error.code === 'string' ? error.code : undefined;
}

export function serializeIpcError(
  error: unknown,
  fallbackCode: keyof typeof FALLBACK_ERROR_MESSAGES = 'INTERNAL_ERROR',
): SerializedIpcError {
  const code = getErrorCode(error);
  if (code !== undefined && isKnownErrorCode(code)) {
    return { code, message: ERROR_MESSAGES[code] };
  }

  return { code: fallbackCode, message: FALLBACK_ERROR_MESSAGES[fallbackCode] };
}

function cancellationError(): SerializedIpcError {
  return { code: 'IMPORT_CANCELLED', message: ERROR_MESSAGES.IMPORT_CANCELLED };
}

function invalidStateError(): SerializedIpcError {
  return { code: 'INVALID_STATE', message: ERROR_MESSAGES.INVALID_STATE };
}

function unsupportedFormatError(): SerializedIpcError {
  return { code: 'UNSUPPORTED_FORMAT', message: ERROR_MESSAGES.UNSUPPORTED_FORMAT };
}

function invalidWindowActionError(): SerializedIpcError {
  return { code: 'INVALID_WINDOW_ACTION', message: ERROR_MESSAGES.INVALID_WINDOW_ACTION };
}

const WINDOW_CONTROL_ACTIONS = new Set<WindowControlAction>([
  'minimize',
  'toggle-maximize',
  'close',
  'get-maximized',
]);

function isWindowControlAction(value: unknown): value is WindowControlAction {
  return typeof value === 'string' && WINDOW_CONTROL_ACTIONS.has(value as WindowControlAction);
}

function normalizeRequiredString(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  return value;
}

function normalizeSourceName(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  const sourceName = basename(win32.basename(value.trim()));
  if (sourceName.length === 0 || sourceName === '.' || sourceName === '..') {
    return undefined;
  }

  return sourceName;
}

function normalizeStudentRecord(value: unknown): StudentRecord | undefined {
  if (
    !isRecord(value) ||
    !hasOwn(value, 'id') ||
    !hasOwn(value, 'name') ||
    !hasOwn(value, 'weight') ||
    !hasOwn(value, 'drawnThisRound')
  ) {
    return undefined;
  }

  const id = normalizeRequiredString(value.id);
  const name = normalizeRequiredString(value.name);
  if (
    id === undefined ||
    name === undefined ||
    typeof value.weight !== 'number' ||
    !Number.isFinite(value.weight) ||
    value.weight < 0 ||
    typeof value.drawnThisRound !== 'boolean'
  ) {
    return undefined;
  }

  return {
    id,
    name,
    // 权重统一收敛到 0-1（界面以 0-100 百分比显示）；旧存档里大于 1 的值一次性收敛到 1
    weight: Math.min(value.weight, 1),
    drawnThisRound: value.drawnThisRound,
    // 星级：1-5，缺省或非法时回到默认 1 星
    star:
      typeof value.star === 'number' &&
      Number.isInteger(value.star) &&
      value.star >= 1 &&
      value.star <= 5
        ? value.star
        : 1,
    // 抽取计数：非负整数，缺省 0
    drawCount:
      typeof value.drawCount === 'number' &&
      Number.isInteger(value.drawCount) &&
      value.drawCount >= 0
        ? value.drawCount
        : 0,
  };
}

function normalizeHistoryItem(value: unknown): RosterState['history'][number] | undefined {
  if (
    !isRecord(value) ||
    !hasOwn(value, 'id') ||
    !hasOwn(value, 'drawnAt') ||
    !hasOwn(value, 'studentNames')
  ) {
    return undefined;
  }

  const id = normalizeRequiredString(value.id);
  const drawnAt = normalizeRequiredString(value.drawnAt);
  if (id === undefined || drawnAt === undefined || !Array.isArray(value.studentNames)) {
    return undefined;
  }

  const studentNames: string[] = [];
  for (const studentName of value.studentNames) {
    const normalizedStudentName = normalizeRequiredString(studentName);
    if (normalizedStudentName === undefined) {
      return undefined;
    }
    studentNames.push(normalizedStudentName);
  }

  return { id, drawnAt, studentNames };
}

function normalizeSettings(value: unknown): RosterState['settings'] | undefined {
  if (
    !isRecord(value) ||
    !hasOwn(value, 'animationEnabled') ||
    !hasOwn(value, 'animationDurationMs') ||
    !hasOwn(value, 'theme')
  ) {
    return undefined;
  }

  const { animationEnabled, animationDurationMs, theme } = value;

  if (
    typeof animationEnabled !== 'boolean' ||
    typeof animationDurationMs !== 'number' ||
    !Number.isFinite(animationDurationMs) ||
    animationDurationMs < 0 ||
    animationDurationMs > MAX_ANIMATION_DURATION_MS ||
    (theme !== 'light' && theme !== 'dark')
  ) {
    return undefined;
  }

  const normalizedSettings: RosterState['settings'] = {
    animationEnabled,
    animationDurationMs,
    theme,
  };

  if (
    value.animationStyle === 'slot' ||
    value.animationStyle === 'marquee' ||
    value.animationStyle === 'spotlight' ||
    value.animationStyle === 'card'
  ) {
    normalizedSettings.animationStyle = value.animationStyle;
  }

  if (typeof value.allowDuplicates === 'boolean') {
    normalizedSettings.allowDuplicates = value.allowDuplicates;
  }

  if (
    typeof value.fullscreenDisplayMs === 'number' &&
    Number.isFinite(value.fullscreenDisplayMs) &&
    value.fullscreenDisplayMs >= MIN_FULLSCREEN_DISPLAY_MS &&
    value.fullscreenDisplayMs <= MAX_FULLSCREEN_DISPLAY_MS
  ) {
    normalizedSettings.fullscreenDisplayMs = value.fullscreenDisplayMs;
  }

  // 自定义背景图：只接受受限大小内的 base64 dataURL，其他取值一律丢弃回到默认背景
  if (
    typeof value.backgroundImage === 'string' &&
    value.backgroundImage.length > 0 &&
    value.backgroundImage.length <= MAX_BACKGROUND_IMAGE_LENGTH &&
    /^data:image\/(?:png|jpe?g|webp|bmp|gif);base64,[A-Za-z0-9+/=]+$/.test(value.backgroundImage)
  ) {
    normalizedSettings.backgroundImage = value.backgroundImage;
  }

  // 配色方案：只接受预定义主题，其他取值丢弃回到默认墨青
  if (typeof value.colorTheme === 'string' && (COLOR_THEMES as string[]).includes(value.colorTheme)) {
    normalizedSettings.colorTheme = value.colorTheme as RosterState['settings']['colorTheme'];
  }

  // 开机自启（UI 回显用）：只接受布尔值，实际生效由主进程登录项管理
  if (typeof value.launchAtStartup === 'boolean') {
    normalizedSettings.launchAtStartup = value.launchAtStartup;
  }

  // 保底池：校验开关、成员 id 列表与阈值范围
  const pityPool = value.pityPool;
  if (isRecord(pityPool) && typeof pityPool.enabled === 'boolean') {
    const studentIds = Array.isArray(pityPool.studentIds)
      ? pityPool.studentIds.filter(
          (id): id is string => typeof id === 'string' && id.length > 0,
        )
      : [];
    const thresholdRaw = pityPool.threshold;
    const threshold =
      typeof thresholdRaw === 'number' && Number.isFinite(thresholdRaw)
        ? Math.min(Math.max(Math.round(thresholdRaw), 1), MAX_PITY_THRESHOLD)
        : 10;
    normalizedSettings.pityPool = {
      enabled: pityPool.enabled,
      studentIds,
      threshold,
    };
  }

  // 保底计数：非负整数
  const pityCounter = value.pityCounter;
  if (
    typeof pityCounter === 'number' &&
    Number.isFinite(pityCounter) &&
    pityCounter >= 0 &&
    Number.isInteger(pityCounter)
  ) {
    normalizedSettings.pityCounter = pityCounter;
  }

  // 结果音效开关
  if (typeof value.soundEnabled === 'boolean') {
    normalizedSettings.soundEnabled = value.soundEnabled;
  }

  // 音效 dataURL：校验格式与长度上限（约 3MB 音频）
  const soundDrawnData = value.soundDrawnData;
  if (isSoundDataUrl(soundDrawnData)) {
    normalizedSettings.soundDrawnData = soundDrawnData;
  }
  const soundPityData = value.soundPityData;
  if (isSoundDataUrl(soundPityData)) {
    normalizedSettings.soundPityData = soundPityData;
  }

  // 权重预设：最多 20 个，每个按学生 id 记录 0-100 的百分比
  const weightPresets = value.weightPresets;
  if (Array.isArray(weightPresets)) {
    const normalizedPresets: RosterState['settings']['weightPresets'] = [];
    for (const preset of weightPresets) {
      if (normalizedPresets.length >= 20) {
        break;
      }
      if (!isRecord(preset) || typeof preset.name !== 'string' || preset.name.trim().length === 0) {
        continue;
      }
      if (!isRecord(preset.weights)) {
        continue;
      }
      const weights: Record<string, number> = {};
      for (const [studentId, percent] of Object.entries(preset.weights)) {
        if (typeof studentId === 'string' && typeof percent === 'number' && Number.isFinite(percent)) {
          weights[studentId] = Math.min(Math.max(percent, 0), 100);
        }
      }
      normalizedPresets.push({ name: preset.name.trim().slice(0, 30), weights });
    }
    normalizedSettings.weightPresets = normalizedPresets;
  }

  // 品牌自定义：各标题 1-30 字，图标为 data:image dataURL
  const branding = value.branding;
  if (isRecord(branding)) {
    const normalizedBranding: RosterState['settings']['branding'] = { ...DEFAULT_BRANDING };
    for (const key of ['appTitle', 'windowTitle', 'productName', 'menuTitle'] as const) {
      const text = branding[key];
      if (typeof text === 'string' && text.trim().length > 0) {
        normalizedBranding[key] = text.trim().slice(0, 30);
      }
    }
    const iconData = branding.iconData;
    if (
      typeof iconData === 'string' &&
      iconData.startsWith('data:image/') &&
      iconData.length <= MAX_BACKGROUND_IMAGE_LENGTH
    ) {
      normalizedBranding.iconData = iconData;
    }
    normalizedSettings.branding = normalizedBranding;
  }

  // 按星级过滤抽取：开关 + 1-5 星集合（最多 5 个）
  const starFilter = value.starFilter;
  if (isRecord(starFilter) && typeof starFilter.enabled === 'boolean') {
    const stars = Array.isArray(starFilter.stars)
      ? starFilter.stars.filter(
          (star): star is number =>
            typeof star === 'number' && Number.isInteger(star) && star >= 1 && star <= 5,
        )
      : [];
    normalizedSettings.starFilter = {
      enabled: starFilter.enabled,
      stars: Array.from(new Set(stars)).sort((a, b) => a - b),
    };
  }

  // 自动升星开关：只接受布尔值
  if (typeof value.autoStarUpgrade === 'boolean') {
    normalizedSettings.autoStarUpgrade = value.autoStarUpgrade;
  }

  // 名单源文件路径：用于星级回写，限制长度防撑大状态文件
  const sourcePath = value.sourcePath;
  if (typeof sourcePath === 'string' && sourcePath.trim().length > 0 && sourcePath.length <= 500) {
    normalizedSettings.sourcePath = sourcePath.trim();
  }

  return normalizedSettings;
}

/** 校验音效 dataURL：data:audio 前缀 + 长度上限 */
function isSoundDataUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('data:audio/') &&
    value.length <= MAX_SOUND_DATA_LENGTH
  );
}

export function normalizeRosterState(value: unknown): RosterState | undefined {
  if (
    !isRecord(value) ||
    !hasOwn(value, 'sourceName') ||
    !hasOwn(value, 'students') ||
    !hasOwn(value, 'history') ||
    !hasOwn(value, 'settings')
  ) {
    return undefined;
  }

  const sourceName = normalizeSourceName(value.sourceName);
  const settings = normalizeSettings(value.settings);
  if (
    sourceName === undefined ||
    settings === undefined ||
    !Array.isArray(value.students) ||
    !Array.isArray(value.history)
  ) {
    return undefined;
  }

  const students: StudentRecord[] = [];
  for (const student of value.students) {
    const normalizedStudent = normalizeStudentRecord(student);
    if (normalizedStudent === undefined) {
      return undefined;
    }
    students.push(normalizedStudent);
  }

  const history: RosterState['history'] = [];
  for (const historyItem of value.history) {
    const normalizedHistoryItem = normalizeHistoryItem(historyItem);
    if (normalizedHistoryItem === undefined) {
      return undefined;
    }
    history.push(normalizedHistoryItem);
  }

  return { sourceName, students, history, settings };
}

export function isRosterState(value: unknown): value is RosterState {
  return normalizeRosterState(value) !== undefined;
}

function safelyNormalizeRosterState(value: unknown): RosterState | undefined {
  try {
    return normalizeRosterState(value);
  } catch {
    return undefined;
  }
}

function sanitizeImportResult(result: ImportResult): ImportResult {
  if (!isRecord(result) || !hasOwn(result, 'sourceName') || !hasOwn(result, 'students')) {
    throw new Error('Invalid importer result');
  }

  const sourceName = normalizeSourceName(result.sourceName);
  if (sourceName === undefined || !Array.isArray(result.students)) {
    throw new Error('Invalid importer result');
  }

  const students: StudentRecord[] = [];
  for (const student of result.students) {
    const normalizedStudent = normalizeStudentRecord(student);
    if (normalizedStudent === undefined) {
      throw new Error('Invalid importer result');
    }
    students.push(normalizedStudent);
  }

  // 记录名单文件完整路径：之后改星级时同步回写用
  const sourcePath =
    typeof result.sourcePath === 'string' && result.sourcePath.trim().length > 0
      ? result.sourcePath.trim()
      : undefined;
  return sourcePath === undefined ? { sourceName, students } : { sourceName, sourcePath, students };
}

function isSupportedRosterFile(filePath: unknown): filePath is string {
  return typeof filePath === 'string' && SUPPORTED_ROSTER_EXTENSIONS.has(extname(filePath).toLowerCase());
}

export function createIpcHandlers(dependencies: IpcHandlerDependencies): IpcHandlers {
  return {
    async importRoster(): Promise<ImportResult> {
      let dialogResult: OpenDialogResult;
      try {
        dialogResult = await dependencies.showOpenDialog(ROSTER_FILE_DIALOG_OPTIONS);
      } catch (error) {
        throw serializeIpcError(error, 'FILE_DIALOG_FAILED');
      }

      if (
        dialogResult === null ||
        typeof dialogResult !== 'object' ||
        typeof dialogResult.canceled !== 'boolean' ||
        !Array.isArray(dialogResult.filePaths)
      ) {
        throw serializeIpcError(undefined, 'FILE_DIALOG_FAILED');
      }

      const filePath = dialogResult.filePaths[0];
      if (dialogResult.canceled || filePath === undefined) {
        throw cancellationError();
      }
      if (!isSupportedRosterFile(filePath)) {
        throw unsupportedFormatError();
      }

      try {
        return sanitizeImportResult(await dependencies.importRoster(filePath));
      } catch (error) {
        throw serializeIpcError(error);
      }
    },

    async loadState(): Promise<RosterState | null> {
      try {
        const state = await dependencies.store.load();
        if (state === null) {
          return null;
        }

        const normalizedState = safelyNormalizeRosterState(state);
        if (normalizedState === undefined) {
          throw invalidStateError();
        }
        return normalizedState;
      } catch (error) {
        throw serializeIpcError(error);
      }
    },

    async saveState(state: unknown): Promise<void> {
      const normalizedState = safelyNormalizeRosterState(state);
      if (normalizedState === undefined) {
        throw invalidStateError();
      }

      try {
        await dependencies.store.save(normalizedState);
      } catch (error) {
        throw serializeIpcError(error);
      }
    },

    async clearState(): Promise<void> {
      try {
        await dependencies.store.clear();
      } catch (error) {
        throw serializeIpcError(error);
      }
    },

    async windowControl(action: unknown): Promise<boolean> {
      if (!isWindowControlAction(action)) {
        throw invalidWindowActionError();
      }

      const windowControls = dependencies.windowControls;
      if (!windowControls) {
        return false;
      }

      if (action === 'minimize') {
        windowControls.minimize();
      } else if (action === 'toggle-maximize') {
        windowControls.toggleMaximize();
      } else if (action === 'close') {
        windowControls.close();
      }

      return windowControls.isMaximized();
    },

    async launchSettings(action: unknown, payload?: unknown): Promise<boolean> {
      const launchControls = dependencies.launchControls;
      if (!launchControls) {
        return false;
      }

      if (action === 'get') {
        return launchControls.getCurrent();
      }

      if (action === 'set') {
        const enabled = isRecord(payload) ? payload.enabled : undefined;
        if (typeof enabled !== 'boolean') {
          throw invalidWindowActionError();
        }
        launchControls.setEnabled(enabled);
        return launchControls.getCurrent();
      }

      throw invalidWindowActionError();
    },

    async applyBranding(payload: unknown): Promise<void> {
      const brandingControls = dependencies.brandingControls;
      if (!brandingControls) {
        return;
      }

      const branding = isRecord(payload) ? payload : {};
      const windowTitle =
        typeof branding.windowTitle === 'string' && branding.windowTitle.trim().length > 0
          ? branding.windowTitle.trim().slice(0, 30)
          : undefined;
      const iconData =
        typeof branding.iconData === 'string' &&
        branding.iconData.startsWith('data:image/') &&
        branding.iconData.length <= MAX_BACKGROUND_IMAGE_LENGTH
          ? branding.iconData
          : undefined;
      brandingControls.apply({ windowTitle, iconData });
    },

    async syncStars(payload: unknown): Promise<void> {
      const syncControls = dependencies.starSyncControls;
      if (!syncControls) {
        return;
      }

      const record = isRecord(payload) ? payload : {};
      const sourcePath = record.sourcePath;
      const rawEntries = record.entries;
      if (typeof sourcePath !== 'string' || sourcePath.trim().length === 0 || !Array.isArray(rawEntries)) {
        return;
      }

      const entries: { name: string; star: number }[] = [];
      for (const entry of rawEntries) {
        if (!isRecord(entry)) {
          continue;
        }
        const name = entry.name;
        const star = entry.star;
        if (
          typeof name === 'string' &&
          name.trim().length > 0 &&
          typeof star === 'number' &&
          Number.isInteger(star) &&
          star >= 1 &&
          star <= 5
        ) {
          entries.push({ name: name.trim(), star });
        }
      }
      await syncControls.sync(sourcePath, entries);
    },
  };
}

export function isTrustedIpcSender(event: unknown): boolean {
  if (!isRecord(event) || !isRecord(event.senderFrame) || typeof event.senderFrame.url !== 'string') {
    return false;
  }

  try {
    const url = new URL(event.senderFrame.url);
    if (url.username !== '' || url.password !== '') {
      return false;
    }
    if (url.protocol === 'file:') {
      return url.hostname === '' || url.hostname.toLowerCase() === 'localhost';
    }
    return url.protocol === 'http:' && TRUSTED_DEV_HOSTNAMES.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function unauthorizedSenderEnvelope(): IpcFailureEnvelope {
  return {
    ok: false,
    error: { code: 'UNAUTHORIZED_SENDER', message: ERROR_MESSAGES.UNAUTHORIZED_SENDER },
  };
}

async function toIpcEnvelope<T>(operation: () => Promise<T>): Promise<IpcResponse<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    return { ok: false, error: serializeIpcError(error) };
  }
}

function handleTrustedRequest<T>(
  event: unknown,
  operation: () => Promise<T>,
): Promise<IpcResponse<T>> {
  if (!isTrustedIpcSender(event)) {
    return Promise.resolve(unauthorizedSenderEnvelope());
  }

  return toIpcEnvelope(operation);
}

export function registerIpcHandlers(ipcMain: IpcMainLike, handlers: IpcHandlers): void {
  ipcMain.handle(IPC_CHANNELS.importRoster, (event) =>
    handleTrustedRequest(event, () => handlers.importRoster()),
  );
  ipcMain.handle(IPC_CHANNELS.loadState, (event) =>
    handleTrustedRequest(event, () => handlers.loadState()),
  );
  ipcMain.handle(IPC_CHANNELS.saveState, (event, state) =>
    handleTrustedRequest(event, () => handlers.saveState(state)),
  );
  ipcMain.handle(IPC_CHANNELS.clearState, (event) =>
    handleTrustedRequest(event, () => handlers.clearState()),
  );
  ipcMain.handle(IPC_CHANNELS.windowControl, (event, action) =>
    handleTrustedRequest(event, () => handlers.windowControl(action)),
  );
  ipcMain.handle(IPC_CHANNELS.launchSettings, (event, action, payload) =>
    handleTrustedRequest(event, () => handlers.launchSettings(action, payload)),
  );
  ipcMain.handle(IPC_CHANNELS.branding, (event, payload) =>
    handleTrustedRequest(event, () => handlers.applyBranding(payload)),
  );
  ipcMain.handle(IPC_CHANNELS.syncStars, (event, payload) =>
    handleTrustedRequest(event, () => handlers.syncStars(payload)),
  );
}
