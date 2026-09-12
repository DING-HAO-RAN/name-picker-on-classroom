import { app, BrowserWindow, dialog, ipcMain, Menu, screen } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createIpcHandlers, registerIpcHandlers, type IpcWindowControls } from './ipcHandlers';
import { importRoster } from './importers/importRoster';
import { getDevelopmentRendererUrl } from './renderer-url';
import { LocalStore } from './storage/localStore';
import { IPC_CHANNELS } from '../shared/ipcTypes';

/** 悬浮球窗口在 URL 上携带的窗口标识（与 preload 的判断保持一致） */
const FLOATING_WINDOW_QUERY = 'window=floating';

/** 是否处于真正退出流程：退出时窗口 close 不再被拦截为隐藏到后台 */
let isQuitting = false;

/** 悬浮球窗口：主界面隐藏到后台时显示，点击即可一键切回 */
let floatingWindow: BrowserWindow | null = null;

/** 主窗口引用：close 拦截、悬浮球恢复时使用 */
let mainWindowRef: BrowserWindow | null = null;

/** 本地存储引用：close 拦截时读取最新的关闭行为设置 */
let appStore: LocalStore | null = null;

/** 从存储读取关闭行为与悬浮球显示设置；读取失败按默认值处理 */
function loadWindowBehaviorSettings(store: LocalStore): {
  closeAction: 'background' | 'quit';
  showFloatingBall: boolean;
} {
  const defaults = { closeAction: 'background' as const, showFloatingBall: true };
  try {
    const raw = store.load();
    if (!raw || typeof raw !== 'object') {
      return defaults;
    }
    const settings = (raw as { settings?: Record<string, unknown> }).settings;
    if (!settings || typeof settings !== 'object') {
      return defaults;
    }
    const closeAction =
      settings.closeAction === 'quit' || settings.closeAction === 'background'
        ? settings.closeAction
        : defaults.closeAction;
    const showFloatingBall =
      typeof settings.showFloatingBall === 'boolean'
        ? settings.showFloatingBall
        : defaults.showFloatingBall;
    return { closeAction, showFloatingBall };
  } catch {
    return defaults;
  }
}

/**
 * 取当前应用窗口。窗口可能被销毁或在 macOS 上重新创建，
 * 因此每次按需查找，而不是在启动时固定持有引用。
 */
function getAppWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
}

const windowControls: IpcWindowControls = {
  minimize() {
    getAppWindow()?.minimize();
  },
  toggleMaximize() {
    const window = getAppWindow();
    if (!window) {
      return;
    }
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  },
  close() {
    getAppWindow()?.close();
  },
  isMaximized() {
    return getAppWindow()?.isMaximized() ?? false;
  },
};

function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    // 去掉 Windows 原生窗口框架，标题栏由渲染器按应用主题自绘
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // 隐藏窗口原生菜单栏
  mainWindow.setMenuBarVisibility(false);
  mainWindow.removeMenu();

  // 课堂投影场景：启动即最大化，保证大屏可用面积
  mainWindow.maximize();

  // 最大化状态变化（含系统双击标题栏）时同步给渲染器，保证自绘按钮图标正确
  const notifyMaximizedChanged = (): void => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.windowMaximizedChanged, mainWindow.isMaximized());
    }
  };
  mainWindow.on('maximize', notifyMaximizedChanged);
  mainWindow.on('unmaximize', notifyMaximizedChanged);

  // 点击关闭 = 按设置执行：默认缩到后台（显示悬浮球）；也可直接退出
  mainWindow.on('close', (event) => {
    if (isQuitting) {
      return;
    }
    const behavior = appStore
      ? loadWindowBehaviorSettings(appStore)
      : { closeAction: 'background' as const, showFloatingBall: true };
    if (behavior.closeAction === 'quit') {
      // 用户选择「直接退出」：放行关闭，window-all-closed 会退出应用
      return;
    }
    event.preventDefault();
    hideMainWindowToFloating(mainWindow, behavior.showFloatingBall);
  });

  const rendererUrl = getDevelopmentRendererUrl(
    app.isPackaged,
    process.env.ELECTRON_RENDERER_URL,
  );
  if (rendererUrl) {
    void mainWindow.loadURL(rendererUrl);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}

