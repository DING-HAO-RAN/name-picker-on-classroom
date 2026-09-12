import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import { join } from 'node:path';
import { createIpcHandlers, registerIpcHandlers, type IpcWindowControls } from './ipcHandlers';
import { importRoster } from './importers/importRoster';
import { getDevelopmentRendererUrl } from './renderer-url';
import { LocalStore } from './storage/localStore';
import { IPC_CHANNELS } from '../shared/ipcTypes';

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

void app.whenReady().then(() => {
  // 全局移除默认菜单栏
  Menu.setApplicationMenu(null);

  const handlers = createIpcHandlers({
    showOpenDialog: (options) => dialog.showOpenDialog(options),
    importRoster,
    store: new LocalStore(app.getPath('userData')),
    windowControls,
  });
  registerIpcHandlers(ipcMain, handlers);

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
