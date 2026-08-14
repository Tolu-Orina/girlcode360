import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { SIDEBAR_LINKS } from "@/components/blocks/nav-config";
import { useAlena } from "@/hooks/use-alena";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const EXTRA = [
  { to: "/app/inbox", label: "Inbox", keywords: "inbox notices mail" },
  { to: "__alena__", label: "Alena", keywords: "alena ask chat companion" },
] as const;

type Hit = { to: string; label: string };

function hitsFor(query: string): Hit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const pool: Array<Hit & { keywords: string }> = [
    ...SIDEBAR_LINKS.map((l) => ({
      to: l.to,
      label: l.label,
      keywords: l.label.toLowerCase(),
    })),
    ...EXTRA,
  ];
  return pool
    .filter(
      (item) =>
        item.label.toLowerCase().includes(q) || item.keywords.includes(q),
    )
    .slice(0, 6);
}

export function AppSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const { openAlena } = useAlena();
  const boxRef = useRef<HTMLDivElement>(null);
  const hits = useMemo(() => hitsFor(query), [query]);

  function go(hit: Hit) {
    setOpen(false);
    setQuery("");
    if (hit.to === "__alena__") {
      openAlena({ from: "home" });
      return;
    }
    navigate(hit.to);
  }

  return (
    <div ref={boxRef} className="relative hidden w-full max-w-sm shrink-0 md:block">
      <label className="sr-only" htmlFor="app-search">
        Search the app
      </label>
      <Search
        size={20}
        strokeWidth={1.75}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        id="app-search"
        type="search"
        autoComplete="off"
        placeholder="Search Cycle, Health, Mirror…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && hits[active]) {
            e.preventDefault();
            go(hits[active]!);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={cn(
          "h-10 min-h-10 rounded-xl border-0 bg-card pr-3 pl-10 text-[length:var(--text-label)] shadow-[var(--shadow-2)]",
          "placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
        )}
        aria-autocomplete="list"
        aria-expanded={open && hits.length > 0}
        aria-controls="app-search-results"
      />
      {open && query.trim() ? (
        <ul
          id="app-search-results"
          role="listbox"
          className="absolute top-[calc(100%+8px)] z-30 m-0 w-full list-none rounded-[var(--radius-sheet)] border-0 bg-card p-2 shadow-[var(--shadow-2)]"
        >
          {hits.length === 0 ? (
            <li className="px-3 py-3 text-[length:var(--text-caption)] text-muted-foreground">
              No matches. Try Cycle, Health, or Library.
            </li>
          ) : (
            hits.map((hit, i) => (
              <li key={hit.to} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  className={cn(
                    "flex min-h-12 w-full items-center rounded-[var(--radius)] px-3 text-left text-[length:var(--text-label)] font-semibold text-foreground",
                    "hover:bg-primary/10 hover:text-primary",
                    i === active && "bg-primary/10 text-primary",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(hit)}
                >
                  {hit.label}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
