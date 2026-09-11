import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { join } from 'node:path';
import { createIpcHandlers, registerIpcHandlers } from './ipcHandlers';
import { importRoster } from './importers/importRoster';
import { getDevelopmentRendererUrl } from './renderer-url';
import { LocalStore } from './storage/localStore';

function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
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

void app.whenReady().then(() => {
  const handlers = createIpcHandlers({
    showOpenDialog: (options) => dialog.showOpenDialog(options),
    importRoster,
    store: new LocalStore(app.getPath('userData')),
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
