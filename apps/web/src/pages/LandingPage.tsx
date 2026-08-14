import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { AlenaFab } from "@/components/blocks/alena-fab";
import { LandingAtmosphere } from "@/components/blocks/landing-atmosphere";
import { GlowFrame, ShineSweep } from "@/components/blocks/motion-glow";
import { MarketingFooter, MarketingHeader } from "@/components/blocks/marketing-chrome";
import { marketingHeroPad, marketingPad } from "@/components/blocks/marketing-layout";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

const easeOut = [0.22, 1, 0.36, 1] as const;

const CORE = [
  {
    src: "/images/landing-wallet.png",
    alt: "Private paper records on a table",
    title: "Health Wallet",
    body: "Keep labs, prescriptions and scans together. You choose when to share them.",
  },
  {
    src: "/images/period-tracker.jpg",
    alt: "Illustrated calendar with period days circled, next to pads, a menstrual cup, and a pill pack",
    title: "Cycle and PMOS",
    body: "Track your cycle and hormonal patterns over time, without a one-size-fits-all calendar.",
  },
  {
    src: "/images/fashion-girlcode.jpg",
    alt: "Fashion and style editorial portrait",
    title: "Mirror",
    body: "Understand your skin, hair and style in the same place as the rest of you. Not a diagnosis.",
  },
] as const;

const CITY = [
  {
    src: "/images/beauty-clinic.webp",
    alt: "Beauty clinic waiting area with soft lighting",
    title: "Near you",
    body: "When you know what you need, finding pharmacies, clinics and beauty nearby should be easier. Listings here are samples, not live places.",
  },
  {
    src: "/images/landing-alena.png",
    alt: "Woman journaling at a table",
    title: "Alena",
    body: "Ask in plain language. Alena can use the health context you've already shared, so you don't start from scratch. She will not diagnose.",
  },
] as const;

const STEPS = [
  {
    src: "/images/woman-smile1.jpg",
    alt: "Woman smiling in soft light",
    n: "01",
    title: "Create your account",
    body: "Create your private space and choose what you want to share.",
  },
  {
    src: "/images/auth-panel-morning.png",
    alt: "Woman in morning light",
    n: "02",
    title: "Choose what matters to you",
    body: "Start with cycle, health, fertility, pregnancy or beauty. You don't have to use everything.",
  },
  {
    src: "/images/auth-panel-journal.png",
    alt: "Woman journaling",
    n: "03",
    title: "Keep moving",
    body: "As your life changes, your context can move with you. You don't have to start over.",
  },
] as const;

const page = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } },
};

function rise(reduce: boolean | null) {
  if (reduce) {
    return {
      hidden: { opacity: 1 },
      show: { opacity: 1, transition: { duration: 0.15 } },
    };
  }
  return {
    hidden: { opacity: 0, y: 40 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, ease: easeOut },
    },
  };
}

function mediaRise(reduce: boolean | null) {
  if (reduce) {
    return {
      hidden: { opacity: 1, clipPath: "inset(0% 0% 0% 0% round 16px)" },
      show: { opacity: 1, clipPath: "inset(0% 0% 0% 0% round 16px)" },
    };
  }
  return {
    hidden: {
      opacity: 0,
      y: 48,
      clipPath: "inset(14% 10% 14% 10% round 28px)",
    },
    show: {
      opacity: 1,
      y: 0,
      clipPath: "inset(0% 0% 0% 0% round 16px)",
      transition: { duration: 0.8, ease: easeOut },
    },
  };
}

function TiltStage({
  children,
  reduce,
  className,
}: {
  children: ReactNode;
  reduce: boolean | null;
  className?: string;
}) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), {
    stiffness: 220,
    damping: 18,
  });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), {
    stiffness: 220,
    damping: 18,
  });

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }

  function onLeave() {
    mx.set(0);
    my.set(0);
  }

  return (
    <motion.div
      className={className}
      style={
        reduce
          ? undefined
          : { perspective: 900, rotateX, rotateY, transformStyle: "preserve-3d" }
      }
      onMouseMove={reduce ? undefined : onMove}
      onMouseLeave={reduce ? undefined : onLeave}
    >
      {children}
    </motion.div>
  );
}

function MirrorGauge({ score }: { score: number }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative grid size-16 place-items-center lg:size-24">
      <svg viewBox="0 0 36 36" className="size-16 -rotate-90 lg:size-24" aria-hidden="true">
        <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-muted" strokeWidth="3" />
        <motion.circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          className="stroke-primary"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: reduce ? score / 100 : score / 100 }}
          transition={
            reduce
              ? { duration: 0.15 }
              : { duration: 1.2, ease: easeOut, delay: 0.4 }
          }
        />
      </svg>
      <span className="absolute grid place-items-center text-center">
        <strong className="text-[length:var(--text-sub)] leading-none text-foreground">
          {score}
        </strong>
        <span className="text-[length:var(--text-caption)] font-semibold tracking-wide text-muted-foreground uppercase">
          Score
        </span>
      </span>
    </div>
  );
}

