// Tiny DOM helpers shared by the UI modules.

export const $ = id => document.getElementById(id);

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESCAPES[c]);

export const sourceLink = url =>
  /^https?:/.test(url || '')
    ? `<div class="small"><a class="source" href="${esc(url)}" target="_blank">Source ↗</a></div>`
    : '';

export const thumb = src => (src ? `<img src="${esc(src)}">` : '<div class="thumb"></div>');

/** One thumbnail + text + action row, shared by search results and the added-works list. */
export const resultRow = ({ img, title, subtitle = '', button }) => `
  <div class="result">${thumb(img)}
    <div class="text">${esc(title)}${subtitle ? `<br><span class="small">${esc(subtitle)}</span>` : ''}</div>
    ${button}
  </div>`;
