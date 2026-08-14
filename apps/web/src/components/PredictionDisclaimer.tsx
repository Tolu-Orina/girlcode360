const DEFAULT =
  "Predictions are wellness estimates based on your logs, not a diagnosis or medical advice.";

export function PredictionDisclaimer({
  message,
}: {
  message?: string;
}) {
  return (
    <p
      className="m-0 border-l-4 border-primary py-3 pl-4 text-[length:var(--text-caption)] leading-normal text-muted-foreground"
      role="note"
    >
      {message?.trim() || DEFAULT}
    </p>
  );
}
