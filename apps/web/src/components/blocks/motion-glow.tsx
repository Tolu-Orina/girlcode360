import { type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Cruip / conic-spin edge glow: a 160% conic layer rotates behind the card;
 * content sits at m-[2px] / z-10 so only a 2px ring shows. Brand rose, not neon.
 */
export function GlowFrame({
  children,
  className,
  innerClassName,
  delay = 0,
  duration = 4,
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  delay?: number;
  duration?: number;
}) {
  const reduce = useReducedMotion();

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-sheet)]",
        className,
      )}
    >
      {reduce ? null : (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 h-[160%] w-[160%] -translate-x-1/2 -translate-y-1/2 bg-[conic-gradient(transparent,var(--primary),var(--brand-soft),transparent_30%)]"
          animate={{ rotate: 360 }}
          transition={{
            repeat: Infinity,
            duration,
            ease: "linear",
            delay,
          }}
        />
      )}
      <div
        className={cn(
          "relative z-10 m-[2px] overflow-hidden rounded-[calc(var(--radius-sheet)-2px)]",
          innerClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Gradient sheen that sweeps across a CTA. Parent must be `relative overflow-hidden`. */
export function ShineSweep() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-primary-foreground/50 to-transparent skew-x-12"
      initial={{ x: "-160%" }}
      animate={{ x: "340%" }}
      transition={{
        duration: 1.7,
        repeat: Infinity,
        repeatDelay: 2.2,
        ease: [0.4, 0, 0.2, 1],
      }}
    />
  );
}
