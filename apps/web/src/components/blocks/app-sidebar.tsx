import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, MessageCircle } from "lucide-react";
import { SIDEBAR_LINKS } from "@/components/blocks/nav-config";
import { useAlena } from "@/hooks/use-alena";
import { useSessionUser } from "@/hooks/use-session-user";
import { signOut } from "@/lib/cognito";
import { cn } from "@/lib/utils";

const navFocus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const itemClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex min-h-12 items-center gap-3 rounded-[var(--radius)] px-3 text-[length:var(--text-label)] font-semibold text-muted-foreground no-underline",
    navFocus,
    "hover:bg-primary/10 hover:text-primary",
    isActive && "bg-primary/10 text-primary",
  );

export function AppSidebar() {
  const { open, openAlena } = useAlena();
  const user = useSessionUser();
  const navigate = useNavigate();

  function logout() {
    try {
      signOut();
    } catch {
      /* cognito may be unset */
    }
    navigate("/signin");
  }

  return (
    <aside className="glass-surface sticky top-0 z-20 hidden h-dvh w-[var(--sidebar-width)] shrink-0 flex-col border-0 shadow-[var(--shadow-2)] lg:flex">
      <div className="flex h-[var(--header-height)] items-center gap-2 px-6">
        <img
          src="/logo.png"
          alt=""
          width={24}
          height={24}
          className="size-6 rounded-[var(--radius)] object-cover"
          decoding="async"
        />
        <span className="font-[family-name:var(--font-display)] text-[length:var(--text-label)] font-bold text-foreground">
          GirlCode360
        </span>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-4" aria-label="Primary">
        {SIDEBAR_LINKS.map((t) => {
          const Icon = t.icon;
          return (
            <NavLink key={t.to} to={t.to} end={t.end} className={itemClass}>
              <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
              {t.label}
            </NavLink>
          );
        })}
        <button
          type="button"
          className={cn(
            "flex min-h-12 items-center gap-3 rounded-[var(--radius)] px-3 text-left text-[length:var(--text-label)] font-semibold text-muted-foreground",
            navFocus,
            "hover:bg-primary/10 hover:text-primary",
            open && "bg-primary/10 text-primary",
          )}
          aria-expanded={open}
          onClick={() => openAlena({ from: "home" })}
        >
          <MessageCircle size={24} strokeWidth={1.75} aria-hidden="true" />
          Alena
        </button>
      </nav>
      <div className="flex items-center gap-2 px-4 py-4">
        <p className="m-0 min-w-0 flex-1 truncate text-[length:var(--text-label)] font-semibold text-foreground">
          {user.displayName ?? "Signed in"}
        </p>
        <button
          type="button"
          className={cn(
            "inline-flex size-12 shrink-0 items-center justify-center rounded-[var(--radius)] text-muted-foreground",
            navFocus,
            "hover:bg-primary/10 hover:text-primary",
          )}
          aria-label="Log out"
          onClick={logout}
        >
          <LogOut size={24} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
