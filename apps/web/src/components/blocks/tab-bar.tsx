import { NavLink } from "react-router-dom";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { MOBILE_TABS } from "@/components/blocks/nav-config";
import { cn } from "@/lib/utils";

export function TabBar() {
  const reduce = useReducedMotion();

  return (
    <LayoutGroup>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 bg-background/96 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden"
        aria-label="Mobile primary"
      >
        <ul className="m-0 flex list-none items-end justify-between p-0">
          {MOBILE_TABS.map((t) => {
            const Icon = t.icon;
            const lift = t.lift ?? 0;
            const home = Boolean(t.end);
            return (
              <li key={t.to} className="flex min-w-0 flex-1 justify-center">
                <NavLink
                  to={t.to}
                  end={t.end}
                  className="group relative flex flex-col items-center rounded-full no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {({ isActive }) => (
                    <motion.span
                      className="flex flex-col items-center gap-1"
                      initial={false}
                      animate={reduce ? { y: 0 } : { y: -lift }}
                      transition={{ type: "spring", stiffness: 380, damping: 22 }}
                    >
                      <motion.span
                        layout
                        whileTap={reduce ? undefined : { scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 420, damping: 20 }}
                        className={cn(
                          "relative grid place-items-center rounded-full bg-card",
                          "shadow-[var(--shadow-2)]",
                          home ? "size-16" : "size-12",
                          isActive && "text-primary-foreground",
                        )}
                      >
                        {!reduce && home && isActive ? (
                          <motion.span
                            aria-hidden
                            className="pointer-events-none absolute -inset-1 rounded-full bg-[conic-gradient(from_0deg,transparent_20%,var(--primary),var(--brand-soft),transparent_55%)]"
                            animate={{ rotate: 360 }}
                            transition={{
                              repeat: Infinity,
                              duration: 5,
                              ease: "linear",
                            }}
                            style={{
                              padding: 2,
                              maskImage:
                                "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                              WebkitMaskImage:
                                "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                              maskComposite: "exclude",
                              WebkitMaskComposite: "xor",
                            }}
                          />
                        ) : null}
                        {isActive ? (
                          <motion.span
                            layoutId="tab-active-disc"
                            className="absolute inset-0 rounded-full bg-[image:var(--cta-fill)]"
                            transition={{ type: "spring", stiffness: 380, damping: 28 }}
                          />
                        ) : null}
                        <Icon
                          className="relative z-10"
                          size={home ? 32 : 24}
                          strokeWidth={isActive ? 2.25 : 1.75}
                          aria-hidden="true"
                        />
                      </motion.span>
                      <motion.span
                        className={cn(
                          "text-[length:var(--text-caption)] font-semibold",
                          isActive ? "text-primary" : "text-muted-foreground",
                        )}
                        animate={
                          reduce
                            ? { opacity: 1 }
                            : { opacity: isActive ? 1 : 0.72, y: isActive ? 0 : 2 }
                        }
                      >
                        {t.label}
                      </motion.span>
                    </motion.span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </LayoutGroup>
  );
}
