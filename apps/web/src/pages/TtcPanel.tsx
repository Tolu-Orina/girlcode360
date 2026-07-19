import { useEffect, useState, type FormEvent } from "react";
import { PredictionDisclaimer } from "../components/PredictionDisclaimer";
import type {
  FertileWindowResponse,
  HealthModule,
  MucusType,
  UserProfile,
} from "../../../../packages/api-types/src/index";
import {
  deleteTtcIntimacy,
  getFertileWindow,
  getTtc,
  initTtc,
  patchModules,
  upsertTtcDay,
} from "../lib/api";
import { apiBaseUrl } from "../lib/config";
import {
  calculateFertileWindow,
  ttcMonthCount,
  ttcTwelveMonthPrompt,
} from "../../../../packages/domain/src/index";

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TtcPanel({
  profile,
  onProfile,
  busy,
  setBusy,
  setError,
}: {
  profile: UserProfile | null;
  onProfile: (p: UserProfile) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (e: string | null) => void;
}) {
  const on = profile?.modules.includes("ttc") ?? false;
  const [startedOn, setStartedOn] = useState(todayYmd());
  const [months, setMonths] = useState(0);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [fertile, setFertile] = useState<FertileWindowResponse | null>(null);
  const [bbt, setBbt] = useState("");
  const [mucus, setMucus] = useState<MucusType | "">("");
  const [intimacy, setIntimacy] = useState(false);
  const [intimacyConsent, setIntimacyConsent] = useState(false);
  const [active, setActive] = useState(false);

  async function load() {
    if (!on) return;
    if (!apiBaseUrl) {
      setMonths(ttcMonthCount(startedOn, todayYmd()));
      setPrompt(ttcTwelveMonthPrompt(months));
      return;
    }
    try {
      const status = await getTtc();
      setActive(true);
      setStartedOn(status.startedOn);
      setMonths(status.monthsTrying);
      setPrompt(status.twelveMonthPrompt);
      setFertile(await getFertileWindow());
    } catch {
      /* not started */
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const base = profile?.modules ?? (["period_tracker"] as HealthModule[]);
      const modules: HealthModule[] = base.includes("ttc")
        ? base
        : [...base, "ttc"];
      onProfile(await patchModules({ modules }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enable TTC");
    } finally {
      setBusy(false);
    }
  }

  async function start(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!apiBaseUrl) {
        setActive(true);
        const m = ttcMonthCount(startedOn, todayYmd());
        setMonths(m);
        setPrompt(ttcTwelveMonthPrompt(m));
        setFertile({
          ...(calculateFertileWindow(startedOn, 28) ?? {
            ovulationDay: "",
            fertileStart: "",
            fertileEnd: "",
            fertileDates: [],
            cycleLengthDays: 28,
            message: "Need cycle data for a better estimate.",
          }),
          enoughData: false,
        });
      } else {
        const res = (await initTtc({ startedOn })) as {
          monthsTrying: number;
          twelveMonthPrompt: string | null;
          profile: { startedOn: string };
        };
        setActive(true);
        setStartedOn(res.profile.startedOn);
        setMonths(res.monthsTrying);
        setPrompt(res.twelveMonthPrompt);
        setFertile(await getFertileWindow());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start TTC");
    } finally {
      setBusy(false);
    }
  }

  async function saveDay(e: FormEvent) {
    e.preventDefault();
    if (!apiBaseUrl) {
      setError("API required to sync TTC day logs.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await upsertTtcDay({
        date: todayYmd(),
        bbtC: bbt ? Number(bbt) : null,
        mucus: mucus || null,
        intimacy,
        intimacyConsent: intimacy ? intimacyConsent : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save TTC day");
    } finally {
      setBusy(false);
    }
  }

  if (!on) {
    return (
      <div className="health-section">
        <h2>Trying to conceive</h2>
        <p className="health-lead">
          Overlay fertile-window estimates on your cycle calendar and log BBT /
          mucus when you want.
        </p>
        <button type="button" className="primary" onClick={enable} disabled={busy}>
          Enable TTC
        </button>
      </div>
    );
  }

  return (
    <div className="health-section">
      <h2>Trying to conceive</h2>
      {!active ? (
        <form className="health-form" onSubmit={start}>
          <label>
            When did you start trying?
            <input
              type="date"
              required
              value={startedOn}
              onChange={(e) => setStartedOn(e.target.value)}
            />
          </label>
          <button type="submit" className="primary" disabled={busy}>
            Start TTC timeline
          </button>
        </form>
      ) : (
        <>
          <p className="health-lead">
            Month {months} on your timeline
            {prompt ? ` · ${prompt}` : ""}
          </p>
          {fertile ? (
            <>
              <PredictionDisclaimer message={fertile.message} />
              <ul className="insight-list">
                <li>
                  <strong>Fertile window (estimate)</strong>
                  <p>
                    {fertile.enoughData
                      ? `${fertile.fertileStart} → ${fertile.fertileEnd} · ovulation ${fertile.ovulationDay}`
                      : fertile.message}
                  </p>
                </li>
              </ul>
            </>
          ) : null}

          <h2>Today’s fertility signs</h2>
          <form className="health-form" onSubmit={saveDay}>
            <label>
              BBT (°C)
              <input
                type="number"
                step="0.01"
                value={bbt}
                onChange={(e) => setBbt(e.target.value)}
              />
            </label>
            <label>
              Cervical mucus
              <select
                value={mucus}
                onChange={(e) => setMucus(e.target.value as MucusType | "")}
              >
                <option value="">Skip</option>
                <option value="dry">Dry</option>
                <option value="sticky">Sticky</option>
                <option value="creamy">Creamy</option>
                <option value="watery">Watery</option>
                <option value="egg_white">Egg white</option>
                <option value="not_sure">Not sure</option>
              </select>
            </label>
            <label className="consent-row" style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={intimacy}
                onChange={(e) => setIntimacy(e.target.checked)}
              />
              Log intimacy (encrypted; deletable)
            </label>
            {intimacy ? (
              <label className="consent-row" style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  required
                  checked={intimacyConsent}
                  onChange={(e) => setIntimacyConsent(e.target.checked)}
                />
                I consent to store this intimacy log
              </label>
            ) : null}
            <button type="submit" className="primary" disabled={busy}>
              Save day
            </button>
            <button
              type="button"
              onClick={() =>
                void deleteTtcIntimacy(todayYmd()).catch((err) =>
                  setError(err instanceof Error ? err.message : "Delete failed"),
                )
              }
            >
              Delete today’s intimacy log
            </button>
          </form>
        </>
      )}
    </div>
  );
}
