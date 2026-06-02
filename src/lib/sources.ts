// Question source taxonomy
export type SourceKey = "all" | "phak" | "ciaac" | "web" | "pdf";

export interface SourceTab {
  key: SourceKey;
  label: string;
  match: string[] | null;
}

// Source codes considered "web/internet-derived" content
const WEB_SOURCES = [
  "web", "internet",
  "pilot_institute",
  "legislacion_mexicana",
  "libertades_aire",
  "anexos_oaci",
];

export const SOURCE_TABS: SourceTab[] = [
  { key: "all", label: "Todas", match: null },
  { key: "phak", label: "PHAK", match: ["phak"] },
  { key: "ciaac", label: "CIAAC", match: ["ciaac", "ai_generated"] },
  { key: "web", label: "Web", match: WEB_SOURCES },
  { key: "pdf", label: "Mis PDFs", match: ["pdf"] },
];

/** Display label for a source code. Pass documentId so legacy `pdf` rows
 *  without an associated upload show up as CIAAC (their real origin). */
export function sourceLabel(s?: string | null, documentId?: string | null): string {
  if (!s) return "—";
  if (s === "phak") return "PHAK";
  if (s === "ciaac" || s === "ai_generated") return "CIAAC";
  if (WEB_SOURCES.includes(s)) return "Web";
  if (s === "pdf") return documentId ? "Mi PDF" : "CIAAC";
  return s;
}

/** Coarse bucket for filtering UI. */
export function sourceBucket(s?: string | null, documentId?: string | null): SourceKey {
  if (s === "phak") return "phak";
  if (s === "ciaac" || s === "ai_generated") return "ciaac";
  if (s && WEB_SOURCES.includes(s)) return "web";
  if (s === "pdf") return documentId ? "pdf" : "ciaac";
  return "all";
}
