import "./disclaimer.css";

const DEFAULT =
  "Predictions are wellness estimates based on your logs — not a diagnosis or medical advice.";

export function PredictionDisclaimer({
  message,
}: {
  message?: string;
}) {
  return (
    <p className="prediction-disclaimer" role="note">
      {message?.trim() || DEFAULT}
    </p>
  );
}