function MotionScoreBar({ label, value }: { label: string; value: number }) {
  const reduce = useReducedMotion();
  return (
    <div className="grid gap-1">
      <p className="m-0 text-[length:var(--text-label)] text-foreground">
        {label} {value} of 100
      </p>
      <span className="block h-2 overflow-hidden rounded-sm bg-muted" aria-hidden="true">
        <motion.span
          className="block h-full w-full origin-left bg-primary"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: value / 100 }}
          transition={
            reduce
              ? { duration: 0.15 }
              : { duration: 0.9, ease: easeOut, delay: 0.45 }
          }
        />
      </span>
    </div>
  );
}

function PhotoCard({
  src,
  alt,
  title,
  body,
  eyebrow,
  reduce,
  aspect = "aspect-[4/3]",
  glowDelay = 0,
}: {
  src: string;
  alt: string;
  title: string;
  body: string;
  eyebrow?: string;
  reduce: boolean | null;
  aspect?: string;
  glowDelay?: number;
}) {
  return (
    <motion.li className="h-full min-h-0" variants={mediaRise(reduce)}>
      <motion.div
        className="h-full touch-pan-y"
        whileHover={reduce ? undefined : { y: -8, scale: 1.02 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
      >
        <GlowFrame
          className="h-full"
          innerClassName="flex h-[calc(100%-4px)] flex-col bg-card"
          delay={glowDelay}
        >
          <div className={cn(aspect, "shrink-0 overflow-hidden")}>
            <motion.img
              src={src}
              alt={alt}
              width={1200}
              height={900}
              className="size-full object-cover object-[center_20%]"
              decoding="async"
              loading="lazy"
              whileHover={reduce ? undefined : { scale: 1.06 }}
              transition={{ type: "spring", stiffness: 280, damping: 24 }}
            />
          </div>
          <div className="grid gap-1 px-4 py-3">
            {eyebrow ? (
              <span className="text-[length:var(--text-caption)] font-bold text-primary">
                {eyebrow}
              </span>
            ) : null}
            <h3 className="m-0 font-[family-name:var(--font-display)] text-[length:var(--text-label)] text-foreground">
              {title}
            </h3>
            <p className="m-0 text-[length:var(--text-caption)] leading-snug text-muted-foreground">
              {body}
            </p>
          </div>
        </GlowFrame>
      </motion.div>
    </motion.li>
  );
}

function CardGrid({
  cols,
  children,
  reduce,
}: {
  cols: string;
  children: ReactNode;
  reduce: boolean | null;
}) {
  return (
    <motion.ul
      className={cn("m-0 grid w-full list-none items-stretch gap-6 p-0", cols)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: reduce ? 0 : 0.1, delayChildren: 0.06 },
        },
      }}
    >
      {children}
    </motion.ul>
  );
}

