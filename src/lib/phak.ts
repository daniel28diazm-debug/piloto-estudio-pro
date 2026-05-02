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
export const CIAAC_GUIDE_TOTAL = 250;
export const CIAAC_GUIDE_BATCH_SIZE = 10; // smaller batches → no edge timeouts

// Phase 3 — Generación por materia (target totals — 12 materias)
export const SUBJECT_TARGETS: Record<Subject, number> = {
  "Navegación Aérea": 400,
  "Factores Humanos y Fisiología": 350,
  "Aerodinámica y Principios de Vuelo": 320,
  "Reglamentación RAB / Legislación Aeronáutica": 280,
  "Sistemas de Aeronave": 250,
  "Operaciones Aeronáuticas": 250,
  "Comunicaciones y ATC": 250,
  "Meteorología": 250,
  "Espacio Aéreo": 220,
  "Performance y Peso y Balance": 200,
  "Procedimientos IFR": 200,
  "Reglamentación OACI / Anexos": 200,
};

// Generate in small chunks so a single edge call always finishes < 120 s.
export const SUBJECT_BATCH_SIZE = 10;

export const PHASE3_TOTAL = Object.values(SUBJECT_TARGETS).reduce((a, b) => a + b, 0); // 3,170

export const BANK_TOTAL_TARGET =
  PHAK_TOTAL_QUESTIONS + CIAAC_GUIDE_TOTAL + PHASE3_TOTAL; // ≈ 4,060

// CIAAC official exam (12 materias, suma = 405)
export const CIAAC_EXAM_TOTAL_QUESTIONS = 405;
export const CIAAC_EXAM_TIME_MINUTES = 330;
export const CIAAC_EXAM_PASS_PCT = 80; // strict: 79.99 reprueba

export const CIAAC_EXAM_DISTRIBUTION: Record<Subject, number> = {
  "Navegación Aérea": 55,
  "Sistemas de Aeronave": 45,
  "Reglamentación RAB / Legislación Aeronáutica": 45,
  "Factores Humanos y Fisiología": 40,
  "Procedimientos IFR": 35,
  "Aerodinámica y Principios de Vuelo": 35,
  "Comunicaciones y ATC": 30,
  "Meteorología": 30,
  "Operaciones Aeronáuticas": 30,
  "Espacio Aéreo": 25,
  "Reglamentación OACI / Anexos": 20,
  "Performance y Peso y Balance": 15,
};
// total = 405
