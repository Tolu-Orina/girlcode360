import { leadClass } from "@/components/blocks/app-page";
import { useAlena } from "@/hooks/use-alena";

export function AskAlenaLink({
  from,
  brief,
}: {
  from: "cycle" | "health" | "mirror";
  brief?: boolean;
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
      </button>
      {brief ? " about this screen." : " about this screen. Anonymous mode never sends your logs."}
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
