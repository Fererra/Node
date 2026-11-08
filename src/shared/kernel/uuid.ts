/** Canonical UUID text form (any version), case-insensitive. */
export const UUID_PATTERN =
  '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

const uuidRegExp = new RegExp(UUID_PATTERN);

export function isUuid(value: string): boolean {
  return uuidRegExp.test(value);
}
