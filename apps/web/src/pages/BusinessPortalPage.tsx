import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { MarketingFooter, MarketingHeader } from "@/components/blocks/marketing-chrome";
import { marketingPad } from "@/components/blocks/marketing-layout";
import { ErrorBanner, SuccessBanner } from "@/components/blocks/states";
import { Field, FieldInput, FieldSelect } from "@/components/primitives/field";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/RequireAuth";
import {
  listMyBusinessListings,
  submitBusinessListing,
} from "@/lib/api";
import { resolveArea } from "../../../../packages/domain/src/index";
import type {
  Market,
  MarketplaceCategory,
  MarketplaceListing,
} from "../../../../packages/api-types/src/index";

function PortalInner() {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<MarketplaceCategory>("beauty");
  const [market, setMarket] = useState<Market>("UK");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [reg, setReg] = useState("");
  const [services, setServices] = useState("");
  const [mine, setMine] = useState<MarketplaceListing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const res = await listMyBusinessListings();
      setMine(res.listings);
    } catch {
      /* not bootstrapped yet */
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const geo = resolveArea(area);
      if (!geo) {
        setError("Pick an area we know (Ikeja, Osu, SW7, London, Accra, Lagos).");
        return;
      }
      const res = await submitBusinessListing({
        name,
        category,
        market,
        address,
        phone,
        lat: geo.lat,
        lng: geo.lng,
        services: services
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        registrationNumber: reg || null,
      });
      setOk(res.message);
      setName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }

  const needsReg = category === "pharmacy" || category === "clinic";

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <MarketingHeader />
      <main
        className={`${marketingPad} pt-[calc(var(--space-6)+env(safe-area-inset-top))] pb-[calc(var(--space-8)+env(safe-area-inset-bottom))]`}
      >
        <article className="mx-auto grid w-full max-w-[720px] gap-8">
          <header className="grid gap-3">
            <h1 className="m-0 text-[length:var(--text-page)] text-foreground max-lg:text-[28px]">
              Business portal
            </h1>
            <p className="m-0 text-[length:var(--text-body)] text-muted-foreground">
              Submit a listing. It stays pending until moderation. Pharmacies and
              clinics need a registration number (GPhC/CQC, PCN/NAFDAC, or Ghana
              FDA/GHS). Aim is review within 48 hours.
            </p>
            <p className="m-0 text-[length:var(--text-body)]">
              <Link to="/app/marketplace">View the consumer marketplace</Link>
            </p>
          </header>
          {error ? <ErrorBanner message={error} /> : null}
          {ok ? <SuccessBanner message={ok} /> : null}
          <form className="grid gap-4" onSubmit={(e) => void onSubmit(e)}>
            <Field id="biz-name" label="Business name">
              <FieldInput
                id="biz-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field id="biz-cat" label="Category">
              <FieldSelect
                id="biz-cat"
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as MarketplaceCategory)
                }
              >
                <option value="beauty">Beauty stores</option>
                <option value="boutique">Boutiques & salons</option>
                <option value="pharmacy">Pharmacies</option>
                <option value="clinic">Clinics & hospitals</option>
              </FieldSelect>
            </Field>
            <Field id="biz-market" label="Market">
              <FieldSelect
                id="biz-market"
                value={market}
                onChange={(e) => setMarket(e.target.value as Market)}
              >
                <option value="UK">United Kingdom</option>
                <option value="NG">Nigeria</option>
                <option value="GH">Ghana</option>
              </FieldSelect>
            </Field>
            <Field id="biz-address" label="Address">
              <FieldInput
                id="biz-address"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </Field>
            <Field id="biz-area" label="Area for the map pin">
              <FieldInput
                id="biz-area"
                required
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Ikeja, Osu, SW7…"
              />
            </Field>
            <Field id="biz-phone" label="Phone">
              <FieldInput
                id="biz-phone"
                required
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            {needsReg ? (
              <Field id="biz-reg" label="Registration number">
                <FieldInput
                  id="biz-reg"
                  required
                  value={reg}
                  onChange={(e) => setReg(e.target.value)}
                />
              </Field>
            ) : null}
            <Field id="biz-services" label="Services (comma separated)">
              <FieldInput
                id="biz-services"
                value={services}
                onChange={(e) => setServices(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? "Submitting…" : "Submit for review"}
            </Button>
          </form>
          {mine.length ? (
            <section className="grid gap-3">
              <h2 className="m-0 text-[length:var(--text-section)]">Your submissions</h2>
              <ul className="m-0 grid list-none gap-3 p-0">
                {mine.map((l) => (
                  <li key={l.id} className="border-b border-border py-3">
                    <strong>{l.name}</strong>
                    <p className="m-0 text-[length:var(--text-label)] text-muted-foreground">
                      {l.status} · {l.category}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}

export function BusinessPortalPage() {
  return (
    <RequireAuth>
      <PortalInner />
    </RequireAuth>
  );
}
