export type SafeDateInput = string | number | Date | null | undefined;

export function safeFormatDate(
  value: SafeDateInput,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
  fallback = '—',
) {
  if (value == null || (typeof value === 'string' && !value.trim()))
    return fallback;

  const parsed =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;

  try {
    return new Intl.DateTimeFormat('en', options).format(parsed);
  } catch {
    return fallback;
  }
}
