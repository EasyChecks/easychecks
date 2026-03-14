const THAI_OFFSET_MS = 7 * 60 * 60 * 1000;

export function toThaiIso(date: Date | string | null | undefined): string | null {
  if (!date) return null;

  const utcDate = new Date(date);
  if (Number.isNaN(utcDate.getTime())) return null;

  return new Date(utcDate.getTime() + THAI_OFFSET_MS).toISOString().replace('Z', '+07:00');
}

export function getThaiDayRange(baseDate: Date = new Date()): { start: Date; end: Date } {
  const shifted = new Date(baseDate.getTime() + THAI_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);

  const start = new Date(shifted.getTime() - THAI_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function getThaiDayOfWeekIndex(baseDate: Date = new Date()): number {
  const shifted = new Date(baseDate.getTime() + THAI_OFFSET_MS);
  return shifted.getUTCDay();
}

export function getThaiDateOnly(baseDate: Date = new Date()): string {
  const shifted = new Date(baseDate.getTime() + THAI_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getThaiTimeHHMM(baseDate: Date = new Date()): string {
  const shifted = new Date(baseDate.getTime() + THAI_OFFSET_MS);
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
