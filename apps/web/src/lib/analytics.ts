/**
 * Product analytics — fires only when analytics consent is granted.
 * Never includes health fields (cycle dates, symptoms, notes, diagnoses).
 */
const ALLOWED = new Set([
  "app_open",
  "tab_view",
  "onboarding_complete",
  "module_toggled",
  "consents_updated",
  "export_requested",
  "deletion_requested",
  "checkout_started",
  "pwa_install_accepted",
  "pwa_install_dismissed",
  "library_article_open",
  "paywall_shown",
]);

type AnalyticsEvent = {
  name: string;
  props?: Record<string, string | number | boolean>;
};

let analyticsAllowed = false;

const HEALTH_KEYS =
  /cycle|symptom|flow|mood|note|weight|bbt|mucus|intimacy|pregnancy|kick|wallet|lab|diagnos/i;

export function setAnalyticsConsent(granted: boolean) {
  analyticsAllowed = granted;
}

export function track(event: AnalyticsEvent) {
  if (!analyticsAllowed) return;
  if (!ALLOWED.has(event.name)) {
    console.warn("[analytics] blocked unknown event", event.name);
    return;
  }
  if (event.props) {
    for (const key of Object.keys(event.props)) {
      if (HEALTH_KEYS.test(key)) {
        console.warn("[analytics] blocked health-like prop", key);
        return;
      }
    }
  }
  // Stub sink — swap for Amplitude/Pinpoint when keys exist
  if (import.meta.env.DEV) {
    console.info("[analytics]", event.name, event.props ?? {});
  }
}
