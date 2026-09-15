import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage } from 'electron';
import { join } from 'node:path';
import { createIpcHandlers, registerIpcHandlers, type IpcWindowControls } from './ipcHandlers';
import { importRoster } from './importers/importRoster';
import { syncStarsToRosterFile } from './importers/syncStars';
import { getDevelopmentRendererUrl } from './renderer-url';
import { LocalStore } from './storage/localStore';
import { IPC_CHANNELS } from '../shared/ipcTypes';

/** 主窗口引用：单实例唤起时使用 */
let mainWindowRef: BrowserWindow | null = null;

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

  // 关闭窗口即退出应用（window-all-closed 负责退出，无需拦截）

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

// 单实例锁必须在注册 whenReady 回调之前获取：
// 否则旧实例驻留后台时双击图标，新实例虽会 quit，但 ready 竞态下仍可能
// 创建窗口、加载存档并触发迁移保存——退出中的写入失败会弹出「保存失败」
// 且窗口闪退，表现为「双击图标无法正常打开」
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  // 已有实例在运行：安静退出，由旧实例负责唤起主界面
  app.quit();
} else {
  // 后台运行（尤其未显示悬浮球）时再次启动应用，唤起主界面而不是开第二个进程
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

  void app.whenReady().then(() => {
    // 全局移除默认菜单栏
    Menu.setApplicationMenu(null);

    const store = new LocalStore(app.getPath('userData'));

    const handlers = createIpcHandlers({
      showOpenDialog: (options) => dialog.showOpenDialog(options),
      importRoster,
      store,
      windowControls,
      // 开机自启：绑定系统登录启动项
      launchControls: {
        getCurrent() {
          return app.getLoginItemSettings({ path: process.execPath }).openAtLogin;
        },
        setEnabled(enabled: boolean) {
          app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath, args: [] });
        },
      },
    // 品牌自定义：实时应用窗口标题与窗口图标（exe 内置图标需重新打包）
    brandingControls: {
      apply(branding: { windowTitle?: string; iconData?: string }) {
        const window = BrowserWindow.getAllWindows().find((item) => !item.isDestroyed());
        if (window) {
          if (branding.windowTitle) {
            window.setTitle(branding.windowTitle);
          }
          if (branding.iconData) {
            try {
              const icon = nativeImage.createFromDataURL(branding.iconData);
              if (!icon.isEmpty()) {
                window.setIcon(icon);
              }
            } catch {
              // 图标数据非法时忽略，保持当前图标
            }
          }
        }
      },
    },
    // 星级回写：改动的星级同步回名单源文件（内部失败静默忽略）
    starSyncControls: {
      sync(sourcePath: string, entries: { name: string; star: number }[]) {
        void syncStarsToRosterFile(sourcePath, entries);
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
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
