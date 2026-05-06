// Question source taxonomy
export const SOURCE_TABS = [
  { key: "all", label: "Todas", match: null as null | string[] },
  { key: "phak", label: "PHAK", match: ["phak"] },
  { key: "ciaac", label: "CIAAC", match: ["ciaac", "ai_generated"] },
  { key: "web", label: "Web", match: ["web", "internet"] },
  { key: "pdf", label: "Mis PDFs", match: ["pdf"] },
] as const;

export type SourceKey = (typeof SOURCE_TABS)[number]["key"];

export function sourceLabel(s?: string | null): string {
  if (!s) return "—";
  if (s === "phak") return "PHAK";
  if (s === "ciaac" || s === "ai_generated") return "CIAAC";
  if (s === "web" || s === "internet") return "Web";
  if (s === "pdf") return "PDF propio";
  return s;
}
