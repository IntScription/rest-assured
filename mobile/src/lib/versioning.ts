export function compareVersions(a: string, b: string): number {
  const aParts = a.split(".").map((n) => parseInt(n, 10) || 0);
  const bParts = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < len; i += 1) {
    const av = aParts[i] ?? 0;
    const bv = bParts[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }

  return 0;
}

export function isVersionLessThan(current: string, required: string): boolean {
  return compareVersions(current, required) < 0;
}
