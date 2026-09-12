import { app, BrowserWindow, dialog, ipcMain, Menu, screen } from 'electron';
import { join } from 'node:path';
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

  // 点击关闭 = 缩到后台并弹出悬浮球，而不是退出程序；真正退出走悬浮球菜单的 quit
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      hideMainWindowToFloating(mainWindow);
    }
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

/** 把主界面藏到后台，并确保悬浮球在屏幕右上角待命 */
function hideMainWindowToFloating(mainWindow: BrowserWindow): void {
  mainWindow.hide();
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.show();
    return;
  }
  floatingWindow = createFloatingWindow();
  floatingWindow.show();
}

/** 创建置顶悬浮球：56x56 透明无边框小窗，加载同一个渲染器页面（?window=floating） */
function createFloatingWindow(): BrowserWindow {
  const floating = new BrowserWindow({
    width: 56,
    height: 56,
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
    void floating.loadFile(join(__dirname, '../renderer/index.html'), {
      search: FLOATING_WINDOW_QUERY,
    });
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
};

void app.whenReady().then(() => {
  // 全局移除默认菜单栏
  Menu.setApplicationMenu(null);

  const handlers = createIpcHandlers({
    showOpenDialog: (options) => dialog.showOpenDialog(options),
    importRoster,
    store: new LocalStore(app.getPath('userData')),
    windowControls,
    floatingControls,
  });
  registerIpcHandlers(ipcMain, handlers);

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// 任何退出路径（悬浮球退出、系统关机等）都先放行窗口关闭
app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
