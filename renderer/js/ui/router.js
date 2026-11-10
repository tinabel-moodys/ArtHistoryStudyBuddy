// Switches between the app's top-level views. Imports nothing, so any UI module can use it.

const VIEWS = ['home', 'editor', 'study'];
const onEnter = {};

export function register(view, callback) { onEnter[view] = callback; }

export function go(view) {
  for (const id of VIEWS) document.getElementById(id).hidden = id !== view;
  if (onEnter[view]) onEnter[view]();
}
