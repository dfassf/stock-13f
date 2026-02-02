export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

export function parseNumber(value: string | number | undefined, defaultValue: number = 0): number {
  if (typeof value === 'number') {
    return isNaN(value) ? defaultValue : value;
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

export function safeParseInt(value: string | number | undefined, defaultValue: number = 0): number {
  return parseNumber(value, defaultValue);
}
