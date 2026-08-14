/** Inlined week content for Lambda (avoids JSON fs in bundle). */
export type WeekRow = {
  week: number;
  title: string;
  baby: string;
  maternal: string;
  nutrition: string;
  priority: boolean;
  clinicalNote: string;
};

const MARKET_NOTE: Record<"UK" | "NG" | "GH", string> = {
  UK: "UK: follow NHS antenatal guidance and your midwife or GP. This is wellness copy, not clinical advice.",
  NG: "Nigeria: follow Federal Ministry of Health antenatal guidance and your clinic. This is wellness copy, not clinical advice.",
  GH: "Ghana: follow Ghana Health Service antenatal guidance and your clinician. This is wellness copy, not clinical advice.",
};

const PRIORITY = new Set([
  4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 19, 20, 21, 22, 36, 37, 38, 39, 40,
]);

const FILLED: Record<
  number,
  { title: string; baby: string; maternal: string; nutrition: string }
> = {
  4: {
    title: "Early weeks",
    baby: "A tiny cluster of cells is forming.",
    maternal: "You may notice fatigue or tender breasts.",
    nutrition: "Folate-rich foods support early development.",
  },
  5: {
    title: "Week 5",
    baby: "The neural tube is beginning to form.",
    maternal: "Nausea may start for some people.",
    nutrition: "Stay hydrated; small frequent meals can help.",
  },
  6: {
    title: "Week 6",
    baby: "A heartbeat may be detectable on scan.",
    maternal: "Heightened smell and tiredness are common.",
    nutrition: "Continue prenatal vitamins if advised by your clinician.",
  },
  8: {
    title: "Week 8",
    baby: "Facial features are starting to shape.",
    maternal: "Clothes may feel tighter around the waist.",
    nutrition: "Iron-rich foods support energy.",
  },
  12: {
    title: "End of first trimester",
    baby: "Many major organs are formed.",
    maternal: "Energy may return for some people.",
    nutrition: "Discuss screening options with your clinician.",
  },
  18: {
    title: "Mid-pregnancy",
    baby: "Movements may become clearer.",
    maternal: "Round-ligament twinges can occur.",
    nutrition: "Balanced plates with protein and fibre.",
  },
  20: {
    title: "Halfway mark",
    baby: "Anatomy scan window for many clinics.",
    maternal: "You may feel stronger kicks.",
    nutrition: "Keep up fluids and gentle movement if cleared.",
  },
  22: {
    title: "Week 22",
    baby: "Hearing pathways continue to mature.",
    maternal: "Back discomfort can increase.",
    nutrition: "Supportive shoes and rest breaks help.",
  },
  36: {
    title: "Late pregnancy",
    baby: "Baby practices breathing movements.",
    maternal: "Braxton Hicks may be noticed.",
    nutrition: "Small meals; elevate feet when swollen.",
  },
  38: {
    title: "Near term",
    baby: "Baby may drop lower.",
    maternal: "Sleep can be fragmented.",
    nutrition: "Know your local emergency numbers.",
  },
  40: {
    title: "Due-week window",
    baby: "Ready for birth timing that clinicians discuss.",
    maternal: "Rest when you can.",
    nutrition: "Have your hospital bag and contacts ready.",
  },
};

export function allWeekContent(market: "UK" | "NG" | "GH" = "UK"): WeekRow[] {
  const rows: WeekRow[] = [];
  for (let w = 4; w <= 42; w++) {
    const filled = FILLED[w];
    rows.push({
      week: w,
      title: filled?.title ?? `Week ${w}`,
      baby:
        filled?.baby ??
        "Development continues week by week — ask your clinician for personalised guidance.",
      maternal:
        filled?.maternal ??
        "Notice how you feel; log symptoms that matter to you.",
      nutrition:
        filled?.nutrition ??
        "Eat regularly, drink water, and follow clinician advice for supplements.",
      priority: PRIORITY.has(w),
      clinicalNote: MARKET_NOTE[market],
    });
  }
  return rows;
}

export function weekContent(
  week: number,
  market: "UK" | "NG" | "GH" = "UK",
): WeekRow | undefined {
  return allWeekContent(market).find((r) => r.week === week);
}
