export function ScoreBar({
  label,
  value,
  max = 100,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  const clamped = Math.min(max, Math.max(0, value));
  const pct = max === 0 ? 0 : (clamped / max) * 100;
  return (
    <div className="grid gap-1">
      <p className="m-0 text-[length:var(--text-label)] text-foreground">
        {label} {Math.round(clamped)} of {max}
      </p>
      <span
        className="block h-2 overflow-hidden rounded-sm bg-muted"
        aria-hidden="true"
      >
        <span
          className="block h-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </span>
    </div>
  );
}
