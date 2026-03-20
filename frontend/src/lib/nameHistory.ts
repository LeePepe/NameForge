export function mergeSeenNames(
  previousNames: string[],
  nextNames: string[]
): string[] {
  const seen = new Set(previousNames.map((name) => name.toLowerCase()));
  const merged = [...previousNames];

  for (const name of nextNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    merged.push(trimmed);
  }

  return merged;
}
