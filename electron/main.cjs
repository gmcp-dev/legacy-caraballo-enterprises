const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const { autoUpdater } = require('electron-updater');

const isDev = !app.isPackaged;
process.env.APP_VERSION = app.getVersion();

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow;
let serverProcess;
let appLoadAllowed = false;
let updateCheckCompleted = false;
let updateState = {
  status: 'checking',
  currentVersion: app.getVersion(),
  availableVersion: null,
  progress: null,
  error: null,
  canInstall: false,
};

function getServerPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'server', 'index.js');
  }
  return path.join(process.resourcesPath, 'app.asar.unpacked', 'server', 'index.js');
}

function getServerCwd() {
  if (isDev) {
    return path.join(__dirname, '..', 'server');
  }
  return path.join(process.resourcesPath, 'app.asar.unpacked', 'server');
}

function startServer() {
  const { fork } = require('child_process');

  const dbDir = isDev
    ? path.join(__dirname, '..', 'server')
    : app.getPath('userData');

  serverProcess = fork(getServerPath(), [], {
    cwd: getServerCwd(),
    env: {
      ...process.env,
      PORT: '3001',
      DB_DIR: dbDir,
      NODE_ENV: isDev ? 'development' : 'production',
      APP_ROOT: getAppRoot(),
      DIST_PATH: getDistPath(),
    },
    silent: true,
  });
  serverProcess.on('error', (err) => console.error('Server error:', err));
}

function getAppRoot() {
  return isDev ? path.join(__dirname, '..') : process.resourcesPath;
}

function getDistPath() {
  return isDev ? path.join(__dirname, '..', 'dist') : path.join(process.resourcesPath, 'app.asar', 'dist');
}

function broadcastUpdateState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('update-state', { ...updateState });
}

function renderUpdateScreen() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const appUrl = isDev ? 'http://localhost:5173/update' : 'http://localhost:3001/update';
  mainWindow.loadURL(appUrl);
  mainWindow.webContents.once('did-finish-load', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
    broadcastUpdateState();
  });
}

function showSplashScreen() {
  updateState.status = 'checking';
  updateState.availableVersion = null;
  updateState.progress = null;
  updateState.error = null;
  updateState.canInstall = false;
  renderUpdateScreen();
}

function showErrorScreen(message = 'No se pudo iniciar la aplicación', details = 'Revisa la consola o el servidor para obtener más información.') {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const html = `<!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          :root { color-scheme: dark; }
          body {
            margin: 0;
            font-family: Inter, Segoe UI, Arial, sans-serif;
            background: #080808;
            color: #f8e6a4;
            display: grid;
            place-items: center;
            min-height: 100vh;
          }
          .card {
            text-align: center;
            padding: 36px 42px;
            border-radius: 18px;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,94,94,0.3);
            box-shadow: 0 12px 30px rgba(0,0,0,0.35);
            max-width: 560px;
          }
          h1 { margin: 0 0 8px; font-size: 24px; color: #ffb4b4; }
          p { margin: 8px 0 0; color: #e7dbc0; line-height: 1.5; }
          .details { margin-top: 14px; font-size: 13px; opacity: 0.9; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>${message}</h1>
          <p>La aplicación no pudo cargar correctamente.</p>
          <p class="details">${details}</p>
        </div>
      </body>
    </html>`;

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function loadAppUrl() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!appLoadAllowed) return;
  if (!updateCheckCompleted) return;
  if (updateState.status === 'checking' || updateState.status === 'available' || updateState.status === 'downloading' || updateState.status === 'downloaded' || updateState.status === 'installing') return;

  const appUrl = isDev ? 'http://localhost:5173' : 'http://localhost:3001';
  mainWindow.loadURL(appUrl);
  mainWindow.webContents.once('did-finish-load', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
  });
}

function waitForServer(successCallback, failureCallback, attempts = 0) {
  const healthUrl = isDev ? 'http://localhost:5173' : 'http://localhost:3001/api/health';

  const req = http.get(healthUrl, (res) => {
    res.resume();
    res.on('end', () => {
      successCallback();
    });
  });

  req.on('error', () => {
    if (attempts < 20) {
      setTimeout(() => waitForServer(successCallback, failureCallback, attempts + 1), 250);
      return;
    }

    failureCallback();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    title: 'LEGACY - Caraballo Enterprises',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.webContents.on('did-fail-load', (_event, _errorCode, errorDescription, validatedURL) => {
    console.error(`Failed to load ${validatedURL}: ${errorDescription}`);
    showErrorScreen('No se pudo cargar la interfaz', errorDescription || 'Verifica que el servidor o el entorno de desarrollo estén disponibles.');
  });

  mainWindow.webContents.on('render-process-gone', () => {
    showErrorScreen('La interfaz falló al iniciar', 'El proceso de renderizado dejó de responder. Reinicia la aplicación e inténtalo de nuevo.');
  });

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
  createWindow();
  showSplashScreen('Iniciando aplicación', 'Conectando con los servicios necesarios...');

  waitForServer(() => {
    appLoadAllowed = true;
    renderUpdateScreen();
  }, () => {
    showErrorScreen('No se pudo iniciar la aplicación', 'No fue posible conectar con el backend o la interfaz. Revisa que el servidor esté disponible.');
  });

  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      updateState.status = 'error';
      updateState.error = err?.message || 'No se pudo comprobar actualizaciones';
      broadcastUpdateState();
      renderUpdateScreen();
    });
  } else {
    updateState.status = 'ready';
    updateState.availableVersion = null;
    updateState.progress = null;
    updateState.error = null;
    updateState.canInstall = false;
    updateCheckCompleted = true;
    broadcastUpdateState();
    loadAppUrl();
  }
});

autoUpdater.on('checking-for-update', () => {
  updateState.status = 'checking';
  updateState.error = null;
  broadcastUpdateState();
  renderUpdateScreen();
});

autoUpdater.on('update-available', (info) => {
  updateState.status = 'available';
  updateState.availableVersion = info.version;
  updateState.canInstall = true;
  updateState.progress = null;
  updateState.error = null;
  broadcastUpdateState();
  renderUpdateScreen();
});

autoUpdater.on('download-progress', (progressObj) => {
  updateState.status = 'downloading';
  updateState.progress = Math.round(progressObj.percent || 0);
  broadcastUpdateState();
  renderUpdateScreen();
});

autoUpdater.on('update-downloaded', () => {
  updateState.status = 'downloaded';
  updateState.progress = 100;
  updateState.canInstall = true;
  broadcastUpdateState();
  renderUpdateScreen();
});

autoUpdater.on('update-not-available', () => {
  updateState.status = 'ready';
  updateState.availableVersion = null;
  updateState.progress = null;
  updateState.error = null;
  updateState.canInstall = false;
  updateCheckCompleted = true;
  broadcastUpdateState();
  if (appLoadAllowed) {
    loadAppUrl();
  }
});

autoUpdater.on('error', (err) => {
  updateState.status = 'error';
  updateState.error = err?.message || 'No se pudo comprobar actualizaciones';
  updateCheckCompleted = true;
  broadcastUpdateState();
  if (appLoadAllowed) {
    loadAppUrl();
  }
  console.error('Auto-update error:', err);
});

function installUpdateNow() {
  if (!autoUpdater) return;
  updateState.status = 'installing';
  updateState.progress = 100;
  broadcastUpdateState();
  autoUpdater.quitAndInstall();
}

ipcMain.on('install-update-now', () => {
  installUpdateNow();
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
