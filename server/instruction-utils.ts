export function normalizeScopeFilter(value: unknown): string[] {
  const normalize = (input: string) =>
    input
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

  if (typeof value === "string") {
    return normalize(value);
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => (typeof entry === "string" ? normalize(entry) : []));
  }

  return [];
}
