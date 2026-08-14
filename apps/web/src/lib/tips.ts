const TOUR_KEY = "gc360.tutorial.v1";
const TIPS_KEY = "gc360.tips.v1";

export function tourSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === "1";
  } catch {
    return true;
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(TOUR_KEY, "1");
  } catch {
    /* private mode */
  }
}

export function tipSeen(id: string): boolean {
  try {
    const raw = localStorage.getItem(TIPS_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw) as Record<string, boolean>;
    return map[id] === true;
  } catch {
    return false;
  }
}

export function markTipSeen(id: string): void {
  try {
    const raw = localStorage.getItem(TIPS_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    map[id] = true;
    localStorage.setItem(TIPS_KEY, JSON.stringify(map));
  } catch {
    /* private mode */
  }
}

export function resetTourAndTips(): void {
  try {
    localStorage.removeItem(TOUR_KEY);
    localStorage.removeItem(TIPS_KEY);
  } catch {
    /* private mode */
  }
}
