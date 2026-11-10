import { validateImageUrl } from '../src/renderer/js/imageUrl.js';

describe('validateImageUrl', () => {
  it('accepts no image, https links and small data: images', () => {
    expect(validateImageUrl('')).toBeNull();
    expect(validateImageUrl('https://upload.wikimedia.org/a/b/painting.jpg')).toBeNull();
    expect(validateImageUrl('HTTPS://example.org/x.png')).toBeNull();
    expect(validateImageUrl('data:image/jpeg;base64,AAAA')).toBeNull();
  });

  it('rejects addresses the page would refuse to load or that could run code', () => {
    for (const bad of ['http://example.org/x.jpg', 'javascript:alert(1)', 'ftp://example.org/x.jpg', 'file:///Users/me/x.png',
      'data:text/html;base64,AAAA', '//example.org/x.jpg', 'example.org/x.jpg', 'https://', 'https://exa mple.org/x.jpg']) {
      expect(validateImageUrl(bad)).toEqual(expect.stringMatching(/\S/));
    }
  });

  it('rejects a data: image that is too large to save', () => {
    expect(validateImageUrl(`data:image/jpeg;base64,${'A'.repeat(400_001)}`)).toMatch(/too large/);
    expect(validateImageUrl(`data:image/jpeg;base64,${'A'.repeat(1000)}`)).toBeNull();
  });
});
