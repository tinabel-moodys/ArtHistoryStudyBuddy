// Entry point: registers views and routes DOM events to UI actions.
//
// Markup declares behaviour with attributes instead of inline handlers:
//   data-action="view.name"  -> click
//   data-change="view.name"  -> change
//   data-enter="view.name"   -> Enter key
import * as home from './ui/home.js';
import * as editor from './ui/editor.js';
import * as study from './ui/study.js';
import { register, go } from './ui/router.js';

const actions = { ...home.actions, ...editor.actions, ...study.actions };

function dispatch(eventType, attribute) {
  document.addEventListener(eventType, event => {
    if (eventType === 'keydown' && event.key !== 'Enter') return;
    const el = event.target.closest(`[${attribute}]`);
    const handler = el && actions[el.getAttribute(attribute)];
    if (handler) Promise.resolve(handler(el, event)).catch(console.error);
  });
}

dispatch('click', 'data-action');
dispatch('change', 'data-change');
dispatch('keydown', 'data-enter');

register('home', home.render);
go('home');
