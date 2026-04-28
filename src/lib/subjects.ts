export const SUBJECTS = [
  "Meteorología",
  "Navegación",
  "Reglamentación RAB/ICAO",
  "Performance y Peso",
  "Sistemas de Aeronave",
  "Comunicaciones",
  "Factores Humanos",
  "Procedimientos IFR",
] as const;

export type Subject = (typeof SUBJECTS)[number];

export const SUBJECT_ICONS: Record<Subject, string> = {
  "Meteorología": "🌦️",
  "Navegación": "🧭",
  "Reglamentación RAB/ICAO": "📜",
  "Performance y Peso": "⚖️",
  "Sistemas de Aeronave": "⚙️",
  "Comunicaciones": "📡",
  "Factores Humanos": "🧠",
  "Procedimientos IFR": "🛬",
};
