import { useEffect, useState } from "react";
import type { ContentArticle } from "../../../../packages/api-types/src/index";
import { ApiError, getContentArticles, getMe } from "../lib/api";
import { track } from "../lib/analytics";
import { apiBaseUrl } from "../lib/config";
import articlesLocal from "../data/pcos-articles.json";
import "./health.css";

const TOPICS = [
  { id: "", label: "All" },
  { id: "pcos", label: "PCOS" },
  { id: "cycle", label: "Cycle" },
  { id: "pregnancy", label: "Pregnancy" },
  { id: "ttc", label: "TTC" },
  { id: "privacy", label: "Privacy" },
] as const;

export function LibraryPage() {
  const [articles, setArticles] = useState<ContentArticle[]>([]);
  const [topic, setTopic] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let market: "UK" | "NG" | "GH" = "UK";
        if (apiBaseUrl) {
          const me = await getMe();
          market = me.market;
          const res = await getContentArticles(market, topic || undefined);
          if (!cancelled) setArticles(res.articles);
        } else {
          const local = (articlesLocal as ContentArticle[]).map((a) => ({
            ...a,
            topic: "pcos" as const,
            markets: a.markets as ("UK" | "NG" | "GH")[],
          }));
          if (!cancelled) {
            setArticles(
              topic ? local.filter((a) => a.topic === topic) : local,
            );
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.code
              : err instanceof Error
                ? err.message
                : "Could not load library",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [topic]);

  return (
    <section className="health-page">
      <h1>Library</h1>
      <p className="health-lead">
        Educational wellness articles — not medical advice or diagnosis.
      </p>

      <div className="health-tabs" role="tablist" aria-label="Topics">
        {TOPICS.map((t) => (
          <button
            key={t.id || "all"}
            type="button"
            role="tab"
            aria-selected={topic === t.id}
            className={topic === t.id ? "on" : ""}
            onClick={() => setTopic(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <p className="health-error" role="alert">{error}</p> : null}

      <ul className="med-list">
        {articles.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              className="library-item"
              onClick={() => {
                setOpenId(openId === a.id ? null : a.id);
                track({
                  name: "library_article_open",
                  props: { articleId: a.id, topic: a.topic },
                });
              }}
              aria-expanded={openId === a.id}
            >
              <strong>{a.title}</strong>
              <p className="health-lead">{a.summary}</p>
            </button>
            {openId === a.id ? <p>{a.body}</p> : null}
          </li>
        ))}
      </ul>
      {articles.length === 0 ? (
        <p className="health-lead">No articles for this filter.</p>
      ) : null}
    </section>
  );
}
