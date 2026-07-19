const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronApp', {
  appVersion: process.env.APP_VERSION || 'dev',
  apiUrl: `http://localhost:${process.env.PORT || 3001}`,
});
