// ============================================================================
// Electron Main Process – Brandon's Media Hub
// ============================================================================

import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  Tray,
  Menu,
  nativeImage,
  type Rectangle,
} from 'electron';
import * as path from 'path';
import Store from 'electron-store';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IS_DEV = !app.isPackaged;
const DEV_SERVER_URL = 'http://localhost:5173';

// Disable GPU hardware acceleration on ARM to prevent blank screens
if (process.arch === 'arm64' || process.arch === 'arm') {
  app.disableHardwareAcceleration();
}

// Persist window bounds between sessions
const store = new Store<{
  windowBounds?: Rectangle;
  windowMaximized?: boolean;
}>({
  name: 'window-state',
  defaults: {},
});

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------

function createWindow(): void {
  const savedBounds = store.get('windowBounds');
  const wasMaximized = store.get('windowMaximized', false);

  mainWindow = new BrowserWindow({
    width: savedBounds?.width ?? 1400,
    height: savedBounds?.height ?? 900,
    x: savedBounds?.x,
    y: savedBounds?.y,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for electron-store in preload
      webSecurity: !IS_DEV,
    },
  });

  // Gracefully show window when ready
  mainWindow.once('ready-to-show', () => {
    if (wasMaximized) {
      mainWindow?.maximize();
    }
    mainWindow?.show();
  });

  // Load content
  if (IS_DEV) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  // Save window state on changes
  mainWindow.on('resize', saveWindowBounds);
  mainWindow.on('move', saveWindowBounds);
  mainWindow.on('maximize', () => store.set('windowMaximized', true));
  mainWindow.on('unmaximize', () => store.set('windowMaximized', false));

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function saveWindowBounds(): void {
  if (!mainWindow || mainWindow.isMaximized()) return;
  store.set('windowBounds', mainWindow.getBounds());
}

// ---------------------------------------------------------------------------
// System tray
// ---------------------------------------------------------------------------

function createTray(): void {
  // Use a placeholder 16x16 icon – in production, replace with app icon
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Media Hub',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Play/Pause',
      click: () => mainWindow?.webContents.send('tray:toggle-playback'),
    },
    {
      label: 'Next Track',
      click: () => mainWindow?.webContents.send('tray:next-track'),
    },
    {
      label: 'Previous Track',
      click: () => mainWindow?.webContents.send('tray:prev-track'),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ]);

  tray.setToolTip('Media Hub');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// IPC Handlers
// ---------------------------------------------------------------------------

function setupIPC(): void {
  // Open URL in default system browser
  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  // Get app paths
  ipcMain.handle('app:get-path', (_event, name: string) => {
    return app.getPath(name as Parameters<typeof app.getPath>[0]);
  });

  // App version
  ipcMain.handle('app:get-version', () => {
    return app.getVersion();
  });

  // Window controls
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false);

  // Electron store (secure key-value persistence)
  ipcMain.handle('store:get', (_event, key: string) => {
    return store.get(key);
  });
  ipcMain.handle('store:set', (_event, key: string, value: unknown) => {
    store.set(key, value);
  });
  ipcMain.handle('store:delete', (_event, key: string) => {
    store.delete(key as keyof typeof store.store);
  });

  // OAuth callback server management
  ipcMain.handle('oauth:start-server', async (_event, port: number) => {
    // Renderer will manage Express server – this is a placeholder
    // for future migration to main process
    return { port };
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  createWindow();
  createTray();
  setupIPC();

  // macOS: re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup
app.on('before-quit', () => {
  if (tray) {
    tray.destroy();
    tray = null;
  }
});
