export const DANCE_YEAR_ERROR =
  "Ange år med två eller fyra siffror, t.ex. 23 eller 2023.";

export function normalizeDanceYear(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const year = value.trim();
  if (!/^(?:\d{2}|\d{4})$/.test(year)) return null;
  if (year.length === 4 && Number(year) < 2000) return null;

  return year.slice(-2);
}
