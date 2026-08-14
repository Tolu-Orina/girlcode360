import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AppPage,
  leadClass,
  listClass,
  listItemClass,
} from "@/components/blocks/app-page";
import { PageHeader } from "@/components/blocks/page-header";
import {
  EmptyState,
  ErrorBanner,
  OfflineBanner,
  SkeletonBlock,
} from "@/components/blocks/states";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/hooks/use-online";
import {
  ApiError,
  getInAppInbox,
  markInAppAllRead,
  markInAppRead,
} from "@/lib/api";
import { apiBaseUrl } from "@/lib/config";
import type { InAppNotification } from "../../../../packages/api-types/src/index";

export function InboxPage() {
  const online = useOnline();
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [optIn, setOptIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!apiBaseUrl) throw new ApiError(0, "api_base_url_missing");
      const res = await getInAppInbox();
      setItems(res.items);
      setNote(res.note);
      setOptIn(res.marketingOptIn);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load inbox");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRead(id: string) {
    setBusy(true);
    try {
      const res = await markInAppRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? res.item : n)));
    } catch {
      /* keep unread */
    } finally {
      setBusy(false);
    }
  }

  async function onReadAll() {
    setBusy(true);
    try {
      await markInAppAllRead();
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    } catch {
      /* keep */
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppPage>
      <PageHeader
        eyebrow="Inbox"
        title="In-app notices"
        lead="New listings and partner offers stay here. They are never lock-screen push. Health reminders use the Notifications toggles in Account."
      />
      {!online ? <OfflineBanner /> : null}
      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}
      {note ? <p className={leadClass}>{note}</p> : null}
      {!optIn ? (
        <p className={leadClass}>
          Marketing is off. Turn on Marketing messages in{" "}
          <Link to="/app/account">Account</Link> if you want listing notices.
        </p>
      ) : null}

      {items.some((n) => !n.readAt) ? (
        <Button type="button" variant="outline" disabled={busy} onClick={() => void onReadAll()}>
          Mark all read
        </Button>
      ) : null}

      {loading ? (
        <div className="grid gap-3" aria-busy="true" aria-label="Loading inbox">
          <SkeletonBlock className="h-20" />
          <SkeletonBlock className="h-20" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="Nothing in the inbox"
          body={
            optIn
              ? "When a listing in your market goes live, it will show here. GPS is not stored for this."
              : "Opt in to marketing in Account to receive listing and partner notices in this inbox."
          }
        />
      ) : (
        <ul className={listClass}>
          {items.map((n) => (
            <li key={n.id} className={listItemClass}>
              <p className="m-0 text-[length:var(--text-caption)] font-semibold uppercase text-primary">
                {n.kind === "promo" ? "Promotional" : "New listing"}
                {n.readAt ? "" : " · unread"}
              </p>
              <p className="m-0 mt-1 text-[length:var(--text-sub)] text-foreground">
                {n.title}
              </p>
              <p className={leadClass}>{n.body}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link to="/app/marketplace">Open Marketplace</Link>
                </Button>
                {!n.readAt ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void onRead(n.id)}
                  >
                    Mark read
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppPage>
  );
}
