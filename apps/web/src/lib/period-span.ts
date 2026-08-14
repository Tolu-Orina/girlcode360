export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return ymd(d);
}

export function datesInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function typicalPeriodLength(periodLengthDays: number | undefined): number {
  if (!periodLengthDays || !Number.isFinite(periodLengthDays)) return 5;
  return Math.min(10, Math.max(1, Math.round(periodLengthDays)));
}
