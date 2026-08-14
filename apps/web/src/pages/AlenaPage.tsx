import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ActionRow,
  AppPage,
  formStackClass,
  leadClass,
  listClass,
  listItemClass,
  outlinedCardClass,
} from "@/components/blocks/app-page";
import { PageHeader } from "@/components/blocks/page-header";
import { AlenaMarkdown } from "@/components/blocks/alena-markdown";
import {
  EmptyState,
  ErrorBanner,
  OfflineBanner,
  SkeletonBlock,
} from "@/components/blocks/states";
import { FieldSelect, FieldTextarea } from "@/components/primitives/field";
import { SegmentedTabs } from "@/components/primitives/segmented-tabs";
import { PageTip } from "@/components/blocks/page-tip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  setHealthLensPopulationConsent,
} from "../lib/api";
import { track } from "../lib/analytics";
import { apiBaseUrl } from "../lib/config";
import { getSessionOrigin } from "@/lib/session-geo";

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

function writeStoredMode(mode: AlenaMode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* ignore */
  }
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
  return undefined;
}

export function AlenaPage() {
  const [params] = useSearchParams();
  const openedFrom = openedFromParam(params.get("from"));
  const [panel, setPanel] = useState<Panel>(
    params.get("panel") === "lens" ? "lens" : "chat",
  );
  const stored = readStoredMode();
  const [mode, setMode] = useState<AlenaMode>(stored ?? "context");
  const [modeChosen, setModeChosen] = useState(stored != null);
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
    const ask = params.get("ask");
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
  }, [params]);

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
      } else if (code === "alena_busy") {
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
    if (showPaywall) track({ name: "paywall_shown", props: { surface: "alena" } });
  }, [showPaywall]);

  return (
    <AppPage>
      <PageHeader
        eyebrow="Alena"
        title="Ask Alena"
        lead="Wellness guidance from Amazon Nova. Never a diagnosis. Help for clinician conversations."
      />
      <PageTip id="alena" />

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

      <SegmentedTabs
        ariaLabel="Alena panels"
        value={panel}
        onChange={(id) => setPanel(id as Panel)}
        items={[
          { id: "chat", label: "Chat" },
          { id: "lens", label: "HealthLens" },
        ]}
      />

      {panel === "chat" ? (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <FieldSelect
              aria-label="Chat mode"
              value={mode}
              onChange={(e) => {
                const next = e.target.value as AlenaMode;
                setMode(next);
                writeStoredMode(next);
                setModeChosen(true);
              }}
              className="max-w-xs"
            >
              <option value="context">Context (uses your logs)</option>
              <option value="anonymous">Anonymous</option>
            </FieldSelect>
            {quotaLoading ? (
              <SkeletonBlock className="h-8 w-40" />
            ) : (
              <span className="text-[length:var(--text-caption)] text-muted-foreground">
                {quotaLabel}
              </span>
            )}
          </div>

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

          {!modeChosen ? (
            <div className={cn(outlinedCardClass, "grid gap-3")}>
              <h2 className="m-0 text-[length:var(--text-sub)]">
                How should Alena answer?
              </h2>
              <p className={leadClass}>
                Context uses a short, nameless summary of your logs. Anonymous
                answers general questions only.
              </p>
              <ActionRow>
                <Button
                  type="button"
                  onClick={() => {
                    setMode("context");
                    writeStoredMode("context");
                    setModeChosen(true);
                  }}
                >
                  Use my logs
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setMode("anonymous");
                    writeStoredMode("anonymous");
                    setModeChosen(true);
                  }}
                >
                  Stay anonymous
                </Button>
              </ActionRow>
            </div>
          ) : null}

          {alenaConsent === false ? (
            <ErrorBanner message="Alena needs consent in Account before chat — including anonymous mode, which still uses the model." />
          ) : null}

          {openedFrom ? (
            <p className={leadClass}>
              Opened from {openedFrom}. Context mode may include a short hint
              from that screen — never photos or names.
            </p>
          ) : null}

          <div className="grid gap-3">
            <FieldSelect
              aria-label="Session climate"
              value={climate}
              onChange={(e) =>
                setClimate(
                  e.target.value as (typeof WARDROBE_CLIMATES)[number],
                )
              }
              className="max-w-xs"
            >
              {WARDROBE_CLIMATES.map((c) => (
                <option key={c} value={c}>
                  Climate: {c} (not live weather)
                </option>
              ))}
            </FieldSelect>
            <ActionRow>
              <Button
                type="button"
                variant="outline"
                disabled={busy || showPaywall || !online}
                onClick={() => setInput("What should I wear today?")}
              >
                What should I wear today?
              </Button>
            </ActionRow>
          </div>

          <div
            className="grid max-h-[min(58dvh,560px)] min-h-[min(36dvh,280px)] gap-3 overflow-y-auto rounded-[var(--radius)] border border-border bg-card p-4"
            aria-live="polite"
          >
            {msgs.length === 0 ? (
              <EmptyState
                title="Ask Alena"
                body="Ask about symptoms, cycles, what to wear from your closet, or how to talk to your clinician."
              />
            ) : null}
            {msgs.map((m, i) => (
              <div
                key={`${i}-${m.role}`}
                className={cn(
                  "max-w-[92%] rounded-[var(--radius)] px-4 py-3",
                  m.role === "user"
                    ? "justify-self-end bg-primary text-primary-foreground"
                    : "justify-self-start bg-muted text-foreground",
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
                          className="font-semibold text-primary underline underline-offset-2"
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

          <p className={leadClass}>{disclaimer}</p>

          <ActionRow>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void onPrepCard()}
            >
              Generate Prep Card
            </Button>
            {msgs.length ? (
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setMsgs([])}
              >
                Clear chat
              </Button>
            ) : null}
            {report ? (
              <Button asChild variant="ghost">
                <Link to="/app/alena?ask=report">Ask Alena about report</Link>
              </Button>
            ) : null}
          </ActionRow>

          <form
            className="sticky z-20 grid gap-2 border-t border-border bg-background pt-4 lg:bottom-0"
            style={{
              bottom: `calc(var(--tabbar-height) + env(safe-area-inset-bottom) + ${kbInset}px)`,
            }}
            onSubmit={(e) => void onSend(e)}
          >
            <label className="sr-only" htmlFor="alena-input">
              Message Alena
            </label>
            <FieldTextarea
              id="alena-input"
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              disabled={
                busy ||
                showPaywall ||
                !online ||
                alenaConsent === false
              }
            />
            <Button
              type="submit"
              disabled={
                busy ||
                !input.trim() ||
                showPaywall ||
                !online ||
                !modeChosen ||
                alenaConsent === false
              }
            >
              {busy ? "Alena is writing…" : "Send"}
            </Button>
          </form>
        </div>
      ) : (
        <div className={formStackClass}>
          <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
            HealthLens
          </h2>
          <p className={leadClass}>
            These are patterns in your logged data, not a medical assessment.
            Monthly reports generate when HealthLens consent is on and enough
            history exists. On-demand reports on the free tier are once every
            14 days.
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
              <p className={leadClass}>{hlStatus.progressLabel}</p>
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

              <Label className="flex items-start gap-3 text-[length:var(--text-body)] font-normal">
                <Checkbox
                  checked={hlStatus.populationLearningConsent}
                  disabled={busy}
                  onCheckedChange={(v) => void onPopulationToggle(v === true)}
                />
                Allow anonymised population learning (consent stored only; no
                training pipeline yet)
              </Label>

              <ActionRow>
                <Button
                  type="button"
                  variant="secondary"
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
                <Button asChild variant="ghost">
                  <Link to="/app/account">Premium plans</Link>
                </Button>
              </ActionRow>

              {report ? (
                <article className={cn(outlinedCardClass, "grid gap-4")}>
                  <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
                    Latest report
                  </h2>
                  <p className={leadClass}>
                    Confidence: {report.confidence}
                    {report.stub ? " · stub model" : ""}
                  </p>
                  <pre className="m-0 rounded-[var(--radius)] bg-muted p-4 font-sans text-[length:var(--text-body)] leading-normal whitespace-pre-wrap">
                    {report.narrative}
                  </pre>
                  <ul className={listClass}>
                    {report.findings.map((f) => (
                      <li key={f.id} className={listItemClass}>
                        <strong className="block text-foreground">{f.title}</strong>
                        <p className={leadClass}>{f.body}</p>
                        {f.discussWithProvider ? (
                          <p className={leadClass}>
                            Worth discussing with a clinician.
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <Button asChild variant="outline">
                    <Link to="/app/alena?ask=report">
                      Ask Alena about this report
                    </Link>
                  </Button>
                </article>
              ) : null}
            </>
          )}
        </div>
      )}
    </AppPage>
  );
}
