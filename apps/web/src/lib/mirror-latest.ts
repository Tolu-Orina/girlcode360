export function latestByCreatedAt<T extends { createdAt: string }>(
  rows: T[],
): T | null {
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

export function latestLiveScan<T extends { createdAt: string; seeded?: boolean }>(
  rows: T[],
): T | null {
  const sorted = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return sorted.find((row) => !row.seeded) ?? sorted[0] ?? null;
}
