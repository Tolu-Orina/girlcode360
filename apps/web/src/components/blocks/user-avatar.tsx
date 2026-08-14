import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const navFocus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function UserAvatar({
  initials,
  name,
}: {
  initials: string;
  name: string | null;
}) {
  return (
    <Link
      to="/app/account"
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 font-[family-name:var(--font-display)] text-[length:var(--text-caption)] font-bold text-primary no-underline",
        navFocus,
      )}
      aria-label={name ? `Account, ${name}` : "Account"}
    >
      {initials}
    </Link>
  );
}
