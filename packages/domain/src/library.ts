/** Curated educational library (COM-F-03 / FR-071). One corpus — API and PWA both import this. */

export type LibraryTopic =
  | "pcos"
  | "cycle"
  | "pregnancy"
  | "ttc"
  | "privacy"
  | "general";

export type LibraryArticle = {
  id: string;
  title: string;
  summary: string;
  body: string;
  topic: LibraryTopic;
  markets: Array<"UK" | "NG" | "GH">;
  /** ISO date YYYY-MM-DD — last clinical advisor review */
  reviewedAt: string;
};

const CURRENT_REVIEW = "2026-06-01";

function a(
  partial: Omit<LibraryArticle, "reviewedAt"> & { reviewedAt?: string },
): LibraryArticle {
  return { reviewedAt: CURRENT_REVIEW, ...partial };
}

/** FR-071: flag for review when last clinical review is older than 24 months. */
export function articleDueForReview(
  reviewedAt: string,
  now = new Date(),
): boolean {
  const reviewed = Date.parse(`${reviewedAt}T00:00:00Z`);
  if (!Number.isFinite(reviewed)) return true;
  const limit = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() - 24,
    now.getUTCDate(),
  );
  return reviewed < limit;
}

export const LIBRARY_ARTICLES: LibraryArticle[] = [
  a({
    id: "pcos-what-is",
    title: "Understanding PCOS (wellness overview)",
    topic: "pcos",
    markets: ["UK", "NG", "GH"],
    summary:
      "PCOS is a common hormone-related condition. Only a qualified clinician can assess or diagnose. This article shares general wellness context.",
    body: "Many people notice irregular cycles, skin changes, or energy shifts. Tracking symptoms can help conversations with your GP or clinic. GirlCode360 does not diagnose conditions.",
  }),
  a({
    id: "pcos-nhs-uk",
    title: "Talking to your GP (UK)",
    topic: "pcos",
    markets: ["UK"],
    summary:
      "Tips for preparing a calm, factual summary for an NHS GP appointment.",
    body: "Bring your cycle dates, symptom diary, and medication list. Ask about investigations your clinician may consider. Avoid self-labelling — describe what you experience.",
  }),
  a({
    id: "pcos-nutrition-ng",
    title: "Everyday energy & food rhythms (Nigeria)",
    topic: "pcos",
    markets: ["NG"],
    summary: "Gentle ideas for steady energy — not a treatment plan.",
    body: "Balanced meals, hydration, and sleep routines support wellness. Local dietitians or clinicians can advise what fits your health history. This is education, not medical advice.",
  }),
  a({
    id: "pcos-ghs-gh",
    title: "Finding care pathways (Ghana)",
    topic: "pcos",
    markets: ["GH"],
    summary:
      "How logged patterns can support a clinic visit via Ghana Health Service or private care.",
    body: "Share timelines of cycles and symptoms. Clinicians decide next steps. GirlCode360 is a wellness companion, not a diagnostic tool.",
  }),
  a({
    id: "pcos-stress-sleep",
    title: "Stress, sleep, and cycle irregularity",
    topic: "pcos",
    markets: ["UK", "NG", "GH"],
    summary:
      "Possible patterns between sleep, stress scores, and cycle length — for awareness only.",
    body: "When sleep is short or stress is high, some people notice cycle changes. Logging biometrics can surface possible patterns. Patterns are not proof of a diagnosis.",
  }),
  a({
    id: "pcos-pathways",
    title: "Care pathways people discuss with clinicians",
    topic: "pcos",
    markets: ["UK", "NG", "GH"],
    summary:
      "What a clinic visit might cover. GirlCode360 does not choose treatment.",
    body: "Clinicians may talk through blood tests, ultrasound, lifestyle, or medicines such as metformin or inositol if they judge it appropriate. Bring your diary. This app does not recommend or start treatment.",
  }),
  a({
    id: "pcos-fertility",
    title: "Fertility conversations (wellness overview)",
    topic: "pcos",
    markets: ["UK", "NG", "GH"],
    summary:
      "Irregular cycles and fertility are questions for a qualified clinician.",
    body: "Some people with irregular bleeds discuss fertility timing or investigations with a GP, gynaecologist, or fertility clinic. Logs can support that talk. GirlCode360 does not assess fertility or pregnancy.",
  }),
  a({
    id: "pcos-food-uk",
    title: "Food rhythms (UK)",
    topic: "pcos",
    markets: ["UK"],
    summary:
      "NHS-aligned wellness framing for meals and energy — not a diet plan.",
    body: "Steady meals, fibre, and movement that you can keep up often help energy. An NHS dietitian or GP can advise what fits your history. This is education, not treatment.",
  }),
  a({
    id: "pcos-food-gh",
    title: "Food rhythms (Ghana)",
    topic: "pcos",
    markets: ["GH"],
    summary: "Gentle meal ideas in a Ghanaian context — not a treatment plan.",
    body: "Balanced plates, hydration, and sleep support wellness. A GHS clinic or dietitian can advise what fits you. GirlCode360 does not prescribe diets.",
  }),
  a({
    id: "cycle-basics",
    title: "Cycle logging basics",
    topic: "cycle",
    markets: ["UK", "NG", "GH"],
    summary: "How gentle daily logs support clinic conversations.",
    body: "Record period start dates, flow, and symptoms that matter to you. Patterns over time are useful context for clinicians — not a diagnosis.",
  }),
  a({
    id: "cycle-nhs-uk",
    title: "Cycle care in the UK",
    topic: "cycle",
    markets: ["UK"],
    summary: "NHS-aligned framing for period logs — not a diagnosis.",
    body: "NHS 111 can advise if bleeding is heavy with dizziness. Bring dated logs to a GP. GirlCode360 estimates are wellness tools, not clinical dating.",
  }),
  a({
    id: "cycle-fmoh-ng",
    title: "Cycle care in Nigeria",
    topic: "cycle",
    markets: ["NG"],
    summary: "FMOH-aware wellness context for period logs.",
    body: "Public and private clinics differ by city. Dated cycle logs can support a visit. Emergency number 112. GirlCode360 does not diagnose.",
  }),
  a({
    id: "cycle-ghs-gh",
    title: "Cycle care in Ghana",
    topic: "cycle",
    markets: ["GH"],
    summary: "GHS-aware wellness context for period logs.",
    body: "Ghana Health Service and private clinics can review your dates. Emergency 999 or 193. Logs are context, not a diagnosis.",
  }),
  a({
    id: "pregnancy-kick-counts",
    title: "Noticing foetal movement",
    topic: "pregnancy",
    markets: ["UK", "NG", "GH"],
    summary: "Awareness tips — always follow local clinical guidance.",
    body: "Many clinics ask you to notice movement patterns in later pregnancy. If movements change suddenly, contact emergency or maternity triage for your area. GirlCode360 does not replace clinical advice.",
  }),
  a({
    id: "pregnancy-nhs-uk",
    title: "Pregnancy care in the UK",
    topic: "pregnancy",
    markets: ["UK"],
    summary: "NHS maternity pathways — education only.",
    body: "Midwife-led NHS care is the usual first contact. 111 and 999 remain for urgent symptoms. EDD in this app is an estimate. Your clinician confirms dating.",
  }),
  a({
    id: "pregnancy-fmoh-ng",
    title: "Pregnancy care in Nigeria",
    topic: "pregnancy",
    markets: ["NG"],
    summary: "FMOH-aware antenatal context — not a care plan.",
    body: "Antenatal schedules vary by facility. Keep your own hospital number. 112 is the national emergency line. GirlCode360 does not replace antenatal clinic visits.",
  }),
  a({
    id: "pregnancy-ghs-gh",
    title: "Pregnancy care in Ghana",
    topic: "pregnancy",
    markets: ["GH"],
    summary: "GHS-aware antenatal context — not a care plan.",
    body: "Attend the antenatal clinic your midwife names. 999 and 193 are emergency numbers. This app’s week content is education, not a prescription.",
  }),
  a({
    id: "ttc-timing",
    title: "Fertile window awareness",
    topic: "ttc",
    markets: ["UK", "NG", "GH"],
    summary: "Wellness framing for trying-to-conceive timing.",
    body: "Predicted fertile windows are estimates from logged cycles. They are not a guarantee of ovulation. Speak with a clinician if you have questions about fertility care.",
  }),
  a({
    id: "ttc-nice-uk",
    title: "When to talk about fertility care (UK)",
    topic: "ttc",
    markets: ["UK"],
    summary: "NICE-aligned wellness framing — not a referral or diagnosis.",
    body: "NICE fertility guidance is for clinicians. Many people in the UK discuss next steps with a GP after about a year of trying, sooner if there is a known condition. GirlCode360 can help you list dates. Only a clinician decides investigations.",
  }),
  a({
    id: "ttc-fmoh-ng",
    title: "Fertility conversations in Nigeria",
    topic: "ttc",
    markets: ["NG"],
    summary: "FMOH-aware pathways — private clinic or public hospital.",
    body: "Logged cycles and a calm timeline can support a clinic visit. Nigerian public and private pathways differ by city. This article does not recommend a treatment. Ask a clinician about local reproductive health services.",
  }),
  a({
    id: "ttc-ghs-gh",
    title: "Fertility conversations in Ghana",
    topic: "ttc",
    markets: ["GH"],
    summary: "GHS-aware wellness context for a clinic visit.",
    body: "Bring your cycle dates and how long you have been trying. Ghana Health Service and private clinics can advise. GirlCode360 does not diagnose infertility or promise pregnancy.",
  }),
  a({
    id: "ttc-lifestyle",
    title: "Everyday factors people discuss while trying",
    topic: "ttc",
    markets: ["UK", "NG", "GH"],
    summary: "Sleep, stress, alcohol, and smoking — general wellness only.",
    body: "Clinicians often ask about sleep, stress, smoking, and alcohol because they can affect overall health. Changes are personal. This is education, not a conception protocol.",
  }),
  a({
    id: "privacy-your-data",
    title: "Your data, your controls",
    topic: "privacy",
    markets: ["UK", "NG", "GH"],
    summary: "Export, consents, and account deletion in GirlCode360.",
    body: "Use Privacy Centre to review consents, download a JSON export, or request deletion with a 24-hour cooling-off period. Health Wallet files stay client-encrypted.",
  }),
  a({
    id: "privacy-uk-gdpr",
    title: "UK GDPR in this app",
    topic: "privacy",
    markets: ["UK"],
    summary: "Health data is special-category. Consent is explicit.",
    body: "UK GDPR Articles 15, 17, and 20 cover access, erasure, and portability. My Data, JSON export, and deletion with a 24-hour cooling-off live in Account. Withdraw optional consents any time.",
  }),
  a({
    id: "privacy-ndpa-ng",
    title: "Nigeria NDPA in this app",
    topic: "privacy",
    markets: ["NG"],
    summary: "Health data needs explicit consent under the NDPA.",
    body: "You can see what we hold in My Data, export JSON, or request deletion. Optional purposes stay off until you turn them on. Marketplace location is session-only unless you grant location consent.",
  }),
  a({
    id: "privacy-dpa-gh",
    title: "Ghana DPA in this app",
    topic: "privacy",
    markets: ["GH"],
    summary: "Health data needs your explicit consent.",
    body: "Account holds My Data, export, and deletion. Mirror photos are a separate consent. Cycle, Alena, and Wallet still work if you decline Mirror.",
  }),
  a({
    id: "shematch-how",
    title: "How SheMatch suggestions work",
    topic: "general",
    markets: ["UK", "NG", "GH"],
    summary: "Rules, consent, and the 5 km silence rule.",
    body: "SheMatch is a rules table, not an LLM. It only runs with SheMatch consent, the matching module on, a health trigger, and a live listing within 5 km. If none match, it stays silent. Suggestions are labelled. Not a prescription.",
  }),
  a({
    id: "lock-screen-notes",
    title: "Notifications on a shared phone",
    topic: "general",
    markets: ["UK", "NG", "GH"],
    summary: "Lock-screen bodies never name health events.",
    body: "Push titles stay GirlCode360. The body is always “You have a note in GirlCode360”. Quiet hours default 22:00–07:00. Turn types off in Account.",
  }),
  a({
    id: "mirror-photos",
    title: "Mirror photos and YouCam",
    topic: "general",
    markets: ["UK", "NG", "GH"],
    summary: "Processor terms in plain language.",
    body: "Face and body photos go to Perfect Corp. (YouCam) only for your analysis. We copy results into GirlCode360. YouCam keeps files up to 30 days. Removing a scan here also asks YouCam to delete their copy. Not used to train their models unless you later agree separately.",
  }),
];

export type PublishedArticle = LibraryArticle & { outdated: boolean };

export function libraryArticles(
  market: "UK" | "NG" | "GH",
  topic?: string,
  now = new Date(),
): PublishedArticle[] {
  const rows = LIBRARY_ARTICLES.filter((art) => art.markets.includes(market)).map(
    (art) => ({
      ...art,
      outdated: articleDueForReview(art.reviewedAt, now),
    }),
  );
  if (!topic || topic === "all") return rows;
  return rows.filter((art) => art.topic === topic);
}

export function libraryArticleById(id: string): LibraryArticle | undefined {
  return LIBRARY_ARTICLES.find((art) => art.id === id);
}

export function stripReportLinks(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, "[link removed]")
    .slice(0, 500);
}
