import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { AlenaComposer } from "@/components/blocks/alena-composer";
import { AlenaMarkdown } from "@/components/blocks/alena-markdown";
import {
  ErrorBanner,
  OfflineBanner,
} from "@/components/blocks/states";
import { Button } from "@/components/ui/button";
import { useMarketingAuth } from "@/hooks/use-marketing-auth";
import { useOnline } from "@/hooks/use-online";
import {
  ApiError,
  detectMarket,
  postAlenaChat,
  postGuestAlenaChat,
} from "@/lib/api";
import { apiBaseUrl } from "@/lib/config";
import { getSessionOrigin } from "@/lib/session-geo";
import { cn } from "@/lib/utils";
import {
  EMERGENCY_BY_MARKET,
  climateFromMarket,
} from "../../../../../packages/domain/src/index";

const GREET_KEY = "gc360.alenaGreetingSeen";
const easeOut = [0.22, 1, 0.36, 1] as const;

type ChatMsg = { role: "user" | "assistant"; text: string; crisis?: boolean };

const LOCAL_STUB = [
  "I'm Alena, GirlCode360's beauty and wellness companion.",
  "",
  "I don't diagnose, and this page chat does **not** use any health records.",
  "",
  "Ask about general skincare habits, optional cycle logging, or the private Health Wallet. Create an account to talk with Alena using the logs you allow.",
].join("\n");

const PROMPTS = [
  "What is a gentle evening skincare habit?",
  "How do I start logging my cycle?",
  "What does Health Wallet keep?",
];

function chatErrorCopy(code: string, signedIn: boolean): string {
  if (code === "api_base_url_missing" || code === "local_youcam_only") {
    return "The live assistant isn't connected in this build. You can still read a short preview reply.";
  }
  if (code === "message_required") {
    return "Type a message, then send.";
  }
  if (code === "alena_consent_required") {
    return "Alena needs consent in Account before chat that uses your logs.";
  }
  if (code === "quota_exceeded") {
    return "Free chats used up today. Open Alena in the app to see Premium options.";
  }
  if (code === "user_not_bootstrapped" || code === "not_authenticated") {
    return signedIn
      ? "Finish setup in the app to chat with Alena on your account."
      : "Sign in again to chat with Alena on your account.";
  }
  if (code.startsWith("http_5")) {
    return "Alena is unavailable right now. Try again in a moment, or open Alena in the app.";
  }
  return "The message didn't send. Check your connection and try again.";
}

