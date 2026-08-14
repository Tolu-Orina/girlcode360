import { NavLink } from "react-router-dom";
import { MOBILE_TABS } from "@/components/blocks/nav-config";
import { useAlena } from "@/hooks/use-alena";
import { cn } from "@/lib/utils";

const itemFocus =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function TabBar() {
  const { open, openAlena } = useAlena();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 px-4 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] lg:hidden"
      aria-label="Mobile primary"
    >
      <ul
        className="glass-gloss m-0 flex list-none items-center justify-between rounded-full px-2 py-2"
      >
        {MOBILE_TABS.map((t) => {
          const Icon = t.icon;
          const alena = t.to === "__alena__";
          const body = (isActive: boolean) => (
            <span className="flex flex-col items-center gap-1">
              <Icon
                size={24}
                strokeWidth={isActive ? 2.25 : 1.75}
                className={isActive ? "text-primary" : "text-muted-foreground"}
                aria-hidden="true"
              />
              <span
                className={cn(
                  "text-[length:var(--text-caption)] font-semibold",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                {t.label}
              </span>
            </span>
          );

          return (
            <li key={t.to} className="m-0 min-w-0 flex-1">
              {alena ? (
                <button
                  type="button"
                  className={cn(
                    "flex min-h-12 w-full items-center justify-center rounded-[var(--radius)]",
                    itemFocus,
                  )}
                  aria-label="Ask Alena"
                  aria-expanded={open}
                  onClick={() => openAlena({ from: "home" })}
                >
                  {body(open)}
                </button>
              ) : (
                <NavLink
                  to={t.to}
                  end={t.end}
                  className={cn(
                    "flex min-h-12 w-full items-center justify-center rounded-[var(--radius)] no-underline",
                    itemFocus,
                  )}
                >
                  {({ isActive }) => body(isActive)}
                </NavLink>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
