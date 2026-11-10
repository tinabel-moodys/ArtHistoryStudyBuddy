// Main-process IPC handlers (file access the sandboxed renderer can't do itself).
import { dialog, ipcMain } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { normalizePath } from './paths.js';

const IMPORT_EXTENSIONS = new Set(['.md', '.markdown', '.txt']);
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export function registerIpc(): void {
  // The renderer supplies the path, so treat it as untrusted: markdown-ish files only, regular files only, size-capped.
  ipcMain.handle('read-md', async (event, p: unknown) => {
    if (!event.senderFrame?.url.startsWith('file://')) throw new Error('Untrusted sender');
    if (typeof p !== 'string') throw new Error('Invalid path');
    const file = normalizePath(p);
    if (!IMPORT_EXTENSIONS.has(path.extname(file).toLowerCase())) {
      throw new Error('Only .md, .markdown and .txt files can be imported.');
    }
    const info = await fs.promises.stat(file);
    if (!info.isFile()) throw new Error('Not a regular file');
    if (info.size > MAX_IMPORT_BYTES) throw new Error('File is too large');
    return fs.promises.readFile(file, 'utf8');
  });

  ipcMain.handle('pick-md', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
}
