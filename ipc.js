// Main-process IPC handlers (file access the sandboxed renderer can't do itself).
const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

function normalizePath(p) {
  p = String(p).trim().replace(/^["']|["']$/g, '').replace(/\\ /g, ' ');
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

function registerIpc() {
  ipcMain.handle('read-md', async (_event, p) => fs.readFileSync(normalizePath(p), 'utf8'));

  ipcMain.handle('pick-md', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    });
    return result.canceled ? null : result.filePaths[0];
  });
}

module.exports = { registerIpc };
