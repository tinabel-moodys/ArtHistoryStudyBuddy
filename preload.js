const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  readMd: p => ipcRenderer.invoke('read-md', p),
  pickMd: () => ipcRenderer.invoke('pick-md'),
});