export function AlenaFab() {
  const reduce = useReducedMotion();
  const online = useOnline();
  const { signedIn, continueTo, ready } = useMarketingAuth();
  const alenaTo = signedIn
    ? continueTo === "/onboarding"
      ? "/onboarding"
      : "/app/alena"
    : "/signup";
  const titleId = useId();
  const fabRef = useRef<HTMLButtonElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [market] = useState(() => detectMarket());

  const [open, setOpen] = useState(false);
  const [greet, setGreet] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState(
    "This is AI-generated wellness guidance, not medical advice.",
  );
  const [kbInset, setKbInset] = useState(0);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(GREET_KEY)) return;
    } catch {
      /* private mode */
    }
    setGreet(true);
    const hideMs = reduce ? 2200 : 3200;
    const t = window.setTimeout(() => {
      setGreet(false);
      try {
        sessionStorage.setItem(GREET_KEY, "1");
      } catch {
        /* ignore */
      }
    }, hideMs);
    return () => window.clearTimeout(t);
  }, [reduce]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        fabRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
    bottomRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  }, [msgs, busy, reduce]);

  function dismissGreet() {
    setGreet(false);
    try {
      sessionStorage.setItem(GREET_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  function close() {
    setOpen(false);
    fabRef.current?.focus();
  }

  async function sendMessage() {
    const message = input.trim().slice(0, 500);
    if (!message || busy) return;
    if (apiBaseUrl && !ready) return;
    if (!online && apiBaseUrl) {
      setError("You're offline. Reconnect to send a message.");
      return;
    }
    setError(null);
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: message }]);
    setBusy(true);
    try {
      if (!apiBaseUrl) {
        await new Promise((r) => setTimeout(r, reduce ? 0 : 280));
        setMsgs((m) => [...m, { role: "assistant", text: LOCAL_STUB }]);
        return;
      }
      setMsgs((m) => [...m, { role: "assistant", text: "" }]);
      const origin = getSessionOrigin();
      const res = signedIn
        ? await postAlenaChat(
            {
              message,
              mode: "context",
              openedFrom: "home",
              history: msgs.slice(-6).map((m) => ({
                role: m.role,
                content: m.text,
              })),
              lat: origin?.lat,
              lng: origin?.lng,
              climate: climateFromMarket(market),
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
          )
        : await postGuestAlenaChat(message, market, (delta) => {
            setMsgs((m) => {
              const next = [...m];
              const last = next[next.length - 1];
              if (last?.role !== "assistant") return m;
              next[next.length - 1] = { ...last, text: last.text + delta };
              return next;
            });
          });
      setDisclaimer(res.disclaimer);
      setMsgs((m) => {
        const next = [...m];
        const last = next[next.length - 1];
        const text = res.reply || last?.text || LOCAL_STUB;
        if (last?.role !== "assistant") {
          next.push({ role: "assistant", text, crisis: res.crisis });
          return next;
        }
        next[next.length - 1] = { ...last, text, crisis: res.crisis };
        return next;
      });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "chat_failed";
      if (code === "api_base_url_missing" || code === "local_youcam_only") {
        setMsgs((m) => {
          const next = [...m];
          if (next[next.length - 1]?.role === "assistant" && !next[next.length - 1]?.text) {
            next[next.length - 1] = { role: "assistant", text: LOCAL_STUB };
            return next;
          }
          return [...next, { role: "assistant", text: LOCAL_STUB }];
        });
        return;
      }
      setMsgs((m) => {
        let next = m;
        if (next[next.length - 1]?.role === "assistant") next = next.slice(0, -1);
        if (next[next.length - 1]?.role === "user") next = next.slice(0, -1);
        return next;
      });
      setInput(message);
      setError(chatErrorCopy(code, signedIn));
    } finally {
      setBusy(false);
    }
  }

  const tree = (
    <>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-foreground/45 backdrop-blur-[2px]"
          aria-label="Close Alena"
          onClick={close}
        />
      ) : null}

      <motion.aside
        role="dialog"
        aria-modal={open}
        aria-labelledby={titleId}
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[min(100%,28rem)] flex-col overflow-x-clip border-0 bg-background shadow-[var(--shadow-modal)]",
          !open && "pointer-events-none",
        )}
        initial={false}
        animate={{ x: open ? 0 : "100%" }}
        transition={
          reduce
            ? { duration: 0.15 }
            : { type: "spring", stiffness: 380, damping: 32 }
        }
        style={{ paddingBottom: kbInset }}
      >
        <header className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="m-0 font-[family-name:var(--font-display)] text-[length:var(--text-sub)] font-semibold text-foreground"
            >
              Alena
            </h2>
            <p className="m-0 text-[length:var(--text-caption)] text-muted-foreground">
              Wellness guidance. Not a diagnosis.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close Alena"
            onClick={close}
          >
            <X />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
          <div className="grid gap-3">
            {!online ? (
              <OfflineBanner message="You are offline. Send is paused until you reconnect." />
            ) : null}
            {error ? (
              <ErrorBanner message={error} onRetry={() => setError(null)} />
            ) : null}

            {msgs.length === 0 && !busy ? (
              <div className="grid gap-3 py-8">
                <p className="m-0 text-center text-[length:var(--text-body)] text-muted-foreground">
                  {signedIn
                    ? "Ask with the logs you have allowed. Wellness guidance, not a diagnosis."
                    : "This chat does not use health records. Ask a general wellness or beauty question."}
                </p>
                <p className="m-0 text-center text-[length:var(--text-caption)] text-muted-foreground">
                  {signedIn ? (
                    <>
                      For the full Alena workspace,{" "}
                      <Link
                        to={alenaTo}
                        className="font-semibold text-primary underline underline-offset-2"
                      >
                        open Alena in the app
                      </Link>
                      .
                    </>
                  ) : (
                    <>
                      For Alena with your logs,{" "}
                      <Link
                        to={alenaTo}
                        className="font-semibold text-primary underline underline-offset-2"
                      >
                        create an account
                      </Link>
                      .
                    </>
                  )}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {PROMPTS.map((p) => (
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
        </div>

        <AlenaComposer
          inputId="alena-guest-input"
          value={input}
          onChange={setInput}
          onSend={() => void sendMessage()}
          disabled={(!online && Boolean(apiBaseUrl)) || (Boolean(apiBaseUrl) && !ready)}
          busy={busy}
          hint={disclaimer}
        />
      </motion.aside>

      <div className="pointer-events-none fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 sm:right-6">
        <AnimatePresence>
          {greet && !open ? (
            <motion.p
              key="greet"
              role="status"
              className="pointer-events-none absolute right-[calc(100%+0.75rem)] bottom-1 w-max max-w-[14rem] rounded-[var(--radius-sheet)] border bg-card px-4 py-3 text-[length:var(--text-label)] font-semibold text-foreground shadow-[var(--shadow-2)]"
              initial={reduce ? false : { opacity: 0, x: 12, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, x: 10, scale: 0.98 }
              }
              transition={{ duration: 0.5, ease: easeOut }}
            >
              Hi, I&apos;m Alena
            </motion.p>
          ) : null}
        </AnimatePresence>

        <motion.button
          ref={fabRef}
          type="button"
          hidden={open}
          className="pointer-events-auto grid size-14 place-items-center rounded-full bg-[image:var(--cta-fill)] text-primary-foreground shadow-[var(--shadow-2)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label="Ask Alena"
          aria-expanded={open}
          whileHover={reduce ? undefined : { scale: 1.06 }}
          whileTap={reduce ? undefined : { scale: 0.94 }}
          transition={{ type: "spring", stiffness: 420, damping: 22 }}
          onClick={() => {
            dismissGreet();
            setOpen(true);
          }}
        >
          <MessageCircle className="size-6" />
        </motion.button>
      </div>
    </>
  );

  if (typeof document === "undefined") return null;
  return createPortal(tree, document.body);
}
