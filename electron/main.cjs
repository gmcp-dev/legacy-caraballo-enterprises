const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');
const { autoUpdater } = require('electron-updater');

const isDev = !app.isPackaged;

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow;
let serverProcess;

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

function showSplashScreen(message = 'Iniciando aplicación', subtitle = 'Preparando los servicios necesarios...') {
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
            background: linear-gradient(135deg, #060606 0%, #121212 100%);
            color: #f5e8c8;
            display: grid;
            place-items: center;
            min-height: 100vh;
          }
          .card {
            text-align: center;
            padding: 36px 42px;
            border-radius: 18px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(201,168,76,0.25);
            box-shadow: 0 12px 30px rgba(0,0,0,0.35);
            max-width: 520px;
          }
          .spinner {
            width: 52px;
            height: 52px;
            border: 4px solid rgba(201,168,76,0.2);
            border-top: 4px solid #c9a84c;
            border-radius: 50%;
            margin: 0 auto 22px;
            animation: spin 0.9s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          h1 { margin: 0 0 8px; font-size: 24px; }
          p { margin: 0; color: #d8d0b4; line-height: 1.5; }
          .sub { margin-top: 10px; font-size: 14px; opacity: 0.85; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="spinner"></div>
          <h1>${message}</h1>
          <p>${subtitle}</p>
          <p class="sub">Por favor espera unos segundos...</p>
        </div>
      </body>
    </html>`;

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
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

  showSplashScreen('Cargando interfaz', 'Esperando que la aplicación responda...');

  const appUrl = isDev ? 'http://localhost:5173' : 'http://localhost:3001';
  mainWindow.loadURL(appUrl);
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
    width: 1400,
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
    show: false,
  });

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
  waitForServer(loadAppUrl, () => {
    showErrorScreen('No se pudo iniciar la aplicación', 'No fue posible conectar con el backend o la interfaz. Revisa que el servidor esté disponible.');
  });

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
