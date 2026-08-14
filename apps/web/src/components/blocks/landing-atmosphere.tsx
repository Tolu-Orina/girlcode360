import { motion, useReducedMotion } from "framer-motion";

/**
 * Landing atmosphere. Motion owns transform (x/y/scale) so bubbles can drift.
 * Placement uses top/left only — never Tailwind translate, which fights Motion.
 */
const ORBS = [
  {
    className:
      "top-[-8%] right-[-6%] size-[22rem] bg-[color-mix(in_srgb,var(--orb-a)_88%,transparent)] blur-3xl",
    x: [0, 80, -40, 0],
    y: [0, 50, 16, 0],
    duration: 22,
  },
  {
    className:
      "bottom-[8%] left-[-8%] size-[18rem] bg-[color-mix(in_srgb,var(--orb-b)_70%,transparent)] blur-3xl",
    x: [0, -70, 48, 0],
    y: [0, -60, 28, 0],
    duration: 26,
  },
] as const;

const bubbleFill = {
  blush:
    "bg-[radial-gradient(circle_at_32%_28%,#fff_0%,color-mix(in_srgb,var(--orb-a)_90%,transparent)_42%,color-mix(in_srgb,var(--primary)_42%,transparent)_100%)]",
  rose: "bg-[radial-gradient(circle_at_30%_26%,#fff_0%,color-mix(in_srgb,var(--accent)_85%,transparent)_46%,color-mix(in_srgb,var(--brand-soft)_48%,transparent)_100%)]",
  berry:
    "bg-[radial-gradient(circle_at_34%_30%,#fff_0%,color-mix(in_srgb,var(--primary)_40%,transparent)_100%)]",
  orchid:
    "bg-[radial-gradient(circle_at_28%_24%,#fff_0%,color-mix(in_srgb,var(--orb-b)_55%,transparent)_100%)]",
} as const;

const BUBBLES = [
  {
    className: "top-[16%] left-[8%] size-28",
    fill: bubbleFill.blush,
    x: [0, 48, -24, 0],
    y: [0, 56, -32, 0],
    scale: [1, 1.08, 0.94, 1],
    duration: 14,
  },
  {
    className: "top-[12%] right-[14%] size-20",
    fill: bubbleFill.orchid,
    x: [0, -56, 28, 0],
    y: [0, 64, -20, 0],
    scale: [1, 1.1, 0.92, 1],
    duration: 12,
  },
  {
    className: "top-[32%] left-[28%] size-24",
    fill: bubbleFill.rose,
    x: [0, 64, -40, 0],
    y: [0, -48, 36, 0],
    scale: [1, 1.06, 0.95, 1],
    duration: 13,
  },
  {
    className: "top-[28%] right-[28%] size-[4.5rem]",
    fill: bubbleFill.blush,
    x: [0, -52, 36, 0],
    y: [0, 72, -28, 0],
    scale: [1, 0.9, 1.12, 1],
    duration: 11,
  },
  {
    className: "top-[44%] left-[46%] size-24",
    fill: bubbleFill.berry,
    x: [0, 36, -28, 0],
    y: [0, -44, 32, 0],
    scale: [1, 1.08, 0.94, 1],
    duration: 11,
  },
  {
    className: "top-[54%] left-[52%] size-16",
    fill: bubbleFill.orchid,
    x: [0, -40, 24, 0],
    y: [0, 48, -28, 0],
    scale: [1, 0.9, 1.12, 1],
    duration: 10,
  },
  {
    className: "top-[42%] right-[8%] size-32",
    fill: bubbleFill.rose,
    x: [0, -72, 32, 0],
    y: [0, 48, -56, 0],
    scale: [1, 1.08, 0.93, 1],
    duration: 15,
  },
  {
    className: "top-[58%] left-[22%] size-14",
    fill: bubbleFill.orchid,
    x: [0, 56, -36, 0],
    y: [0, -80, 24, 0],
    scale: [1, 1.16, 0.88, 1],
    duration: 9,
  },
  {
    className: "top-[62%] right-[24%] size-20",
    fill: bubbleFill.berry,
    x: [0, -48, 44, 0],
    y: [0, 40, -64, 0],
    scale: [1, 0.92, 1.1, 1],
    duration: 12,
  },
  {
    className: "bottom-[18%] left-[10%] size-[5.5rem]",
    fill: bubbleFill.rose,
    x: [0, 60, -28, 0],
    y: [0, -52, 36, 0],
    scale: [1, 1.07, 0.94, 1],
    duration: 16,
  },
  {
    className: "bottom-[12%] right-[12%] size-24",
    fill: bubbleFill.blush,
    x: [0, -64, 24, 0],
    y: [0, -44, 28, 0],
    scale: [1, 0.94, 1.08, 1],
    duration: 14,
  },
] as const;

const bubbleChrome =
  "absolute rounded-full shadow-[inset_-10px_-14px_24px_color-mix(in_srgb,var(--primary)_18%,transparent),0_8px_24px_color-mix(in_srgb,var(--primary)_16%,transparent)] ring-1 ring-white/70";

export function LandingAtmosphere() {
  const reduce = useReducedMotion();

  return (
    <div
      className="landing-atmosphere pointer-events-none fixed inset-0 z-[1]"
      aria-hidden="true"
    >
      {ORBS.map((orb, i) => (
        <motion.div
          key={`orb-${i}`}
          className={`absolute rounded-full ${orb.className}`}
          animate={{ x: [...orb.x], y: [...orb.y] }}
          transition={{
            duration: reduce ? orb.duration * 1.6 : orb.duration,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
      {BUBBLES.map((b, i) => (
        <motion.div
          key={`bubble-${i}`}
          className={`${bubbleChrome} ${b.className} ${b.fill}`}
          animate={{
            x: [...b.x],
            y: [...b.y],
            scale: [...b.scale],
            opacity: [0.78, 0.92, 0.7, 0.78],
          }}
          transition={{
            duration: reduce ? b.duration * 1.8 : b.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.35,
          }}
        />
      ))}
    </div>
  );
}