export function LandingPage() {
  const reduce = useReducedMotion();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const text = rise(reduce);
  const heroRef = useRef<HTMLElement>(null);
  const { hash } = useLocation();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const floatY = useTransform(heroProgress, [0, 1], ["0%", "14%"]);

  useEffect(() => {
    const id = hash.replace("#", "");
    if (!id) return;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    }, 40);
    return () => window.clearTimeout(t);
  }, [hash]);

  return (
    <div className="relative min-h-dvh max-w-full overflow-x-clip bg-background text-foreground">
      <LandingAtmosphere />
      {reduce ? null : (
        <motion.div
          className="fixed top-0 right-0 left-0 z-40 h-0.5 origin-left bg-primary"
          style={{ scaleX }}
          aria-hidden="true"
        />
      )}
      <a
        href="#hero"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius)] focus:bg-card focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-primary focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <MarketingHeader />

      <main className="relative z-[2]">
        <section
          id="hero"
          ref={heroRef}
          className="relative py-8 lg:overflow-hidden lg:py-24"
          aria-labelledby="hero-heading"
        >
          <div
            className={cn(
              "relative z-10 grid items-center gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16",
              marketingHeroPad,
            )}
          >
            <motion.div
              className="order-2 grid gap-4 lg:order-1 lg:gap-6"
              initial="hidden"
              animate="show"
              variants={page}
            >
              <motion.h1
                id="hero-heading"
                className="m-0 max-w-[16ch] font-[family-name:var(--font-display)] text-[length:var(--text-hero)] font-bold tracking-tight text-foreground max-lg:text-[32px]"
                variants={text}
              >
                Your life doesn't happen in silos. Neither should your wellness.
              </motion.h1>
              <motion.p
                className="m-0 max-w-[44ch] text-[length:var(--text-body)] leading-relaxed text-foreground"
                variants={text}
              >
                Your health, wellness and beauty are all part of the same life.
                GirlCode360 brings them together, so the context you've already
                shared can make what comes next more useful.
              </motion.p>
              <motion.p
                className="m-0 max-w-[46ch] text-[length:var(--text-label)] leading-relaxed text-muted-foreground"
                variants={text}
              >
                You don't have to start over every time your life changes.
                Listings on this page are samples, not live places.
              </motion.p>
              <motion.div className="mt-2 flex flex-wrap gap-3" variants={text}>
                <Button
                  asChild
                  className="relative h-12 min-h-[var(--tap)] overflow-hidden rounded-full px-6 active:scale-[0.97]"
                >
                  <Link to="/signup">
                    Create your account
                    <ShineSweep />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-12 min-h-[var(--tap)] rounded-full px-6">
                  <a href="#how">See how it works</a>
                </Button>
              </motion.div>
              <motion.ul
                className="m-0 mt-2 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 text-[length:var(--text-caption)] font-semibold text-grey"
                variants={text}
              >
                {["Private by design", "You control what you share", "Your information stays yours"].map(
                  (t) => (
                    <motion.li
                      key={t}
                      className="inline-flex items-center gap-2"
                      variants={text}
                    >
                      <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                      {t}
                    </motion.li>
                  ),
                )}
              </motion.ul>
            </motion.div>

            <TiltStage
              reduce={reduce || !desktop}
              className="relative order-1 h-[15.5rem] lg:order-2 lg:h-[520px]"
            >
              <motion.div
                className="absolute inset-0"
                style={reduce || !desktop ? undefined : { y: floatY }}
                aria-hidden="true"
              >
                <motion.div
                  className="absolute top-[4%] right-0 z-[1] w-[68%] rotate-[4deg] shadow-[var(--shadow-modal)] lg:top-[6%] lg:w-[78%]"
                  initial={reduce ? false : { opacity: 0, x: 32 }}
                  animate={
                    reduce
                      ? { opacity: 1, y: 0 }
                      : { opacity: 1, y: [0, -10, 0] }
                  }
                  transition={
                    reduce
                      ? { duration: 0.15 }
                      : {
                          opacity: { duration: 0.7, ease: easeOut, delay: 0.15 },
                          y: {
                            duration: 6,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: 0.4,
                          },
                        }
                  }
                  whileHover={reduce || !desktop ? undefined : { rotate: 2, scale: 1.03 }}
                >
                  <GlowFrame
                    delay={0.2}
                    innerClassName="bg-[image:var(--hero-card-fill)] p-3 lg:p-4"
                  >
                  <h2 className="m-0 font-[family-name:var(--font-display)] text-[length:var(--text-label)] font-bold text-foreground">
                    Near you
                  </h2>
                  <ul className="mt-2 m-0 grid list-none gap-2 p-0 lg:mt-4 lg:gap-3">
                    {[
                      {
                        logo: "/boots-800x800.png",
                        title: "Boots Pharmacy, 0.4 mi",
                        sub: "Open now",
                      },
                      {
                        logo: "/glam-boutique.webp",
                        title: "Glama Boutique, 0.6 mi",
                        sub: "Style nearby",
                      },
                      {
                        logo: "/clinic.jpg",
                        title: "6 more nearby",
                        sub: "Pharmacies · Clinics · Beauty",
                      },
                    ].map(({ logo, title, sub }, i) => (
                      <motion.li
                        key={title}
                        className={cn(
                          "flex items-center gap-3",
                          i === 2 && "max-lg:hidden",
                        )}
                        initial={reduce ? false : { opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.35 + i * 0.08, duration: 0.45, ease: easeOut }}
                      >
                        <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-[var(--radius)] bg-white ring-1 ring-border lg:size-9">
                          <img
                            src={logo}
                            alt=""
                            width={36}
                            height={36}
                            className="size-full object-contain"
                            decoding="async"
                          />
                        </span>
                        <span className="text-[length:var(--text-caption)] font-semibold text-foreground">
                          {title}
                          <small className="mt-0.5 block font-medium text-muted-foreground">
                            {sub}
                          </small>
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                  </GlowFrame>
                </motion.div>

                <motion.div
                  className="absolute bottom-0 left-0 z-[2] w-[72%] shadow-[var(--shadow-modal)] lg:w-[88%]"
                  initial={reduce ? false : { opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: easeOut, delay: 0.2 }}
                >
                  <GlowFrame
                    delay={0.8}
                    spin={desktop}
                    innerClassName="bg-[image:var(--hero-card-fill)] p-3 lg:p-6"
                  >
                  <h2 className="m-0 font-[family-name:var(--font-display)] text-[length:var(--text-label)] text-foreground lg:text-[length:var(--text-sub)]">
                    Mirror
                  </h2>
                  <div className="mt-2 flex items-center gap-3 lg:mt-4 lg:gap-4">
                    <MirrorGauge score={82} />
                    <div className="grid min-w-0 flex-1 gap-2 lg:gap-3">
                      <MotionScoreBar label="Hydration" value={78} />
                      <MotionScoreBar label="Radiance" value={85} />
                      <MotionScoreBar label="Acne" value={14} />
                    </div>
                  </div>
                  <p className="mt-4 mb-0 hidden text-[length:var(--text-caption)] text-muted-foreground lg:block">
                    Your look, with the cycle context you've chosen to share
                  </p>
                  </GlowFrame>
                </motion.div>
              </motion.div>
            </TiltStage>
          </div>
        </section>

        <section
          id="ecosystem"
          className={cn("scroll-mt-24 py-16", marketingPad)}
          aria-labelledby="ecosystem-heading"
        >
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            variants={page}
            className="mb-8 grid gap-4"
          >
            <motion.h2
              id="ecosystem-heading"
              className="m-0 font-[family-name:var(--font-display)] text-[length:var(--text-section)] text-foreground"
              variants={text}
            >
              One life. One connected picture.
            </motion.h2>
            <motion.p
              className="m-0 max-w-[40rem] text-[length:var(--text-body)] text-muted-foreground"
              variants={text}
            >
              Different moments. Different needs. One you. None of this is a
              diagnosis.
            </motion.p>
          </motion.div>
          <CardGrid cols="md:grid-cols-3" reduce={reduce}>
            {CORE.map((item, i) => (
              <PhotoCard
                key={item.title}
                {...item}
                reduce={reduce}
                glowDelay={i * 0.9}
              />
            ))}
          </CardGrid>
        </section>

        <section
          id="how"
          className="scroll-mt-24 bg-muted/45 py-16"
          aria-labelledby="steps-heading"
        >
          <div className={marketingPad}>
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.4 }}
              variants={page}
              className="mb-8 grid gap-4"
            >
              <motion.h2
                id="steps-heading"
                className="m-0 font-[family-name:var(--font-display)] text-[length:var(--text-section)] text-foreground"
                variants={text}
              >
                How it works
              </motion.h2>
              <motion.p
                className="m-0 max-w-[40rem] text-[length:var(--text-body)] text-muted-foreground"
                variants={text}
              >
                You choose what you share. GirlCode360 builds your experience
                around it.
              </motion.p>
            </motion.div>
            <CardGrid cols="md:grid-cols-3" reduce={reduce}>
              {STEPS.map((s, i) => (
                <PhotoCard
                  key={s.n}
                  src={s.src}
                  alt={s.alt}
                  title={s.title}
                  body={s.body}
                  eyebrow={s.n}
                  reduce={reduce}
                  aspect="aspect-[4/5]"
                  glowDelay={i * 0.9}
                />
              ))}
            </CardGrid>
          </div>
        </section>

        <section
          id="mirror"
          className={cn("scroll-mt-24 py-16", marketingPad)}
          aria-labelledby="city-heading"
        >
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            variants={page}
            className="mb-8 grid gap-4"
          >
            <motion.h2
              id="city-heading"
              className="m-0 font-[family-name:var(--font-display)] text-[length:var(--text-section)] text-foreground"
              variants={text}
            >
              From knowing to doing
            </motion.h2>
            <motion.p
              className="m-0 max-w-[40rem] text-[length:var(--text-body)] text-muted-foreground"
              variants={text}
            >
              Find what you need nearby, and ask Alena without explaining
              yourself from scratch.
            </motion.p>
          </motion.div>
          <CardGrid cols="md:grid-cols-2" reduce={reduce}>
            {CITY.map((item, i) => (
              <PhotoCard
                key={item.title}
                {...item}
                reduce={reduce}
                glowDelay={i * 1.1}
              />
            ))}
          </CardGrid>
        </section>
      </main>

      <div className="relative z-10">
        <MarketingFooter />
      </div>
      <AlenaFab />
    </div>
  );
}
