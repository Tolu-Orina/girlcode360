import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ActionRow,
  AppPage,
  leadClass,
  listClass,
  listItemClass,
} from "@/components/blocks/app-page";
import { AlenaComposer } from "@/components/blocks/alena-composer";
import { AlenaMarkdown } from "@/components/blocks/alena-markdown";
import {
  EmptyState,
  ErrorBanner,
  OfflineBanner,
  SkeletonBlock,
} from "@/components/blocks/states";
import { SegmentedTabs } from "@/components/primitives/segmented-tabs";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/hooks/use-online";
import { cn } from "@/lib/utils";
import type {
  HealthLensReport,
  HealthLensStatus,
  AlenaMode,
  HealthModule,
  Market,
} from "../../../../packages/api-types/src/index";
import { EMERGENCY_BY_MARKET, WARDROBE_CLIMATES, climateFromMarket } from "../../../../packages/domain/src/index";
import {
  ApiError,
  createPrepCard,
  generateHealthLensReport,
  getConsents,
  getHealthLensStatus,
  getLatestHealthLensReport,
  getMe,
  getAlenaQuota,
  postAlenaChat,
} from "../lib/api";
import { track } from "../lib/analytics";
import { apiBaseUrl } from "../lib/config";
import { getSessionOrigin } from "@/lib/session-geo";
import { useAlena } from "@/hooks/use-alena";

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

const MODE_KEY = "gc360.alenaMode";

function readStoredMode(): AlenaMode | null {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === "context" || v === "anonymous") return v;
  } catch {
    /* private mode */
  }
  return null;
}

function openedFromParam(
  raw: string | null,
): "cycle" | "health" | "mirror" | "home" | "library" | undefined {
  if (
    raw === "cycle" ||
    raw === "health" ||
    raw === "mirror" ||
    raw === "home" ||
    raw === "library"
  ) {
    return raw;
  }
  return undefined;
}

function moduleHintFor(
  from: ReturnType<typeof openedFromParam>,
): HealthModule | undefined {
  if (from === "cycle") return "period_tracker";
  if (from === "health") return "pcos_manager";
  if (from === "mirror") return "mirror";
  return undefined;
}

