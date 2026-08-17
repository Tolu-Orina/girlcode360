import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const easeOut = [0.22, 1, 0.36, 1] as const;

export const mirrorStageWrapClass =
  "mx-auto grid w-[171px] gap-4 lg:mx-0 lg:w-[256px]";
export const mirrorStageBoxClass =
  "relative h-[213px] w-[171px] overflow-hidden rounded-[var(--radius-sheet)] bg-muted shadow-[var(--shadow-2)] lg:h-[320px] lg:w-[256px]";
export const mirrorStudioRowClass =
  "grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[256px_minmax(0,1fr)_minmax(14rem,20rem)] lg:gap-8";

/** Fashion PDP stage: 171×213 on phone, 256×320 on desktop (4:5). */
export function MirrorStage({
  children,
  dock,
  pending,
  pendingLabel,
  className,
}: {
  children: ReactNode;
  dock?: ReactNode;
  pending?: boolean;
  pendingLabel?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <div className={cn(mirrorStageWrapClass, className)}>
      <div className={mirrorStageBoxClass}>
        <div className="absolute inset-0">{children}</div>
        <AnimatePresence>
          {pending ? (
            <motion.div
              key="pending"
              role="status"
              aria-live="polite"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.2, ease: easeOut }}
              className="absolute inset-0 grid place-items-end bg-foreground/20"
            >
              <p className="glass-gloss m-0 mx-4 mb-4 rounded-[var(--radius)] px-4 py-3 text-[length:var(--text-label)] font-semibold text-foreground">
                {pendingLabel ?? "Working…"}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      {dock ? dock : null}
    </div>
  );
}

export function MirrorStageEmpty({
  label = "Face the camera in even light",
  sampleFace = false,
}: {
  label?: string;
  sampleFace?: boolean;
}) {
  return (
    <div className="relative size-full bg-[image:var(--hero-card-fill)]">
      <div
        className="absolute inset-[12%] overflow-hidden rounded-[50%] border border-primary/40"
        aria-hidden
      >
        {sampleFace ? (
          <img
            src="/unnamed-face.jpg"
            alt=""
            className="size-full object-cover object-[center_18%]"
          />
        ) : null}
      </div>
      <p className="sr-only">{label}</p>
    </div>
  );
}