/** 把主界面藏到后台；按设置决定是否显示悬浮球 */
function hideMainWindowToFloating(mainWindow: BrowserWindow, showFloatingBall: boolean): void {
  mainWindow.hide();
  if (!showFloatingBall) {
    // 不显示悬浮球：可通过再次启动应用（单实例锁）唤起主界面
    return;
  }
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.show();
    return;
  }
  floatingWindow = createFloatingWindow();
  floatingWindow.show();
}

/** 创建置顶悬浮球：64x64 透明无边框小窗，整个圆形区域可点击、可拖动 */
function createFloatingWindow(): BrowserWindow {
  const floating = new BrowserWindow({
    width: 64,
    height: 64,
    useContentSize: true,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // 置顶级别拉满，保证投影或全屏应用之上仍然可见
  floating.setAlwaysOnTop(true, 'screen-saver');

  // 初始位置：主工作区右上角，避开任务栏与系统托盘
  const { workArea } = screen.getPrimaryDisplay();
  floating.setPosition(workArea.x + workArea.width - 80, workArea.y + 16);

  floating.setMenuBarVisibility(false);
  floating.removeMenu();

  const rendererUrl = getDevelopmentRendererUrl(
    app.isPackaged,
    process.env.ELECTRON_RENDERER_URL,
  );
  if (rendererUrl) {
    void floating.loadURL(`${rendererUrl}?${FLOATING_WINDOW_QUERY}`);
  } else {
    // 显式拼接查询参数：loadFile 的 search 选项在部分版本不可靠，
    // 查询串丢失会让悬浮球窗口错误渲染完整主界面（出现滚动条与标题栏）
    const floatingUrl = new URL(pathToFileURL(join(__dirname, '../renderer/index.html')).href);
    floatingUrl.search = FLOATING_WINDOW_QUERY;
    void floating.loadURL(floatingUrl.href);
  }

  floating.on('closed', () => {
    if (floatingWindow === floating) {
      floatingWindow = null;
    }
  });

  return floating;
}

/** 悬浮球操作：恢复主界面 / 右键菜单 / 真正退出 */
const floatingControls = {
  restore() {
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.hide();
    }
    const mainWindow = BrowserWindow.getAllWindows().find((window) => !window.isDestroyed() && window !== floatingWindow);
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  },
  menu() {
    const popupMenu = Menu.buildFromTemplate([
      {
        label: '打开主界面',
        click: () => floatingControls.restore(),
      },
      { type: 'separator' },
      {
        label: '退出程序',
        click: () => floatingControls.quit(),
      },
    ]);
    popupMenu.popup({ window: floatingWindow ?? undefined });
  },
  quit() {
    isQuitting = true;
    app.quit();
  },
  /** 拖动移动：把悬浮球中心对准屏幕坐标，渲染器在指针移动时持续上报 */
  move(x: number, y: number) {
    if (!floatingWindow || floatingWindow.isDestroyed()) {
      return;
    }
    const [width] = floatingWindow.getSize();
    floatingWindow.setPosition(Math.round(x - width / 2), Math.round(y - width / 2));
  },
};

void app.whenReady().then(() => {
  // 全局移除默认菜单栏
  Menu.setApplicationMenu(null);

  const store = new LocalStore(app.getPath('userData'));
  appStore = store;

  const handlers = createIpcHandlers({
    showOpenDialog: (options) => dialog.showOpenDialog(options),
    importRoster,
    store,
    windowControls,
    floatingControls,
    // 开机自启：绑定系统登录启动项
    launchControls: {
      getCurrent() {
        return app.getLoginItemSettings({ path: process.execPath }).openAtLogin;
      },
      setEnabled(enabled: boolean) {
        app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath, args: [] });
      },
    },
  });
  registerIpcHandlers(ipcMain, handlers);

  mainWindowRef = createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// 单实例：后台运行（尤其未显示悬浮球）时再次启动应用，唤起主界面而不是开第二个进程
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const mainWindow = mainWindowRef;
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// 任何退出路径（悬浮球退出、系统关机等）都先放行窗口关闭
app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
