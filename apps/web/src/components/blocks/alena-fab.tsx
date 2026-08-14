import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { AlenaMarkdown } from "@/components/blocks/alena-markdown";
import {
  ErrorBanner,
  OfflineBanner,
} from "@/components/blocks/states";
import { FieldTextarea } from "@/components/primitives/field";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/hooks/use-online";
import {
  ApiError,
  detectMarket,
  postGuestAlenaChat,
} from "@/lib/api";
import { apiBaseUrl } from "@/lib/config";
import { cn } from "@/lib/utils";

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

function guestErrorCopy(code: string): string {
  if (code === "api_base_url_missing") {
    return "The live assistant isn't connected in this build. You can still read a short preview reply.";
  }
  if (code.startsWith("http_5")) {
    return "Alena is unavailable right now. Try again in a moment, or create an account to use in-app chat.";
  }
  return "The message didn't send. Check your connection and try again.";
}

export function AlenaFab() {
  const reduce = useReducedMotion();
  const online = useOnline();
  const titleId = useId();
  const inputId = useId();
  const fabRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [greet, setGreet] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState(
    "This is AI-generated wellness guidance, not medical advice.",
  );

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        fabRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const focusT = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(focusT);
    };
  }, [open]);

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

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const message = input.trim().slice(0, 500);
    if (!message || busy) return;
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
      const res = await postGuestAlenaChat(message, detectMarket(), (delta) => {
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
        if (last?.role !== "assistant") {
          next.push({ role: "assistant", text: res.reply, crisis: res.crisis });
          return next;
        }
        next[next.length - 1] = {
          ...last,
          text: res.reply || last.text,
          crisis: res.crisis,
        };
        return next;
      });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "chat_failed";
      if (code === "api_base_url_missing") {
        setMsgs((m) => [...m, { role: "assistant", text: LOCAL_STUB }]);
        return;
      }
      setMsgs((m) => {
        let next = m;
        if (next[next.length - 1]?.role === "assistant") next = next.slice(0, -1);
        const last = next[next.length - 1];
        if (last?.role === "user" && last.text === message) return next.slice(0, -1);
        return next;
      });
      setInput(message);
      setError(guestErrorCopy(code));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pointer-events-none fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex flex-col items-end gap-3 sm:right-6">
      <AnimatePresence>
        {open ? (
          <motion.section
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="pointer-events-auto glass-surface flex h-[min(70dvh,560px)] w-[min(calc(100vw-2rem),24rem)] flex-col overflow-hidden rounded-[var(--radius-sheet)] border shadow-[var(--shadow-modal)]"
            initial={reduce ? false : { opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          >
            <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="m-0 font-[family-name:var(--font-display)] text-[length:var(--text-sub)] font-semibold text-foreground"
                >
                  Alena
                </h2>
                <p className="m-0 text-[length:var(--text-caption)] text-muted-foreground">
                  Beauty and wellness. Not a diagnosis.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close chat"
                onClick={() => {
                  setOpen(false);
                  fabRef.current?.focus();
                }}
              >
                <X />
              </Button>
            </header>

            <div
              className="grid min-h-0 flex-1 gap-3 overflow-y-auto px-4 py-4"
              aria-live="polite"
              aria-busy={busy}
            >
              {!online ? (
                <OfflineBanner message="You're offline. Send is paused until you reconnect." />
              ) : null}
              {error ? (
                <ErrorBanner
                  message={error}
                  onRetry={() => setError(null)}
                />
              ) : null}

              {msgs.length === 0 && !busy ? (
                <div className="grid gap-3 self-center py-6 text-center">
                  <p className="m-0 text-[length:var(--text-body)] text-foreground">
                    This chat does not use health records.
                  </p>
                  <p className="m-0 text-[length:var(--text-caption)] text-muted-foreground">
                    Ask a general wellness or beauty question. For Alena with
                    your logs,{" "}
                    <Link
                      to="/signup"
                      className="font-semibold text-primary underline underline-offset-2"
                    >
                      create an account
                    </Link>
                    .
                  </p>
                </div>
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
                  <AlenaMarkdown text={m.text} />
                </div>
              ))}
              {busy ? (
                <p className="m-0 justify-self-start text-[length:var(--text-caption)] text-muted-foreground">
                  Alena is writing…
                </p>
              ) : null}
              <div ref={bottomRef} />
            </div>

            <p className="m-0 border-t px-4 py-2 text-[length:var(--text-caption)] text-muted-foreground">
              {disclaimer}
            </p>

            <form
              className="grid gap-2 border-t px-4 py-3"
              onSubmit={(e) => void onSend(e)}
            >
              <label className="sr-only" htmlFor={inputId}>
                Message Alena
              </label>
              <FieldTextarea
                ref={inputRef}
                id={inputId}
                rows={2}
                maxLength={500}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Alena…"
                disabled={busy || (!online && Boolean(apiBaseUrl))}
                className="min-h-[4.5rem]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <Button
                type="submit"
                disabled={
                  busy ||
                  !input.trim() ||
                  (!online && Boolean(apiBaseUrl))
                }
              >
                {busy ? "Alena is writing…" : "Send message"}
              </Button>
            </form>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <div className="relative">
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
          className="pointer-events-auto inline-flex size-14 items-center justify-center rounded-full bg-[image:var(--cta-fill)] text-primary-foreground shadow-[var(--shadow-2)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label={open ? "Close chat with Alena" : "Chat with Alena"}
          aria-expanded={open}
          whileHover={reduce ? undefined : { scale: 1.06 }}
          whileTap={reduce ? undefined : { scale: 0.94 }}
          transition={{ type: "spring", stiffness: 420, damping: 22 }}
          onClick={() => {
            dismissGreet();
            setOpen((v) => !v);
          }}
        >
          {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
        </motion.button>
      </div>
    </div>
  );
}
