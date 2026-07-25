import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { EmergencyNumber } from "../../../../packages/api-types/src/index";
import { getEmergency, getMe } from "../lib/api";
import { apiBaseUrl } from "../lib/config";
import { EMERGENCY_BY_MARKET } from "../../../../packages/domain/src/index";
import "./health.css";

export function HomePage() {
  const [numbers, setNumbers] = useState<EmergencyNumber[]>([]);
  const [market, setMarket] = useState<"UK" | "NG" | "GH">("UK");
  const [name, setName] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (apiBaseUrl) {
          const me = await getMe();
          if (cancelled) return;
          setMarket(me.market);
          setName(me.email?.split("@")[0]);
          const em = await getEmergency();
          if (!cancelled) setNumbers(em.numbers);
        } else {
          setNumbers(EMERGENCY_BY_MARKET.UK);
        }
      } catch {
        if (!cancelled) setNumbers(EMERGENCY_BY_MARKET[market]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [market]);

  return (
    <section className="page home-page">
      <header className="page-header">
        <p className="page-eyebrow">GirlCode360</p>
        <h1>{name ? `Hello, ${name}` : "Welcome"}</h1>
        <p className="page-lead">
          Your cycle, records, and what&apos;s near you — private wellness in one
          place, on desktop and your home screen.
        </p>
      </header>

      <div className="home-grid">
        <Link className="home-tile" to="/app/cycle">
          <span className="home-tile-label">Cycle</span>
          <span className="home-tile-copy">Log days and see your window</span>
        </Link>
        <Link className="home-tile" to="/app/health">
          <span className="home-tile-label">Health</span>
          <span className="home-tile-copy">PCOS, pregnancy, TTC, wallet</span>
        </Link>
        <Link className="home-tile" to="/app/alena">
          <span className="home-tile-label">Alena</span>
          <span className="home-tile-copy">Ask for wellness guidance</span>
        </Link>
        <Link className="home-tile" to="/app/library">
          <span className="home-tile-label">Library</span>
          <span className="home-tile-copy">Education for your market</span>
        </Link>
      </div>

      <section className="page-section">
        <h2>Emergency</h2>
        <p className="page-lead">
          Local numbers for {market}. Call if you need urgent help.
        </p>
        <ul className="plain-list">
          {numbers.map((n) => (
            <li key={n.number}>
              <strong>{n.label}</strong>
              <a className="tel-link" href={`tel:${n.number}`}>
                {n.number}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
