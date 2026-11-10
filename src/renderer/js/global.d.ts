import type { StudyApi } from '../../shared/api.js';

declare global {
  interface Window {
    api: StudyApi;
  }
}
