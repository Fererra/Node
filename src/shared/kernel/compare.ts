/**
 * Orders strings by code point, like PostgreSQL's `C` collation, so the
 * in-memory and database stages sort text the same way.
 */
export function compareText(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
