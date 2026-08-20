import { type Column, type SQL, sql } from "drizzle-orm";
import { foldSearch, HOMOGLYPH_FROM, HOMOGLYPH_TO } from "@/lib/search";

/**
 * Server-side homoglyph-aware search (see `@/lib/search`). Kept in its own
 * module so the pure `foldSearch` helper can be imported by client components
 * without pulling drizzle-orm into the browser bundle.
 */

/** SQL expression that folds a column the same way `foldSearch` folds a query. */
function foldColumn(column: Column | SQL): SQL {
  return sql`translate(lower(${column}), ${HOMOGLYPH_FROM}, ${HOMOGLYPH_TO})`;
}

/**
 * Script-insensitive substring match — the homoglyph-aware replacement for
 * `ilike(column, '%q%')`. Pass the raw user query; it is folded internally.
 */
export function homoglyphContains(column: Column | SQL, query: string): SQL {
  return sql`${foldColumn(column)} like ${`%${foldSearch(query)}%`}`;
}
