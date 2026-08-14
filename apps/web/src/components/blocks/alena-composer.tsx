import { useRef, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function AlenaComposer({
  value,
  onChange,
  onSend,
  disabled,
  busy,
  hint,
}: {
  value: string;
  onChange: (next: string) => void;
  onSend: () => void;
  disabled: boolean;
  busy: boolean;
  hint?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSend = !disabled && !busy && value.trim().length > 0;

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!canSend) return;
    onSend();
    requestAnimationFrame(() => {
      const el = ref.current;
      if (el) el.style.height = "auto";
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing || e.key === "Process") return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form className="shrink-0 px-4 pb-4" onSubmit={submit}>
      <div
        className={cn(
          "relative rounded-[var(--radius-sheet)] bg-card py-3 pr-12 pl-4 shadow-[var(--shadow-2)]",
          "focus-within:ring-2 focus-within:ring-ring",
        )}
      >
        <label className="sr-only" htmlFor="alena-input">
          Message Alena
        </label>
        <textarea
          ref={ref}
          id="alena-input"
          rows={1}
          value={value}
          disabled={disabled || busy}
          placeholder="Ask Alena…"
          onChange={(e) => {
            onChange(e.target.value);
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
          }}
          onKeyDown={onKeyDown}
          className="max-h-32 min-h-6 w-full resize-none border-0 bg-transparent text-[length:var(--text-body)] text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label={busy ? "Alena is writing" : "Send"}
          className={cn(
            "absolute right-2 bottom-2 inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:bg-muted disabled:text-muted-foreground",
          )}
        >
          <ArrowUp size={16} strokeWidth={2.25} aria-hidden />
        </button>
      </div>
      {hint ? (
        <p className="m-0 mt-2 text-[length:var(--text-caption)] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </form>
  );
}
