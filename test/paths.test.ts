import * as os from 'node:os';
import * as path from 'node:path';
import { normalizePath } from '../src/main/paths.js';

describe('normalizePath', () => {
  it('trims whitespace and strips surrounding quotes', () => {
    expect(normalizePath('  "/tmp/a b.md"  ')).toBe('/tmp/a b.md');
    expect(normalizePath("'/tmp/a.md'")).toBe('/tmp/a.md');
  });

  it('unescapes shell-escaped spaces (drag-and-drop paths)', () => {
    expect(normalizePath('/Users/me/Obsidian\\ Vault/Exam.md')).toBe('/Users/me/Obsidian Vault/Exam.md');
  });

  it('expands ~ to the home directory', () => {
    expect(normalizePath('~/Documents/exam.md')).toBe(path.join(os.homedir(), '/Documents/exam.md'));
  });

  it('leaves absolute paths unchanged', () => {
    expect(normalizePath('/Users/me/Exam, Oct. 20-Nov 10.md')).toBe('/Users/me/Exam, Oct. 20-Nov 10.md');
  });
});
