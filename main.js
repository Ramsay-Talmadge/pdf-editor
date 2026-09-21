const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'PDF Editor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('renderer/index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('dialog:openPDF', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Open PDF',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) return null;
  const filePath = filePaths[0];
  const data = fs.readFileSync(filePath);
  return { filePath, data: data.buffer };
});

ipcMain.handle('dialog:openMultiplePDFs', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select PDFs to Merge',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    properties: ['openFile', 'multiSelections'],
  });
  if (canceled || filePaths.length === 0) return null;
  return filePaths.map(filePath => ({
    filePath,
    data: fs.readFileSync(filePath).buffer,
  }));
});

ipcMain.handle('dialog:savePDF', async (_, defaultName) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save PDF',
    defaultPath: defaultName || 'output.pdf',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  });
  return canceled ? null : filePath;
});

ipcMain.handle('fs:writeFile', async (_, filePath, bytes) => {
  fs.writeFileSync(filePath, Buffer.from(bytes));
});

ipcMain.handle('dialog:openImage', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select Image',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) return null;
  const data = fs.readFileSync(filePaths[0]);
  const ext = path.extname(filePaths[0]).toLowerCase().replace('.', '');
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  return { dataURL: `data:${mime};base64,` + data.toString('base64') };
});

ipcMain.handle('app:loadSignature', async () => {
  const sigPath = path.join(app.getPath('userData'), 'last-signature.png');
  if (!fs.existsSync(sigPath)) return null;
  return 'data:image/png;base64,' + fs.readFileSync(sigPath).toString('base64');
});

ipcMain.handle('app:saveSignature', async (_, dataURL) => {
  const sigPath = path.join(app.getPath('userData'), 'last-signature.png');
  const base64 = dataURL.replace(/^data:image\/\w+;base64,/, '');
  fs.writeFileSync(sigPath, Buffer.from(base64, 'base64'));
});
