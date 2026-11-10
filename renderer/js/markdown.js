// Pure text parsing: markdown exam files and the editor's "term: definition" format.
// No DOM, no network.

export const stripMd = s =>
  s.replace(/\*\*|__|`/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*/g, '')
    .trim();

/** "Artist, Title, 1814 (p. 994)" -> { artist, title, date } */
export function parseWork(line) {
  let rest = line.replace(/\s*\(p+\.[^)]*\)\s*$/i, '').trim();
  let date = '';
  const dateMatch = rest.match(/,\s*((?:c\.\s*)?\d{3,4}(?:\s*[-–]\s*\d{2,4})?)\s*$/i);
  if (dateMatch) {
    date = dateMatch[1];
    rest = rest.slice(0, dateMatch.index).trim();
  }
  const comma = rest.indexOf(',');
  return comma > 0
    ? { artist: rest.slice(0, comma).trim(), title: rest.slice(comma + 1).trim(), date }
    : { artist: '', title: rest, date };
}

/** "Term: definition", "Term - definition", or bare "Term" -> { term, def } */
export function parseTermLine(line) {
  const m = line.match(/^(.+?)\s*(?::|\s[—–-]\s)\s*(.+)$/);
  return m ? { term: m[1].trim(), def: m[2].trim() } : { term: line, def: '' };
}

/**
 * Parse an exam markdown file.
 * `# Title`, then `## ...Terms` / `## ...Works` sections of bullet or numbered lists.
 */
export function parseExamMarkdown(text) {
  const result = { title: '', terms: [], works: [] };
  let section = null;

  for (const raw of text.split('\n')) {
    const heading = raw.match(/^(#{1,6})\s+(.*)/);
    if (heading) {
      const [, hashes, label] = heading;
      const lower = label.toLowerCase();
      if (hashes === '#' && !result.title) result.title = stripMd(label);
      if (lower.includes('term')) section = 'terms';
      else if (lower.includes('work')) section = 'works';
      else if (hashes !== '#') section = null;
      continue;
    }
    const bullet = raw.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)/);
    if (!bullet || !section) continue;
    const line = stripMd(bullet[1]);
    if (!line) continue;
    if (section === 'terms') result.terms.push(parseTermLine(line));
    else result.works.push(parseWork(line));
  }
  return result;
}

/** Editor textarea ("term: definition" per line) -> [{ term, def }] */
export function parseTermLines(text) {
  return text.split('\n')
    .map(line => {
      const i = line.indexOf(':');
      return i > 0
        ? { term: line.slice(0, i).trim(), def: line.slice(i + 1).trim() }
        : { term: line.trim(), def: '' };
    })
    .filter(t => t.term);
}

export const formatTermLines = terms => terms.map(t => `${t.term}: ${t.def}`).join('\n');
