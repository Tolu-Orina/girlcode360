import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { leadClass, outlinedCardClass } from "@/components/blocks/app-page";
import { Button } from "@/components/ui/button";
import { getSheMatchPrefs, getSheMatchSuggest, patchSheMatchPrefs, postConsents } from "@/lib/api";
import { CURRENT_POLICY_VERSION } from "@/lib/api";
import { getMe } from "@/lib/api";
import { getSessionOrigin } from "@/lib/session-geo";
import type {
  HealthModule,
  SheMatchSuggestion,
  SheMatchTriggerId,
} from "../../../../../packages/api-types/src/index";
import { sheMatchTrigger } from "../../../../../packages/domain/src/index";

export function SheMatchBanner({
  trigger,
  extraTags,
}: {
  trigger: SheMatchTriggerId;
  extraTags?: string[];
}) {
  const [items, setItems] = useState<SheMatchSuggestion[]>([]);
  const [needConsent, setNeedConsent] = useState(false);
  const [needModule, setNeedModule] = useState<HealthModule | null>(null);
  const [whyOpen, setWhyOpen] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  const tagKey = extraTags?.join(",") ?? "";
  const load = useCallback(async () => {
    if (hidden) return;
    if (!getSessionOrigin()) {
      setItems([]);
      return;
    }
    const rule = sheMatchTrigger(trigger);
    if (!rule) return;
    try {
      const prefs = await getSheMatchPrefs();
      if (!prefs.granted) {
        setNeedConsent(true);
        setItems([]);
        return;
      }
      setNeedConsent(false);
      if (!prefs.modules[rule.module]) {
        setNeedModule(rule.module);
        setItems([]);
        return;
      }
      setNeedModule(null);
      const res = await getSheMatchSuggest(
        trigger,
        tagKey ? { tags: tagKey } : undefined,
      );
      setItems(res.suggestions);
    } catch {
      setItems([]);
    }
  }, [trigger, tagKey, hidden]);

  useEffect(() => {
    void load();
  }, [load]);

  if (hidden) return null;

  async function grantAll() {
    const me = await getMe();
    await postConsents({
      jurisdiction: me.market,
      policyVersion: CURRENT_POLICY_VERSION,
      items: [
        { purpose: "health_data", granted: true },
        { purpose: "shematch", granted: true },
      ],
    });
    const rule = sheMatchTrigger(trigger);
    if (rule) {
      await patchSheMatchPrefs({ [rule.module]: true });
    }
    setNeedConsent(false);
    setNeedModule(null);
    await load();
  }

  async function grantModule() {
    if (!needModule) return;
    await patchSheMatchPrefs({ [needModule]: true });
    setNeedModule(null);
    await load();
  }

  if (needConsent) {
    return (
      <aside className={outlinedCardClass}>
        <h3 className="m-0 text-[length:var(--text-sub)]">SheMatch</h3>
        <p className={leadClass}>
          Allow GirlCode360 to use your health activity to suggest relevant local
          services. Separate from location. You can switch modules off in Account.
        </p>
        <Button type="button" onClick={() => void grantAll()}>
          Allow SheMatch for this module
        </Button>
      </aside>
    );
  }

  if (needModule) {
    return (
      <aside className={outlinedCardClass}>
        <p className={leadClass}>
          SheMatch is on, but this module is off. Turn it on to see nearby
          suggestions.
        </p>
        <Button type="button" variant="outline" onClick={() => void grantModule()}>
          Allow this module
        </Button>
      </aside>
    );
  }

  if (!items.length) return null;

  return (
    <aside className="grid gap-3">
      {items.slice(0, 2).map((s) => (
        <div key={s.listing.id} className={outlinedCardClass}>
          <p className="m-0 text-[length:var(--text-caption)] font-semibold uppercase tracking-wide text-primary">
            {s.label}
            {s.sponsoredLabel ? ` · ${s.sponsoredLabel}` : ""}
          </p>
          <p className="m-0 text-[length:var(--text-body)] font-semibold text-foreground">
            {s.listing.name}
          </p>
          <p className={leadClass}>
            {s.listing.distanceKm != null
              ? `${s.listing.distanceKm.toFixed(1)} km`
              : "Distance unknown"}
            {" · "}
            Directory {s.listing.rating.toFixed(1)}
            {s.listing.tags[0] ? ` · ${s.listing.tags[0]}` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link to={`/app/marketplace/${s.listing.id}`}>Open listing</Link>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setWhyOpen((id) => (id === s.listing.id ? null : s.listing.id))
              }
            >
              Why am I seeing this?
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setHidden(true)}>
              Dismiss
            </Button>
          </div>
          {whyOpen === s.listing.id ? (
            <p className={leadClass}>{s.why} You opted in to SheMatch.</p>
          ) : null}
        </div>
      ))}
    </aside>
  );
}
