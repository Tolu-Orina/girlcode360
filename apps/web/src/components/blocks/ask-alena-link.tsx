import { Link } from "react-router-dom";
import { leadClass } from "@/components/blocks/app-page";

export function AskAlenaLink({
  from,
}: {
  from: "cycle" | "health" | "mirror";
}) {
  return (
    <p className={leadClass}>
      <Link to={`/app/alena?from=${from}`} className="font-semibold text-primary">
        Ask Alena
      </Link>{" "}
      about this screen. Anonymous mode never sends your logs.
    </p>
  );
}
