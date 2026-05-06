// Question source taxonomy
export type SourceKey = "all" | "phak" | "ciaac" | "web" | "pdf";

export interface SourceTab {
  key: SourceKey;
  label: string;
  match: string[] | null;
}

export const SOURCE_TABS: SourceTab[] = [
  { key: "all", label: "Todas", match: null },
  { key: "phak", label: "PHAK", match: ["phak"] },
  { key: "ciaac", label: "CIAAC", match: ["ciaac", "ai_generated"] },
  { key: "web", label: "Web", match: ["web", "internet"] },
  { key: "pdf", label: "Mis PDFs", match: ["pdf"] },
];

export function sourceLabel(s?: string | null): string {
  if (!s) return "—";
  if (s === "phak") return "PHAK";
  if (s === "ciaac" || s === "ai_generated") return "CIAAC";
  if (s === "web" || s === "internet") return "Web";
  if (s === "pdf") return "PDF propio";
  return s;
}
