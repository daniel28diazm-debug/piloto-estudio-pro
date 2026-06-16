// SM-2 spaced repetition algorithm (CIAAC tuned)
// Ladder for correct answers: 1, 3, 7, 16, 30, 30+ days

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

const LADDER = [1, 3, 7, 16, 30]; // 1st..5th correct

export function sm2(prev: SM2State, rating: Rating): SM2State & { due_at: Date } {
  const q = ratingToQuality(rating);
  let { ease_factor, interval_days, repetitions } = prev;

  if (q < 3) {
    // Wrong: reset
    repetitions = 0;
    interval_days = 1;
  } else {
    repetitions += 1;
    if (repetitions <= LADDER.length) {
      interval_days = LADDER[repetitions - 1];
    } else {
      // 6th+: grow with ease factor, min 30
      interval_days = Math.max(30, Math.round(interval_days * ease_factor));
    }
  }

  ease_factor = Math.max(
    1.3,
    ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
  );

  const due_at = new Date();
  due_at.setDate(due_at.getDate() + interval_days);

  return { ease_factor, interval_days, repetitions, due_at };
}
