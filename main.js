// Main process: creates the window. File access lives in ipc.js.
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { registerIpc } = require('./ipc');

function createWindow() {
  const win = new BrowserWindow({
    width: 560,
    height: 780,
    title: 'Art History Study',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });

  // Open external links (source citations) in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

registerIpc();
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
