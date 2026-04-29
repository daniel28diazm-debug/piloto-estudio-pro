// PHAK chapter list and loader logic.

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

export const PHAK_TOTAL_QUESTIONS = PHAK_CHAPTERS.length * 40;
