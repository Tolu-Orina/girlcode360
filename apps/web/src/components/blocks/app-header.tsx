import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell } from "lucide-react";
import { AppSearch } from "@/components/blocks/app-search";
import { UserAvatar } from "@/components/blocks/user-avatar";
import { useStandalone } from "@/hooks/use-media-query";
import { useSessionUser } from "@/hooks/use-session-user";
import { getInAppInbox } from "@/lib/api";
import { apiBaseUrl } from "@/lib/config";
import { cn } from "@/lib/utils";

const navFocus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function AppHeader() {
  const homeTo = useStandalone() ? "/app" : "/";
  const user = useSessionUser();

  return (
    <header className="glass-surface sticky top-0 z-20 flex min-h-[calc(var(--header-height)+env(safe-area-inset-top))] items-center gap-4 border-0 px-4 pt-[env(safe-area-inset-top)] shadow-[var(--shadow-2)] lg:px-6">
      <Link
        to={homeTo}
        className={cn(
          "brand-mark brand-lockup inline-flex min-h-[var(--tap)] shrink-0 items-center gap-2 rounded-[var(--radius)] text-[length:var(--text-sub)] text-primary no-underline lg:hidden",
          navFocus,
        )}
        aria-label="GirlCode360"
      >
        <img
          src="/logo.png"
          alt=""
          width={24}
          height={24}
          className="brand-lockup-mark size-6 object-cover"
          decoding="async"
        />
        GirlCode360
      </Link>
      <AppSearch />
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <InboxBell />
        <UserAvatar initials={user.initials} name={user.displayName} />
      </div>
    </header>
  );
}

function InboxBell() {
  const [unread, setUnread] = useState(0);
  const location = useLocation();

  useEffect(() => {
    if (!apiBaseUrl) return;
    let cancelled = false;
    void getInAppInbox()
      .then((res) => {
        if (!cancelled) setUnread(res.unread);
      })
      .catch(() => {
        /* stay quiet */
      });
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  return (
    <Link
      to="/app/inbox"
      className={cn(
        "relative inline-flex min-h-[var(--tap)] min-w-[var(--tap)] items-center justify-center rounded-[var(--radius)] text-muted-foreground no-underline",
        navFocus,
        "hover:bg-primary/10 hover:text-primary",
      )}
      aria-label={unread ? `Inbox, ${unread} unread` : "Inbox"}
    >
      <Bell size={20} strokeWidth={1.75} aria-hidden="true" />
      {unread > 0 ? (
        <span
          className="absolute top-2 right-2 size-2 rounded-full bg-primary"
          aria-hidden
        />
      ) : null}
    </Link>
  );
}

