/**
 * Convert seconds to "mm:ss" string.
 */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Parse "mm:ss" string to total seconds.
 * Returns NaN if the format is invalid.
 */
export function parseTime(str: string): number {
  const parts = str.trim().split(":");
  if (parts.length !== 2) return NaN;
  const m = parseInt(parts[0], 10);
  const s = parseInt(parts[1], 10);
  if (isNaN(m) || isNaN(s)) return NaN;
  return m * 60 + s;
}

/**
 * Get or create an anonymous session ID stored in localStorage.
 */
export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("nolledansa_session");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("nolledansa_session", id);
  }
  return id;
}

/**
 * Combine section and year into a display label, e.g. "D23".
 */
export function sectionLabel(section: string, year: string): string {
  return `${section}${year}`;
}

export function sectionLabelWithOrganization(
  section: string,
  year: string,
  organization?: string | null
): string {
  const label = sectionLabel(section, year);
  const normalizedOrganization = organization?.toLowerCase() ?? "";

  if (normalizedOrganization.includes("phusk")) {
    return `${label} - Phusk`;
  }

  if (
    normalizedOrganization.includes("sex") ||
    normalizedOrganization.includes("fest")
  ) {
    return `${label} - Sex`;
  }

  return label;
}

const SECTION_COLORS: Record<string, string> = {
  K: "#FAE916",
  D: "#F280A1",
  W: "#78D6CC",
  V: "#1A377A",
  M: "#CD1B22",
  I: "#6F1130",
  E: "#FFFFFF",
  F: "#F16126",
  A: "#93268F",
  ING: "#212A63",
  // Legacy fallback colors
  N: "#212A63",
};

function normalizeSection(section: string): string {
  const upper = section.toUpperCase();
  if (upper === "N") return "ING";
  return upper;
}

function hexToRgb(hex: string) {
  const cleaned = hex.replace("#", "");
  const value = cleaned.length === 3
    ? cleaned
        .split("")
        .map((ch) => `${ch}${ch}`)
        .join("")
    : cleaned;

  const int = Number.parseInt(value, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function isLightColor(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.64;
}

export function getSectionTheme(section: string) {
  const normalized = normalizeSection(section);
  const accent = SECTION_COLORS[normalized] ?? "#F280A1";
  const light = isLightColor(accent);

  return {
    accent,
    onAccent: light ? "#111827" : "#FFFFFF",
    labelColor: normalized === "E" ? "#111827" : accent,
    tint: `${accent}22`,
    border: `${accent}66`,
    normalized,
  };
}
