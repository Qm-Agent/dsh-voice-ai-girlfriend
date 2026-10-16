const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('companion', {
  command: action => ipcRenderer.invoke('companion:command', action),
  onState: callback => ipcRenderer.on('companion:state', (_event, state) => callback(state))
});
