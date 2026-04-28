// SM-2 spaced repetition algorithm
// Quality: 0=Difícil, 3=Bien, 5=Fácil

export type Rating = "difícil" | "bien" | "fácil";

export interface SM2State {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
}

export function ratingToQuality(r: Rating): number {
  if (r === "difícil") return 2;
  if (r === "bien") return 4;
  return 5;
}

export function sm2(prev: SM2State, rating: Rating): SM2State & { due_at: Date } {
  const q = ratingToQuality(rating);
  let { ease_factor, interval_days, repetitions } = prev;

  if (q < 3) {
    repetitions = 0;
    interval_days = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) interval_days = 1;
    else if (repetitions === 2) interval_days = 6;
    else interval_days = Math.round(interval_days * ease_factor);
  }

  ease_factor = Math.max(
    1.3,
    ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
  );

  const due_at = new Date();
  due_at.setDate(due_at.getDate() + interval_days);

  return { ease_factor, interval_days, repetitions, due_at };
}
