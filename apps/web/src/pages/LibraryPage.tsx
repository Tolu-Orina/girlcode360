import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AppPage,
  leadClass,
  listClass,
  listItemClass,
} from "@/components/blocks/app-page";
import { ArticleReportForm } from "@/components/blocks/article-report";
import { PageHeader } from "@/components/blocks/page-header";
import {
  EmptyState,
  ErrorBanner,
  OfflineBanner,
  SkeletonBlock,
} from "@/components/blocks/states";
import { SegmentedTabs } from "@/components/primitives/segmented-tabs";
import { useOnline } from "@/hooks/use-online";
import type { ContentArticle } from "../../../../packages/api-types/src/index";
import { libraryArticles } from "../../../../packages/domain/src/index";
import { ApiError, detectMarket, getContentArticles, getMe } from "../lib/api";
import { track } from "../lib/analytics";
import { apiBaseUrl } from "../lib/config";

const TOPICS = [
  { id: "all", label: "All" },
  { id: "pcos", label: "PMOS" },
  { id: "cycle", label: "Cycle" },
  { id: "pregnancy", label: "Pregnancy" },
  { id: "ttc", label: "TTC" },
  { id: "privacy", label: "Privacy" },
  { id: "general", label: "Safety" },
] as const;

function formatReviewed(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  });
}

function localArticles(
  market: "UK" | "NG" | "GH",
  topic: string,
): ContentArticle[] {
  return libraryArticles(market, topic === "all" ? undefined : topic);
}

export function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const [articles, setArticles] = useState<ContentArticle[]>([]);
  const [topic, setTopic] = useState("all");
  const [openId, setOpenId] = useState<string | null>(params.get("id"));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [localOnly, setLocalOnly] = useState(false);
  const online = useOnline();
  const deepId = params.get("id");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const fetchTopic = topic === "all" ? undefined : topic;
      try {
        let market: "UK" | "NG" | "GH" = detectMarket();
        if (apiBaseUrl && online) {
          const me = await getMe();
          market = me.market;
          const res = await getContentArticles(market, fetchTopic);
          if (!cancelled) {
            setArticles(res.articles);
            setLocalOnly(false);
          }
        } else if (!cancelled) {
          setArticles(localArticles(market, topic));
          setLocalOnly(true);
        }
      } catch (err) {
        if (!cancelled) {
          setArticles(localArticles(detectMarket(), topic));
          setLocalOnly(true);
          setError(
            err instanceof ApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Could not load library",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [topic, online, deepId]);

  useEffect(() => {
    if (!deepId) return;
    if (articles.some((a) => a.id === deepId)) {
      setOpenId(deepId);
      return;
    }
    if (topic !== "all") setTopic("all");
  }, [deepId, articles, topic]);

  function openArticle(id: string | null) {
    setOpenId(id);
    const next = new URLSearchParams(params);
    if (id) next.set("id", id);
    else next.delete("id");
    setParams(next, { replace: true });
    if (id) {
      const art = articles.find((a) => a.id === id);
      track({
        name: "library_article_open",
        props: { articleId: id, topic: art?.topic ?? topic },
      });
    }
  }

  return (
    <AppPage>
      <PageHeader
        eyebrow="Library"
        title="Read one article"
        lead="Educational wellness. Not medical advice or a diagnosis."
      />

      {!online || localOnly ? (
        <OfflineBanner message="Showing articles stored on this device. Connect to refresh the full library." />
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}

      <SegmentedTabs
        ariaLabel="Topics"
        value={topic}
        onChange={(id) => {
          setTopic(id);
          openArticle(null);
        }}
        items={TOPICS.map((t) => ({ id: t.id, label: t.label }))}
      />

      {loading ? (
        <div className="grid gap-3" aria-busy="true" aria-label="Loading articles">
          <SkeletonBlock className="h-16" />
          <SkeletonBlock className="h-16" />
          <SkeletonBlock className="h-16" />
        </div>
      ) : articles.length === 0 ? (
        <EmptyState
          title="No articles in this topic"
          body="Try All, or another topic."
        />
      ) : (
        <ul className={listClass}>
          {articles.map((a) => {
            const open = openId === a.id;
            return (
              <li key={a.id} className={listItemClass}>
                <button
                  type="button"
                  className="grid min-h-[var(--tap)] w-full gap-2 border-0 bg-transparent p-0 text-left"
                  onClick={() => openArticle(open ? null : a.id)}
                  aria-expanded={open}
                >
                  <strong className="block text-[length:var(--text-body)] text-foreground">
                    {a.title}
                  </strong>
                  <p className={leadClass}>{a.summary}</p>
                  <p className="m-0 text-[length:var(--text-caption)] text-muted-foreground">
                    Last clinically reviewed {formatReviewed(a.reviewedAt)}
                    {a.outdated ? " · Due for clinical review" : ""}
                  </p>
                </button>
                {open ? (
                  <article className="mt-3 grid gap-3">
                    {a.outdated ? (
                      <p
                        className="m-0 rounded-[var(--radius)] border border-border bg-muted px-3 py-2 text-[length:var(--text-caption)] text-foreground"
                        role="status"
                      >
                        Due for clinical review. Last clinically reviewed{" "}
                        {formatReviewed(a.reviewedAt)}.
                      </p>
                    ) : null}
                    <p className="m-0 text-[length:var(--text-body)] leading-normal text-foreground">
                      {a.body}
                    </p>
                    <ArticleReportForm articleId={a.id} online={online} />
                  </article>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </AppPage>
  );
}
