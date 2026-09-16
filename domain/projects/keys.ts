export function projectKeyBase(name: string): string {
  const words = name.toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  const initials = words.map((word) => word[0]).join("");
  const compact = words.join("");
  const candidate = (words.length > 1 ? initials : compact).replace(/^[0-9]+/, "").slice(0, 10);
  return candidate.length >= 2 ? candidate : `${candidate || "P"}R`.slice(0, 10);
}

export function projectKeyCandidate(base: string, attempt: number): string {
  if (attempt === 0) return base;
  const suffix = String(attempt + 1);
  return `${base.slice(0, 10 - suffix.length)}${suffix}`;
}
