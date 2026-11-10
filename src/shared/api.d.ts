/** What the preload script exposes to the page as `window.api`. */
export interface StudyApi {
  /** Read a markdown file (accepts ~, quotes and shell-escaped spaces). */
  readMd: (path: string) => Promise<string>;
  /** Show a file picker; resolves to the chosen path or null if cancelled. */
  pickMd: () => Promise<string | null>;
}
