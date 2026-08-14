import { leadClass } from "@/components/blocks/app-page";

/** Plain SVG BBT chart (TTC-F-03 / FR-040). Not a clinical ovulation reading. */
export function BbtChart({
  points,
}: {
  points: Array<{ date: string; bbtC: number }>;
}) {
  if (points.length < 2) {
    return (
      <p className={leadClass}>
        Log BBT on two or more days to see a temperature chart. A sustained rise
        is a pattern some people notice — not proof of ovulation.
      </p>
    );
  }
  const temps = points.map((p) => p.bbtC);
  const min = Math.min(...temps, 35.5);
  const max = Math.max(...temps, 37.5);
  const pad = 0.1;
  const lo = min - pad;
  const hi = max + pad;
  const w = 320;
  const h = 96;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (w - 8) + 4;
    const y = h - 8 - ((p.bbtC - lo) / (hi - lo)) * (h - 16);
    return `${x},${y}`;
  });
  return (
    <div className="grid gap-2">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-24 w-full text-primary"
        role="img"
        aria-label="Basal body temperature over recent days"
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          points={coords.join(" ")}
        />
      </svg>
      <p className={leadClass}>
        {points[0]!.date} → {points[points.length - 1]!.date}. A sustained rise
        after mid-cycle is a pattern some people use as context. This chart is
        not proof of ovulation.
      </p>
    </div>
  );
}
