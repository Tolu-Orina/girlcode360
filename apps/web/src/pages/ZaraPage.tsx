import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type {
  HealthLensReport,
  HealthLensStatus,
  ZaraMode,
} from "../../../../packages/api-types/src/index";
import {
  ApiError,
  createPrepCard,
  generateHealthLensReport,
  getHealthLensStatus,
  getLatestHealthLensReport,
  getZaraQuota,
  postZaraChat,
  setHealthLensPopulationConsent,
} from "../lib/api";
import { track } from "../lib/analytics";
import { apiBaseUrl } from "../lib/config";
import "./health.css";
import "./zara.css";

type ChatMsg = { role: "user" | "assistant"; text: string; crisis?: boolean };

type Panel = "chat" | "lens";

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ZaraPage() {
  const [params] = useSearchParams();
  const [panel, setPanel] = useState<Panel>(
    params.get("panel") === "lens" ? "lens" : "chat",
  );
  const [mode, setMode] = useState<ZaraMode>("context");
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [quota, setQuota] = useState<{
    used: number;
    limit: number | null;
    remaining: number | null;
  } | null>(null);
  const [disclaimer, setDisclaimer] = useState(
    "This is AI-generated wellness guidance, not medical advice.",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hlStatus, setHlStatus] = useState<HealthLensStatus | null>(null);
  const [report, setReport] = useState<HealthLensReport | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ask = params.get("ask");
    if (ask === "report") {
      setPanel("chat");
      setInput(
        "Can you help me understand my latest HealthLens report and suggest questions for my clinician?",
      );
    }
  }, [params]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!apiBaseUrl) return;
      try {
        const [q, status] = await Promise.all([
          getZaraQuota(),
          getHealthLensStatus(),
        ]);
        if (cancelled) return;
        setQuota(q.quota);
        setHlStatus(status);
        try {
          const latest = await getLatestHealthLensReport();
          if (!cancelled) setReport(latest.report);
        } catch {
          /* no report yet */
        }
      } catch (err) {
        if (!cancelled && !(err instanceof ApiError && err.code === "api_base_url_missing")) {
          setError(err instanceof Error ? err.message : "Could not load Zara");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || busy) return;
    setError(null);
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: message }]);
    setBusy(true);
    try {
      if (!apiBaseUrl) {
        setMsgs((m) => [
          ...m,
          {
            role: "assistant",
            text: "Connect the API to chat with Zara. Offline mode only shows this shell.",
          },
        ]);
        return;
      }
      const res = await postZaraChat({ message, mode });
      setQuota(res.quota);
      setDisclaimer(res.disclaimer);
      setMsgs((m) => [
        ...m,
        { role: "assistant", text: res.reply, crisis: res.crisis },
      ]);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      if (code === "zara_consent_required") {
        setError(
          "Zara consent is required for Context mode. Update consents in Account, or switch to Anonymous.",
        );
      } else {
        setError(err instanceof Error ? err.message : "Chat failed");
      }
      setMsgs((m) => m.slice(0, -1));
      setInput(message);
    } finally {
      setBusy(false);
    }
  }

  async function refreshLens() {
    if (!apiBaseUrl) return;
    const status = await getHealthLensStatus();
    setHlStatus(status);
  }

  async function onGenerateReport() {
    setBusy(true);
    setError(null);
    try {
      const res = await generateHealthLensReport();
      setReport(res.report);
      await refreshLens();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      if (code === "healthlens_consent_required") {
        setError("HealthLens consent required — enable it in onboarding/Account.");
      } else if (code === "not_activated") {
        setError("HealthLens unlocks after enough cycle history.");
      } else if (code === "ondemand_cooldown") {
        setError("Free on-demand reports are limited. Try again in 14 days, or go Premium.");
        track({ name: "paywall_shown", props: { surface: "healthlens" } });
      } else {
        setError(err instanceof Error ? err.message : "Report failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onPrepCard() {
    setBusy(true);
    setError(null);
    try {
      const card = await createPrepCard([
        "What patterns should I mention?",
        "What questions should I ask?",
      ]);
      downloadText(card.filename, card.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prep Card failed");
    } finally {
      setBusy(false);
    }
  }

  async function onPopulationToggle(granted: boolean) {
    setBusy(true);
    try {
      const res = await setHealthLensPopulationConsent(granted);
      setHlStatus(res.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save preference");
    } finally {
      setBusy(false);
    }
  }

  const quotaLabel =
    quota?.limit == null
      ? "Premium · unlimited"
      : `${quota.remaining ?? 0} of ${quota.limit} free chats left today`;

  const showPaywall = quota?.limit != null && (quota.remaining ?? 0) <= 0;

  useEffect(() => {
    if (showPaywall) track({ name: "paywall_shown", props: { surface: "zara" } });
  }, [showPaywall]);

  return (
    <section className="health-page zara-page">
      <h1>Zara</h1>
      <p className="health-lead">
        Wellness companion powered by Amazon Nova. Never diagnoses — helps you
        prepare for clinician conversations.
      </p>

      <div className="health-tabs" role="tablist">
        <button
          type="button"
          className={panel === "chat" ? "on" : ""}
          onClick={() => setPanel("chat")}
        >
          Chat
        </button>
        <button
          type="button"
          className={panel === "lens" ? "on" : ""}
          onClick={() => setPanel("lens")}
        >
          HealthLens
        </button>
      </div>

      {error ? <p className="health-error">{error}</p> : null}

      {panel === "chat" ? (
        <div className="health-section zara-chat">
          <div className="zara-toolbar">
            <label>
              Mode{" "}
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as ZaraMode)}
              >
                <option value="context">Context (uses your logs)</option>
                <option value="anonymous">Anonymous</option>
              </select>
            </label>
            <span className="zara-quota">{quotaLabel}</span>
          </div>

          {showPaywall ? (
            <div className="zara-paywall" role="status">
              <p>
                Free Zara chats are used up for today. Premium unlocks unlimited
                conversations.
              </p>
              <Link className="btn primary" to="/app/account">
                View Premium plans
              </Link>
            </div>
          ) : null}

          <div className="zara-thread" aria-live="polite">
            {msgs.length === 0 ? (
              <p className="health-lead">
                Ask about symptoms, cycles, or how to talk to your clinician.
              </p>
            ) : null}
            {msgs.map((m, i) => (
              <div
                key={`${i}-${m.role}`}
                className={`zara-bubble ${m.role}${m.crisis ? " crisis" : ""}`}
              >
                <pre>{m.text}</pre>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <p className="zara-disclaimer">{disclaimer}</p>

          <div className="cycle-actions">
            <button type="button" disabled={busy} onClick={() => void onPrepCard()}>
              Generate Prep Card
            </button>
            {report ? (
              <Link to="/app/zara?ask=report">Ask Zara about report</Link>
            ) : null}
          </div>

          <form className="zara-compose" onSubmit={(e) => void onSend(e)}>
            <label className="sr-only" htmlFor="zara-input">
              Message Zara
            </label>
            <textarea
              id="zara-input"
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              disabled={busy}
            />
            <button type="submit" className="btn primary" disabled={busy || !input.trim()}>
              {busy ? "Sending…" : "Send"}
            </button>
          </form>
        </div>
      ) : (
        <div className="health-section">
          <h2>HealthLens</h2>
          {!hlStatus ? (
            <p className="health-lead">
              {apiBaseUrl
                ? "Loading status…"
                : "Connect the API to see activation progress."}
            </p>
          ) : (
            <>
              <p className="health-lead">{hlStatus.progressLabel}</p>
              <ul className="med-list">
                <li>
                  Cycles logged: {hlStatus.cyclesLogged} / {hlStatus.cyclesNeeded}
                </li>
                <li>
                  Logging span: {hlStatus.loggingSpanDays} / {hlStatus.daysNeeded}{" "}
                  days
                </li>
                <li>
                  Status: {hlStatus.activated ? "Ready" : "Still collecting"}
                </li>
              </ul>

              <label className="zara-consent">
                <input
                  type="checkbox"
                  checked={hlStatus.populationLearningConsent}
                  disabled={busy}
                  onChange={(e) => void onPopulationToggle(e.target.checked)}
                />{" "}
                Allow anonymised population learning (consent stored only — no
                training pipeline yet)
              </label>

              <div className="cycle-actions">
                <button
                  type="button"
                  className="btn primary"
                  disabled={busy || !hlStatus.activated}
                  onClick={() => void onGenerateReport()}
                >
                  Generate report
                </button>
                <button type="button" disabled={busy} onClick={() => void onPrepCard()}>
                  Download Prep Card
                </button>
                <Link to="/app/account">Premium plans</Link>
              </div>

              {report ? (
                <article className="zara-report">
                  <h2>Latest report</h2>
                  <p className="health-lead">
                    Confidence: {report.confidence}
                    {report.stub ? " · stub model" : ""}
                  </p>
                  <pre className="zara-narrative">{report.narrative}</pre>
                  <ul className="med-list">
                    {report.findings.map((f) => (
                      <li key={f.id}>
                        <strong>{f.title}</strong>
                        <p>{f.body}</p>
                        {f.discussWithProvider ? (
                          <p className="health-lead">Worth discussing with a clinician.</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <Link className="btn primary" to="/app/zara?ask=report">
                    Ask Zara about this report
                  </Link>
                </article>
              ) : null}
            </>
          )}
        </div>
      )}
    </section>
  );
}
