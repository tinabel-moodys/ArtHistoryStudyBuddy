const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 560,
    height: 780,
    title: 'Art History Study',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadFile('index.html');
}

ipcMain.handle('read-md', async (_e, p) => {
  p = String(p).trim().replace(/^["']|["']$/g, '').replace(/\\ /g, ' ');
  if (p.startsWith('~')) p = path.join(os.homedir(), p.slice(1));
  return fs.readFileSync(p, 'utf8');
});

ipcMain.handle('pick-md', async () => {
  const r = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
  });
  return r.canceled ? null : r.filePaths[0];
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
