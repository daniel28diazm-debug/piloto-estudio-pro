// Bank construction plan: PHAK chapters, subject targets, CIAAC exam config.

import type { Subject } from "./subjects";

export interface PhakChapter {
  number: number;
  name: string;
}

export const PHAK_CHAPTERS: PhakChapter[] = [
  { number: 2, name: "Introducción a la certificación de pilotos" },
  { number: 3, name: "Toma de decisiones aeronáuticas (ADM)" },
  { number: 4, name: "Principios de vuelo y aerodinámica" },
  { number: 5, name: "Controles de vuelo" },
  { number: 6, name: "Sistemas de la aeronave" },
  { number: 7, name: "Instrumentos de vuelo" },
  { number: 8, name: "Manuales y documentos del piloto" },
  { number: 9, name: "Peso y balance" },
  { number: 10, name: "Performance de la aeronave" },
  { number: 11, name: "Meteorología" },
  { number: 12, name: "Servicios meteorológicos" },
  { number: 13, name: "Operaciones en aeropuerto" },
  { number: 14, name: "Espacio aéreo" },
  { number: 15, name: "Navegación" },
  { number: 16, name: "Factores aeromédicos" },
  { number: 17, name: "Toma de decisiones avanzada" },
];

// Phase 1 — PHAK
export const PHAK_QUESTIONS_PER_CHAPTER = 40;
export const PHAK_TOTAL_QUESTIONS = PHAK_CHAPTERS.length * PHAK_QUESTIONS_PER_CHAPTER; // 640

// Phase 2 — Guía Oficial CIAAC del Sustentante
// Generated as a single block of materia-mixed questions covering the syllabus.
export const CIAAC_GUIDE_TOTAL = 250;
export const CIAAC_GUIDE_BATCH_SIZE = 25; // 10 batches

// Phase 3 — Generación por materia (target totals)
// Mapped to the 8 internal subjects we use in the DB. The user requested 12
// "areas" but several map to the same internal materia (e.g. Aerodinámica +
// Sistemas de Aeronaves both -> "Sistemas de Aeronave"). We aggregate.
export const SUBJECT_TARGETS: Record<Subject, number> = {
  "Navegación": 400,
  "Factores Humanos": 350, // Fisiología + Factores Humanos
  "Sistemas de Aeronave": 570, // Aerodinámica (320) + Sistemas (250)
  "Reglamentación RAB/ICAO": 480, // Legislación RAB (280) + OACI (200)
  "Procedimientos IFR": 450, // Operaciones (250) + Procedimientos IFR (200)
  "Comunicaciones": 450, // Tránsito ATC (250) + Comunicaciones (200)
  "Meteorología": 250,
  "Performance y Peso": 200,
};

export const SUBJECT_BATCH_SIZE = 25; // questions per AI call

export const PHASE3_TOTAL = Object.values(SUBJECT_TARGETS).reduce((a, b) => a + b, 0);
// = 3,150

export const BANK_TOTAL_TARGET =
  PHAK_TOTAL_QUESTIONS + CIAAC_GUIDE_TOTAL + PHASE3_TOTAL; // 4,040

// CIAAC official exam distribution (approx. — based on guía del sustentante).
// Used by the simulator to build a 405-question exam weighted by materia.
export const CIAAC_EXAM_TOTAL_QUESTIONS = 405;
export const CIAAC_EXAM_TIME_MINUTES = 330;
export const CIAAC_EXAM_PASS_PCT = 80; // strict: 79.99 reprueba

export const CIAAC_EXAM_DISTRIBUTION: Record<Subject, number> = {
  "Navegación": 70,
  "Sistemas de Aeronave": 65,
  "Reglamentación RAB/ICAO": 60,
  "Factores Humanos": 50,
  "Procedimientos IFR": 50,
  "Comunicaciones": 40,
  "Meteorología": 40,
  "Performance y Peso": 30,
};
// total = 405
