const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

const isDev = !app.isPackaged;

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow;
let serverProcess;

function startServer() {
  const serverPath = path.join(__dirname, '..', 'server', 'index.js');
  serverProcess = require('child_process').fork(serverPath, [], {
    cwd: path.join(__dirname, '..', 'server'),
    env: { ...process.env, PORT: '3001' },
    silent: true,
  });
  serverProcess.on('error', (err) => console.error('Server error:', err));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    title: 'LEGACY - Caraballo Enterprises',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#0a0a0a',
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadURL('http://localhost:3001');
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  startServer();
  setTimeout(createWindow, 1000);

  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }
});

autoUpdater.on('update-available', (info) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info.version);
  }
});

autoUpdater.on('update-downloaded', () => {
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded');
  }
});

autoUpdater.on('error', (err) => {
  console.error('Auto-update error:', err);
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
