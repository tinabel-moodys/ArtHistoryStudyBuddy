import { maskTerm } from '../src/renderer/js/textMask.js';

/** Masks, then asserts none of `needles` survive (case-insensitive). */
function hides(definition: string, term: string, ...needles: string[]): string {
  const masked = maskTerm(definition, term);
  for (const needle of needles) expect(masked.toLowerCase()).not.toContain(needle.toLowerCase());
  return masked;
}

describe('maskTerm', () => {
  it('masks the term case-insensitively', () => {
    expect(maskTerm('Orientalism is a style. orientalism again.', 'Orientalism')).toBe('_____ is a style. _____ again.');
  });

  it('masks related word forms of long single-word terms', () => {
    expect(maskTerm('Impressionist painters, the Impressionists, worked outdoors.', 'Impressionism'))
      .toBe('_____ painters, the _____, worked outdoors.');
  });

  it('ignores accents and treats hyphen and space alike', () => {
    hides('Salon des Refusés was held.', 'Refuses', 'Refus');
    expect(maskTerm('En plein air, or plein air painting, is outdoors.', 'Plein-air painting'))
      .toBe('En plein air, or _____, is outdoors.');
  });

  it('masks each part of a slash-separated term and drops a trailing date', () => {
    hides('Neo-impressionism is a style. Pointillism uses dots.', 'Neo-Impressionism/Pointillism', 'impressionism', 'pointillism');
    hides('The Salon of 1863 was famous.', 'Salon, 1863', 'Salon');
  });

  it('falls back to distinctive words when the phrase is not verbatim', () => {
    const masked = hides('The Salon des Refusés of 1863 was held.', 'Salon De Refuses, 1863', 'Salon', 'Refus', '1863');
    expect(masked).toMatch(/_____ des _____/);
  });

  it('leaves unrelated text and words inside larger words alone', () => {
    expect(maskTerm('Nothing to see here.', 'Zzzzz')).toBe('Nothing to see here.');
    expect(maskTerm('Surrealism came after realism.', 'Realism')).toBe('Surrealism came after _____.');
  });

  it('keeps the definition otherwise intact', () => {
    expect(maskTerm('The Hudson River school was a mid-19th-century American art movement.', 'Hudson River School'))
      .toBe('The _____ was a mid-19th-century American art movement.');
  });
});
