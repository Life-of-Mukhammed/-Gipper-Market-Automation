/**
 * The product catalog is entered inconsistently: many otherwise-Cyrillic
 * names contain visually-identical Latin homoglyphs (e.g. "Aквалюкс" with a
 * Latin "A", "Orbiта" with a Latin "O"). A cashier typing the name in pure
 * Cyrillic then fails to find those rows, so search "works in Latin but not
 * Cyrillic". We fix this by folding the confusable Latin letters to their
 * Cyrillic twins on BOTH the query and the searched text, so either script
 * matches the same row.
 *
 * Only glyph-identical lowercase pairs are folded (Latin -> Cyrillic). Because
 * the same fold is applied to both sides, folding can never drop a legitimate
 * match — it can only make the comparison script-insensitive.
 *
 * FROM/TO must stay character-aligned. They are re-exported for the SQL side
 * (see `homoglyphContains`) so the JS (offline) and SQL (online) paths agree
 * exactly.
 */
export const HOMOGLYPH_FROM = "aceopxy";
export const HOMOGLYPH_TO = "асеорху"; // Cyrillic: а с е о р х у

const HOMOGLYPH_MAP: Record<string, string> = Object.fromEntries(
  [...HOMOGLYPH_FROM].map((ch, i) => [ch, HOMOGLYPH_TO[i]]),
);

/** Canonical search form: lowercased with Latin homoglyphs folded to Cyrillic. */
export function foldSearch(value: string): string {
  return value.toLowerCase().replace(/[aceopxy]/g, (ch) => HOMOGLYPH_MAP[ch] ?? ch);
}
