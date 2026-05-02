// 12 materias oficiales del banco de preguntas CIAAC.
// Estos strings DEBEN coincidir con los valores del enum `subject` en la base.

export const SUBJECTS = [
  "Meteorología",
  "Navegación Aérea",
  "Reglamentación RAB / Legislación Aeronáutica",
  "Performance y Peso y Balance",
  "Sistemas de Aeronave",
  "Comunicaciones y ATC",
  "Factores Humanos y Fisiología",
  "Procedimientos IFR",
  "Aerodinámica y Principios de Vuelo",
  "Operaciones Aeronáuticas",
  "Espacio Aéreo",
  "Reglamentación OACI / Anexos",
] as const;

export type Subject = (typeof SUBJECTS)[number];

export const SUBJECT_ICONS: Record<Subject, string> = {
  "Meteorología": "🌦️",
  "Navegación Aérea": "🧭",
  "Reglamentación RAB / Legislación Aeronáutica": "📜",
  "Performance y Peso y Balance": "⚖️",
  "Sistemas de Aeronave": "⚙️",
  "Comunicaciones y ATC": "📡",
  "Factores Humanos y Fisiología": "🧠",
  "Procedimientos IFR": "🛬",
  "Aerodinámica y Principios de Vuelo": "✈️",
  "Operaciones Aeronáuticas": "🛫",
  "Espacio Aéreo": "🗺️",
  "Reglamentación OACI / Anexos": "🌐",
};

// Short labels used in compact UIs (mobile nav, badges).
export const SUBJECT_SHORT: Record<Subject, string> = {
  "Meteorología": "Meteo",
  "Navegación Aérea": "Navegación",
  "Reglamentación RAB / Legislación Aeronáutica": "RAB",
  "Performance y Peso y Balance": "Performance",
  "Sistemas de Aeronave": "Sistemas",
  "Comunicaciones y ATC": "Com/ATC",
  "Factores Humanos y Fisiología": "Factores Hum.",
  "Procedimientos IFR": "IFR",
  "Aerodinámica y Principios de Vuelo": "Aerodinámica",
  "Operaciones Aeronáuticas": "Operaciones",
  "Espacio Aéreo": "Espacio Aéreo",
  "Reglamentación OACI / Anexos": "OACI",
};
