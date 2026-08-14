import { useEffect, useState, type FormEvent } from "react";
import { SheMatchBanner } from "@/components/blocks/shematch-banner";
import { EmptyState } from "@/components/blocks/states";
import { Field, FieldInput, FieldSelect } from "@/components/primitives/field";
import { PredictionDisclaimer } from "@/components/PredictionDisclaimer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { formStackClass, leadClass, listClass, listItemClass } from "@/components/blocks/app-page";
import type {
  ContentArticle,
  FertileWindowResponse,
  HealthModule,
  MucusType,
  UserProfile,
} from "../../../../packages/api-types/src/index";
import {
  deleteTtcIntimacy,
  getContentArticles,
  getCycles,
  getFertileWindow,
  getTtc,
  initTtc,
  patchModules,
  upsertTtcDay,
} from "../lib/api";
import { apiBaseUrl } from "../lib/config";
import {
  calculateFertileWindow,
  dayInCycle,
  predictNextPeriods,
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
  const [cycleDay, setCycleDay] = useState<number | null>(null);
  const [lastPeriod, setLastPeriod] = useState<string | null>(null);
  const [nextPeriod, setNextPeriod] = useState<string | null>(null);
  const [articles, setArticles] = useState<ContentArticle[]>([]);

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
      try {
        const { cycles } = await getCycles();
        const starts = cycles.map((c) => c.startDate).sort();
        const last = starts[starts.length - 1] ?? null;
        setLastPeriod(last);
        setCycleDay(dayInCycle(todayYmd(), starts));
        const pred = predictNextPeriods(
          cycles.map((c) => ({ startDate: c.startDate, endDate: c.endDate })),
        );
        setNextPeriod(pred?.nextStarts[0] ?? null);
      } catch {
        /* cycle data optional */
      }
      try {
        const res = await getContentArticles(profile?.market, "ttc");
        setArticles(res.articles);
      } catch {
        setArticles([]);
      }
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
      <EmptyState
        title="Trying to conceive is off"
        body="Fertile-window estimates overlay your cycle calendar. Log BBT and mucus only if you want to."
        action={
          <Button type="button" onClick={() => void enable()} disabled={busy}>
            Enable TTC
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-6">
      <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
        Trying to conceive
      </h2>
      {!active ? (
        <form className={formStackClass} onSubmit={start}>
          <Field id="ttc-start" label="When did you start trying?">
            <FieldInput
              id="ttc-start"
              type="date"
              required
              value={startedOn}
              onChange={(e) => setStartedOn(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={busy}>
            Start TTC timeline
          </Button>
        </form>
      ) : (
        <>
          <p className={leadClass}>
            Month {months} on your timeline
            {prompt ? ` · ${prompt}` : ""}
          </p>
          {fertile ? (
            <>
              <PredictionDisclaimer message={fertile.message} />
              <ul className={listClass}>
                <li className={listItemClass}>
                  <strong className="block text-foreground">Timeline</strong>
                  <p className={leadClass}>
                    Cycle day {cycleDay ?? "—"} · last period {lastPeriod ?? "—"} ·
                    next predicted period {nextPeriod ?? "Need two logged periods"}
                  </p>
                </li>
                <li className={listItemClass}>
                  <strong className="block text-foreground">
                    Fertile window (estimate)
                  </strong>
                  <p className={leadClass}>
                    {fertile.enoughData
                      ? `${fertile.fertileStart} → ${fertile.fertileEnd} · ovulation ${fertile.ovulationDay}`
                      : fertile.message}
                  </p>
                </li>
              </ul>
              {fertile.enoughData && fertile.fertileDates.includes(todayYmd()) ? (
                <SheMatchBanner trigger="fertile_window" />
              ) : null}
            </>
          ) : null}

          {articles.length ? (
            <ul className={listClass}>
              {articles.map((a) => (
                <li key={a.id} className={listItemClass}>
                  <strong className="block text-foreground">{a.title}</strong>
                  <p className={leadClass}>{a.summary}</p>
                  <p className={leadClass}>{a.body}</p>
                </li>
              ))}
            </ul>
          ) : null}

          <form className={formStackClass} onSubmit={saveDay}>
            <h2 className="m-0 text-[length:var(--text-section)] text-foreground">
              Today’s fertility signs
            </h2>
            <Field id="bbt" label="BBT (°C)">
              <FieldInput
                id="bbt"
                type="number"
                step="0.01"
                value={bbt}
                onChange={(e) => setBbt(e.target.value)}
              />
            </Field>
            <Field id="mucus" label="Cervical mucus">
              <FieldSelect
                id="mucus"
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
              </FieldSelect>
            </Field>
            <Label className="flex min-h-[var(--tap)] items-center gap-3 text-[length:var(--text-body)] font-normal">
              <Checkbox
                checked={intimacy}
                onCheckedChange={(v) => setIntimacy(v === true)}
              />
              Log intimacy (encrypted; deletable)
            </Label>
            {intimacy ? (
              <Label className="flex min-h-[var(--tap)] items-center gap-3 text-[length:var(--text-body)] font-normal">
                <Checkbox
                  checked={intimacyConsent}
                  onCheckedChange={(v) => setIntimacyConsent(v === true)}
                  required
                />
                I consent to store this intimacy log
              </Label>
            ) : null}
            <Button type="submit" disabled={busy}>
              Save day
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void deleteTtcIntimacy(todayYmd()).catch((err) =>
                  setError(err instanceof Error ? err.message : "Delete failed"),
                )
              }
            >
              Delete today’s intimacy log
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
