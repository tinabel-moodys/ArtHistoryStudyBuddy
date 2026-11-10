// Exposes a small, typed API to the page. The renderer never gets direct Node access.
import { contextBridge, ipcRenderer } from 'electron';
import type { StudyApi } from '../shared/api.js';

const api: StudyApi = {
  readMd: (path) => ipcRenderer.invoke('read-md', path) as Promise<string>,
  pickMd: () => ipcRenderer.invoke('pick-md') as Promise<string | null>,
};

contextBridge.exposeInMainWorld('api', api);
