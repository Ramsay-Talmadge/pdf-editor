const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openPDF: () => ipcRenderer.invoke('dialog:openPDF'),
  openMultiplePDFs: () => ipcRenderer.invoke('dialog:openMultiplePDFs'),
  savePDF: (defaultName) => ipcRenderer.invoke('dialog:savePDF', defaultName),
  writeFile: (filePath, bytes) => ipcRenderer.invoke('fs:writeFile', filePath, bytes),
  openImage: () => ipcRenderer.invoke('dialog:openImage'),
  loadSignature: () => ipcRenderer.invoke('app:loadSignature'),
  saveSignature: (dataURL) => ipcRenderer.invoke('app:saveSignature', dataURL),
});