export function AlenaPage({ embedded = false }: { embedded?: boolean }) {
  const alena = useAlena();
  const [params] = useSearchParams();
  const openedFrom =
    alena.opts.from ?? openedFromParam(params.get("from"));
  const [panel, setPanel] = useState<Panel>(
    alena.opts.panel ?? (params.get("panel") === "lens" ? "lens" : "chat"),
  );
  const stored = readStoredMode();
  const [mode] = useState<AlenaMode>(stored ?? "context");
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
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [kbInset, setKbInset] = useState(0);
  const [alenaConsent, setAlenaConsent] = useState<boolean | null>(null);
  const [market, setMarket] = useState<Market>("UK");
  const [climate, setClimate] = useState<(typeof WARDROBE_CLIMATES)[number]>(
    "temperate",
  );
  const online = useOnline();

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ask = alena.opts.ask ?? params.get("ask");
    if (ask === "report") {
      setPanel("chat");
      setInput(
        "Can you help me understand my latest HealthLens report and suggest questions for my clinician?",
      );
    }
    if (ask === "wear") {
      setPanel("chat");
      setInput("What should I wear today?");
    }
    if (alena.opts.panel) setPanel(alena.opts.panel);
  }, [params, alena.opts.ask, alena.opts.panel]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      const obscured = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKbInset(obscured);
    };
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!apiBaseUrl) {
        setQuotaLoading(false);
        return;
      }
      try {
        const [q, status, consents, me] = await Promise.all([
          getAlenaQuota(),
          getHealthLensStatus(),
          getConsents(),
          getMe(),
        ]);
        if (cancelled) return;
        setQuota(q.quota);
        setHlStatus(status);
        setMarket(me.market);
        setClimate(climateFromMarket(me.market));
        const granted = consents.current.find(
          (c) => c.purpose === "ai_alena" || (c.purpose as string) === "ai_zara",
        )?.granted;
        setAlenaConsent(granted === true);
        try {
          const latest = await getLatestHealthLensReport();
          if (!cancelled) setReport(latest.report);
        } catch {
          /* no report yet */
        }
      } catch (err) {
        if (!cancelled && !(err instanceof ApiError && err.code === "api_base_url_missing")) {
          setError(err instanceof Error ? err.message : "Could not load Alena");
        }
      } finally {
        if (!cancelled) setQuotaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function sendMessage() {
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
            text: "Connect the API to chat with Alena. Offline mode only shows this shell.",
          },
        ]);
        return;
      }
      const origin = getSessionOrigin();
      setMsgs((m) => [...m, { role: "assistant", text: "" }]);
      const res = await postAlenaChat(
        {
          message,
          mode,
          openedFrom,
          moduleHint: moduleHintFor(openedFrom),
          history: msgs.slice(-6).map((m) => ({
            role: m.role,
            content: m.text,
          })),
          lat: origin?.lat,
          lng: origin?.lng,
          climate,
        },
        (delta) => {
          setMsgs((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last?.role !== "assistant") return m;
            next[next.length - 1] = { ...last, text: last.text + delta };
            return next;
          });
        },
      );
      setQuota(res.quota);
      setDisclaimer(res.disclaimer);
      setMsgs((m) => {
        const next = [...m];
        const last = next[next.length - 1];
        if (last?.role !== "assistant") {
          next.push({
            role: "assistant",
            text: res.crisis
              ? res.reply
              : res.stub
                ? `${res.reply || "Alena is running in fallback mode."}\n\n(Model fallback — answers may be limited until Bedrock is available.)`
                : res.reply,
            crisis: res.crisis,
          });
          return next;
        }
        const text = res.crisis
          ? res.reply
          : res.stub
            ? `${res.reply || last.text || "Alena is running in fallback mode."}\n\n(Model fallback — answers may be limited until Bedrock is available.)`
            : res.reply || last.text;
        next[next.length - 1] = { ...last, text, crisis: res.crisis };
        return next;
      });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      if (code === "alena_consent_required") {
        setError(
          "Alena needs consent in Account before chat. Anonymous mode still uses the model, so it is gated the same way.",
        );
      } else if (code === "quota_exceeded") {
        setQuota((q) =>
          q ? { ...q, remaining: 0, used: q.limit ?? q.used } : q,
        );
        setError("Free chats used up today. Premium unlocks unlimited conversations.");
        track({ name: "paywall_shown", props: { surface: "alena" } });
      } else if (code === "alena_busy" || code === "alena_unavailable" || code?.startsWith("http_5")) {
        setError("Alena is busy right now. Wait a moment and try again.");
      } else {
        setError(err instanceof Error ? err.message : "Chat failed");
      }
      setMsgs((m) => {
        let next = m;
        if (next[next.length - 1]?.role === "assistant") next = next.slice(0, -1);
        if (next[next.length - 1]?.role === "user") next = next.slice(0, -1);
        return next;
      });
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
        setError("HealthLens consent required. Enable it in Account.");
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

  const quotaLabel =
    quota?.limit == null
      ? "Premium · unlimited"
      : `${quota.remaining ?? 0} of ${quota.limit} free chats left today`;

  const showPaywall = quota?.limit != null && (quota.remaining ?? 0) <= 0;

  useEffect(() => {
    if (showPaywall) track({ name: "paywall_shown", props: { surface: "alena" } });
  }, [showPaywall]);

  const composerOff =
    busy || showPaywall || !online || alenaConsent === false;

  const prompts = [
    "What should I wear today?",
    "Help me talk to my clinician.",
  ];

  const chrome = (
    <div className="grid gap-3">
      {!online ? (
        <OfflineBanner message="You are offline. Send is paused until you reconnect." />
      ) : null}
      {error ? (
        <ErrorBanner
          message={error}
          onRetry={
            error.includes("consent")
              ? undefined
              : () => {
                  setError(null);
                }
          }
        />
      ) : null}
      {alenaConsent === false ? (
        <ErrorBanner message="Alena needs consent in Account before chat." />
      ) : null}
      <SegmentedTabs
        ariaLabel="Alena panels"
        value={panel}
        onChange={(id) => setPanel(id as Panel)}
        className="border-0 bg-card shadow-[var(--shadow-2)]"
        items={[
          { id: "chat", label: "Chat" },
          { id: "lens", label: "HealthLens" },
        ]}
      />
    </div>
  );

  const chatThread = (
    <div className="grid gap-3" aria-live="polite">
      {showPaywall ? (
        <EmptyState
          title="Free chats used up today"
          body="Premium unlocks unlimited conversations."
          action={
            <Button asChild variant="outline">
              <Link to="/app/account">View Premium plans</Link>
            </Button>
          }
        />
      ) : null}
      {msgs.length === 0 && !showPaywall ? (
        <div className="grid gap-3 py-8">
          <p className="m-0 text-center text-[length:var(--text-body)] text-muted-foreground">
            Ask about your cycle, what to wear, or how to talk to a clinician.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {prompts.map((p) => (
              <button
                key={p}
                type="button"
                className="min-h-12 rounded-full bg-muted px-4 text-[length:var(--text-label)] font-semibold text-foreground"
                onClick={() => setInput(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {msgs.map((m, i) => (
        <div
          key={`${i}-${m.role}`}
          className={cn(
            "max-w-[92%] rounded-[var(--radius-sheet)] px-4 py-3",
            m.role === "user"
              ? "justify-self-end bg-primary text-primary-foreground shadow-[var(--shadow-2)]"
              : "justify-self-start bg-card text-foreground shadow-[var(--shadow-2)]",
            m.crisis && "outline outline-2 outline-destructive",
          )}
        >
          {m.role === "assistant" ? (
            <AlenaMarkdown text={m.text} />
          ) : (
            <p className="m-0 text-[length:var(--text-body)] leading-normal whitespace-pre-wrap">
              {m.text}
            </p>
          )}
          {m.crisis ? (
            <ul className="mt-3 grid list-none gap-1 p-0">
              {EMERGENCY_BY_MARKET[market].map((n) => (
                <li key={n.number}>
                  <a
                    className="font-semibold underline underline-offset-2"
                    href={`tel:${n.number.replace(/\s/g, "")}`}
                  >
                    {n.label}: {n.number}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
      {busy ? (
        <p className="m-0 justify-self-start text-[length:var(--text-caption)] text-muted-foreground">
          Alena is writing…
        </p>
      ) : null}
      <div ref={bottomRef} />
    </div>
  );

  const lens = (
    <div className="grid gap-4">
      <p className={leadClass}>
        Patterns in your logs, not a medical assessment.
      </p>
      {!hlStatus ? (
        quotaLoading ? (
          <SkeletonBlock className="h-24" />
        ) : (
          <p className={leadClass}>
            {apiBaseUrl
              ? "Loading status…"
              : "Connect the API to see activation progress."}
          </p>
        )
      ) : (
        <>
          <p className="m-0 text-[length:var(--text-body)] text-foreground">
            {hlStatus.progressLabel}
          </p>
          <ul className={listClass}>
            <li className={listItemClass}>
              Cycles logged: {hlStatus.cyclesLogged} / {hlStatus.cyclesNeeded}
            </li>
            <li className={listItemClass}>
              Logging span: {hlStatus.loggingSpanDays} / {hlStatus.daysNeeded}{" "}
              days
            </li>
            <li className={listItemClass}>
              Status: {hlStatus.activated ? "Ready" : "Still collecting"}
            </li>
          </ul>
          <ActionRow>
            <Button
              type="button"
              disabled={busy || !hlStatus.activated}
              onClick={() => void onGenerateReport()}
            >
              Generate report
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void onPrepCard()}
            >
              Download Prep Card
            </Button>
          </ActionRow>
          {report ? (
            <article className="grid gap-4 rounded-[var(--radius-sheet)] bg-card p-4 shadow-[var(--shadow-2)]">
              <h3 className="m-0 text-[length:var(--text-label)] font-semibold text-foreground">
                Latest report
              </h3>
              <p className={leadClass}>
                Confidence: {report.confidence}
                {report.stub ? " · stub model" : ""}
              </p>
              <pre className="m-0 font-sans text-[length:var(--text-body)] leading-normal whitespace-pre-wrap">
                {report.narrative}
              </pre>
              <ul className={listClass}>
                {report.findings.map((f) => (
                  <li key={f.id} className={listItemClass}>
                    <strong className="block text-foreground">{f.title}</strong>
                    <p className={leadClass}>{f.body}</p>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  alena.openAlena({ ask: "report", panel: "chat" })
                }
              >
                Ask Alena about this report
              </Button>
            </article>
          ) : null}
        </>
      )}
    </div>
  );

  const shell = (
    <div
      className="flex h-full min-h-0 flex-col"
      style={embedded ? { paddingBottom: kbInset } : undefined}
    >
      <div className="shrink-0 px-4 pt-3">{chrome}</div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {panel === "chat" ? chatThread : lens}
      </div>
      {panel === "chat" ? (
        <AlenaComposer
          value={input}
          onChange={setInput}
          onSend={() => void sendMessage()}
          disabled={composerOff}
          busy={busy}
          hint={quotaLoading ? undefined : `${quotaLabel}. ${disclaimer}`}
        />
      ) : null}
    </div>
  );

  if (embedded) return shell;
  return <AppPage className="h-[min(80dvh,720px)] max-w-none p-0">{shell}</AppPage>;
}

