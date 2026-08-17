export function ctaLabel(busy: boolean, idle: string): string {
  return busy ? "Loading…" : idle;
}
