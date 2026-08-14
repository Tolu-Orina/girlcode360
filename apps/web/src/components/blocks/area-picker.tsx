import { useEffect, useState } from "react";
import { AREA_GAZETTEER, resolveArea } from "../../../../../packages/domain/src/index";
import { Field, FieldInput } from "@/components/primitives/field";
import { Button } from "@/components/ui/button";
import { leadClass } from "@/components/blocks/app-page";
import {
  getSessionOrigin,
  setSessionOrigin,
  type SessionOrigin,
} from "@/lib/session-geo";

export function AreaPicker({
  onChange,
}: {
  onChange?: (origin: SessionOrigin | null) => void;
}) {
  const [origin, setOrigin] = useState<SessionOrigin | null>(() => getSessionOrigin());
  const [query, setQuery] = useState(origin?.label ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onChange?.(origin);
  }, [origin, onChange]);

  function apply(next: SessionOrigin | null) {
    setSessionOrigin(next);
    setOrigin(next);
    setError(null);
  }

  function applyArea() {
    const hit = resolveArea(query);
    if (!hit) {
      setError("Try Ikeja, Victoria Island, Osu, Accra, SW7, or London.");
      return;
    }
    apply({ lat: hit.lat, lng: hit.lng, label: hit.label, source: "area" });
    setQuery(hit.label);
  }

  async function requestGps() {
    setError(null);
    if (!navigator.geolocation) {
      setError("This browser has no GPS. Enter an area instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        apply({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: "Current location",
          source: "gps",
        });
        setQuery("Current location");
      },
      () => setError("Location was not granted. Enter an area instead."),
      { maximumAge: 60_000, timeout: 12_000 },
    );
  }

  return (
    <div className="grid gap-3">
      <p className={leadClass}>
        Location stays in this browser session. It is sent only to look up
        distance, not stored as a profile.
      </p>
      <Field id="area-query" label="Area or postcode hint">
        <FieldInput
          id="area-query"
          list="gc360-areas"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ikeja, Osu, SW7…"
        />
      </Field>
      <datalist id="gc360-areas">
        {AREA_GAZETTEER.map((a) => (
          <option key={a.id} value={a.label} />
        ))}
      </datalist>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={applyArea}>
          Use this area
        </Button>
        <Button type="button" variant="outline" onClick={() => void requestGps()}>
          Use GPS
        </Button>
        {origin ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              apply(null);
              setQuery("");
            }}
          >
            Clear
          </Button>
        ) : null}
      </div>
      {origin ? (
        <p className={leadClass}>
          Using {origin.label} ({origin.source}).
        </p>
      ) : null}
      {error ? <p className="m-0 text-[length:var(--text-label)] text-destructive">{error}</p> : null}
    </div>
  );
}
