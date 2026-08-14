import { leadClass } from "@/components/blocks/app-page";
import { useAlena } from "@/hooks/use-alena";

export function AskAlenaLink({
  from,
}: {
  from: "cycle" | "health" | "mirror";
}) {
  const { openAlena } = useAlena();
  return (
    <p className={leadClass}>
      <button
        type="button"
        className="font-semibold text-primary underline underline-offset-2"
        onClick={() => openAlena({ from })}
      >
        Ask Alena
      </button>{" "}
      about this screen. Anonymous mode never sends your logs.
    </p>
  );
}

export function AskAlenaWearLink() {
  const { openAlena } = useAlena();
  return (
    <button
      type="button"
      className="font-semibold text-primary underline underline-offset-2"
      onClick={() => openAlena({ from: "mirror", ask: "wear" })}
    >
      Alena
    </button>
  );
}
