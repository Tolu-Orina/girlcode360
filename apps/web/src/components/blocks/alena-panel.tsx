import { useEffect, useId, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { AlenaPage } from "@/pages/AlenaPage";
import { useAlena } from "@/hooks/use-alena";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AlenaHost() {
  const { open, closeAlena, openAlena } = useAlena();
  const reduce = useReducedMotion();
  const titleId = useId();
  const fabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeAlena();
        fabRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, closeAlena]);

  return (
    <>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-foreground/45 backdrop-blur-[2px]"
          aria-label="Close Alena"
          onClick={closeAlena}
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
            onClick={() => {
              closeAlena();
              fabRef.current?.focus();
            }}
          >
            <X />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <AlenaPage embedded />
        </div>
      </motion.aside>

      <motion.button
        ref={fabRef}
        type="button"
        className="fixed right-4 bottom-[calc(var(--tabbar-height)+env(safe-area-inset-bottom)+8px)] z-30 grid size-14 place-items-center rounded-full bg-[image:var(--cta-fill)] text-primary-foreground shadow-[var(--shadow-2)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:bottom-8 lg:right-8"
        aria-label="Ask Alena"
        aria-expanded={open}
        hidden={open}
        whileHover={reduce ? undefined : { scale: 1.06 }}
        whileTap={reduce ? undefined : { scale: 0.94 }}
        onClick={() => openAlena({ from: "home" })}
      >
        <MessageCircle className="size-6" />
      </motion.button>
    </>
  );
}
