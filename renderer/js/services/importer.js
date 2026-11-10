// Turns an exam markdown file into ready-to-save exam content:
// parses it, fills missing definitions (Wikipedia) and finds images for works.
import { parseExamMarkdown } from '../markdown.js';
import { define } from '../api/wikipedia.js';
import { findWorkImage } from './imageFinder.js';
import { lookupNationality } from './nationality.js';

/**
 * @param {string} text markdown source
 * @param {(message: string) => void} [onProgress]
 * @returns {Promise<{ title: string, terms: object[], works: object[], noImage: string[] }>}
 */
export async function importExam(text, onProgress = () => {}) {
  const parsed = parseExamMarkdown(text);

  const terms = [];
  for (const [i, t] of parsed.terms.entries()) {
    let { def } = t;
    let src = '';
    if (!def) {
      onProgress(`Defining term ${i + 1}/${parsed.terms.length}...`);
      ({ def, src } = await define(t.term));
    }
    terms.push({ term: t.term, def, src });
  }

  const works = [];
  const noImage = [];
  for (const [i, w] of parsed.works.entries()) {
    onProgress(`Looking up work ${i + 1}/${parsed.works.length}...`);
    const [{ img, src }, nationality] = await Promise.all([findWorkImage(w), lookupNationality(w.artist)]);
    if (!img) noImage.push(w.title);
    works.push({ id: `md-${w.artist}|${w.title}`, title: w.title, artist: w.artist, nationality, date: w.date, img, src });
  }

  return { title: parsed.title, terms, works, noImage };
}
