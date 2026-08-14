import type { ConsentPurpose, HealthModule, Market } from "../../../../packages/api-types/src/index";

export const PURPOSE_COPY: Record<
  ConsentPurpose,
  { title: string; body: string; required?: boolean }
> = {
  health_data: {
    title: "Health data processing",
    body: "Store and process your cycle, symptoms, and wellness logs so the app can work for you.",
    required: true,
  },
  analytics: {
    title: "Product analytics",
    body: "Help us understand feature use with aggregated, non-diagnostic metrics.",
  },
  marketing: {
    title: "Marketing messages",
    body: "Occasional product updates. Never health content in notification bodies.",
  },
  location: {
    title: "Approximate location",
    body: "Used for emergency number hints and nearby pharmacy, clinic, and beauty suggestions. Not sold.",
  },
  ai_alena: {
    title: "Alena AI companion",
    body: "Allow Alena to use your prompts (and optional context you choose) via Amazon Bedrock.",
  },
  ai_healthlens: {
    title: "HealthLens insights",
    body: "Allow pattern summaries over your logged data. Wellness only. Not diagnosis.",
  },
  mirror_biometric: {
    title: "Mirror skin and try-on photos",
    body: "Face and body photos for skin scores and apparel try-on. Photos are sent to Perfect Corp. (YouCam) as a processor for your analysis only, kept there up to 30 days, and are not used to train their models unless you later agree separately. Declining does not affect Cycle, Alena, or Wallet.",
  },
  shematch: {
    title: "SheMatch local suggestions",
    body: "Allow GirlCode360 to use your health activity to suggest relevant local services. Separate from approximate location. You choose modules in Account. If nothing is within 5 km, we stay silent.",
  },
};

export const MODULE_COPY: Record<HealthModule, { title: string; body: string }> = {
  period_tracker: {
    title: "Period Tracker",
    body: "Log cycles, flow, mood, and symptoms. Predictions need two logged periods and do not assume 28 days.",
  },
  pcos_manager: {
    title: "PMOS Manager",
    body: "Symptom diary, medication reminders, and education. Optional add-on to Period Tracker.",
  },
  pregnancy: {
    title: "Pregnancy",
    body: "Week-by-week guidance, logs, and reminders.",
  },
  ttc: {
    title: "Trying to conceive",
    body: "Fertile window overlay and optional fertility signs.",
  },
  wallet: {
    title: "Health Wallet",
    body: "Encrypted personal health records you control.",
  },
};

export const MARKET_LABEL: Record<Market, string> = {
  UK: "United Kingdom",
  NG: "Nigeria",
  GH: "Ghana",
};

export const JURISDICTION_CONSENT_LEAD: Record<Market, string> = {
  UK: "UK GDPR: health data is special-category. We only process it with your explicit consent. Optional purposes stay off unless you turn them on. You can withdraw them any time in Account.",
  NG: "Nigeria NDPA: we process health data only with your explicit consent. Optional purposes stay off unless you turn them on. You can withdraw them any time in Account.",
  GH: "Ghana DPA: health data needs your explicit consent. Optional purposes stay off unless you turn them on. You can withdraw them any time in Account.",
};

export const MIRROR_PROCESSOR_LEAD: Record<Market, string> = {
  UK: "UK GDPR treats a face or body photo as special-category data. Perfect Corp. processes the photo only to return scores or a try-on image. We copy results into GirlCode360. YouCam file retention is up to 30 days. Result download links expire in two hours. Removing a scan here also asks YouCam to delete their copy. Cycle, Alena, and Wallet stay available if you say no.",
  NG: "Nigeria NDPA: a face or body photo needs your explicit consent. Perfect Corp. processes it only for this analysis. We copy results into GirlCode360. YouCam keeps files up to 30 days. Removing a scan here also asks YouCam to delete their copy. Cycle, Alena, and Wallet stay available if you say no.",
  GH: "Ghana DPA: a face or body photo needs your explicit consent. Perfect Corp. processes it only for this analysis. We copy results into GirlCode360. YouCam keeps files up to 30 days. Removing a scan here also asks YouCam to delete their copy. Cycle, Alena, and Wallet stay available if you say no.",
};
