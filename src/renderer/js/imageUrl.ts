// Pure check for an image address typed or pasted by the user.
//
// The page's Content-Security-Policy only lets images load from https: and data: addresses, so anything else
// would be saved and then silently show nothing.

const MAX_DATA_URL_LENGTH = 400_000; // roughly 300 KB of image: a resized photo is far smaller

/** An error message to show the user, or null when `url` is fine (an empty string means "no image"). */
export function validateImageUrl(url: string): string | null {
  if (url === '') return null;
  if (url.startsWith('data:image/')) {
    return url.length > MAX_DATA_URL_LENGTH ? 'That image is too large to save. Pick a smaller one or use a link.' : null;
  }
  return /^https:\/\/\S+$/i.test(url) ? null : 'Use an image link that starts with https://, or choose a file.';
}
