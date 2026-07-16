const { contextBridge, app } = require('electron');

contextBridge.exposeInMainWorld('electronApp', {
  appVersion: app.getVersion(),
});
