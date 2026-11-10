/**
 * @jest-environment jsdom
 */
// The resizing itself needs a real <canvas>, which jsdom doesn't have; it is checked in Electron instead.
// Everything that decides whether a file is acceptable happens before that and is tested here.
import { fileToDataUrl } from '../src/renderer/js/ui/image.js';

describe('fileToDataUrl', () => {
  it('refuses a file that is not an image', async () => {
    await expect(fileToDataUrl(new File(['hello'], 'notes.txt', { type: 'text/plain' }))).rejects.toThrow('not an image');
    await expect(fileToDataUrl(new File(['%PDF'], 'a.pdf', { type: 'application/pdf' }))).rejects.toThrow('not an image');
    await expect(fileToDataUrl(new File(['x'], 'unknown', { type: '' }))).rejects.toThrow('not an image');
  });

  it('refuses a very large file without trying to read it', async () => {
    const huge = new File([new Uint8Array(16 * 1024 * 1024)], 'huge.png', { type: 'image/png' });
    await expect(fileToDataUrl(huge)).rejects.toThrow('too large');
  });
});
