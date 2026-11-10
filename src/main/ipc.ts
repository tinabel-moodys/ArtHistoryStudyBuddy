// Main-process IPC handlers (file access the sandboxed renderer can't do itself).
import { dialog, ipcMain } from 'electron';
import * as fs from 'node:fs';
import { normalizePath } from './paths.js';

export function registerIpc(): void {
  ipcMain.handle('read-md', (_event, p: string) => fs.readFileSync(normalizePath(p), 'utf8'));

  ipcMain.handle('pick-md', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
}
