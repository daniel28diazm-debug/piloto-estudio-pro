// Study engine: subject rotation + classification + SM-2 scheduling.
import { sm2 } from "./sm2";
import type { Subject } from "./subjects";

export type ProgressStatus = "new" | "in_progress" | "mastered";

export interface ProgressRow {
  question_id: string;
  times_seen: number;
  times_correct: number;
  times_wrong: number;
  consecutive_correct: number;
  status: ProgressStatus;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
}

export interface StudyQuestion {
  id: string;
  subject: Subject;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string;
  source?: string | null;
  reference?: string | null;
}

/** Build a queue using true round-robin: take 1 question from each subject (in
 * shuffled order) before repeating any subject. Guarantees no two consecutive
 * questions share a subject (when ≥2 subjects have items). */
export function buildRotatedQueue(questions: StudyQuestion[]): StudyQuestion[] {
  const buckets = new Map<Subject, StudyQuestion[]>();
  for (const q of questions) {
    const arr = buckets.get(q.subject) ?? [];
    arr.push(q);
    buckets.set(q.subject, arr);
  }
  for (const arr of buckets.values()) arr.sort(() => Math.random() - 0.5);

  const result: StudyQuestion[] = [];
  let lastSubject: Subject | null = null;

  while (result.length < questions.length) {
    // One pass: take one from each non-empty subject (shuffled order each round)
    const order = [...buckets.entries()].filter(([, a]) => a.length > 0);
    order.sort(() => Math.random() - 0.5);
    if (order.length === 0) break;

    for (let i = 0; i < order.length; i++) {
      // Avoid consecutive same subject across round boundaries
      if (i === 0 && order[i][0] === lastSubject && order.length > 1) {
        const swap = order[1];
        order[1] = order[0];
        order[0] = swap;
      }
      const [, arr] = order[i];
      const q = arr.shift()!;
      result.push(q);
      lastSubject = q.subject;
    }
  }
  return result;
}

/** Insert at random position between min..max indices ahead of current. */
export function reinsertAhead<T>(queue: T[], item: T, min: number, max: number): T[] {
  const offset = Math.max(1, Math.floor(min + Math.random() * (max - min + 1)));
  const pos = Math.min(queue.length, offset);
  const next = [...queue];
  next.splice(pos, 0, item);
  return next;
}

export interface ClassifyOutcome {
  status: ProgressStatus;
  consecutive_correct: number;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  due_at: Date;
  reinsertSession: boolean; // re-show in same session
  reinsertWindow: [number, number]; // ahead window
}

export function classifyAnswer(prev: ProgressRow, isCorrect: boolean): ClassifyOutcome {
  const consecutive = isCorrect ? prev.consecutive_correct + 1 : 0;

  const rating = isCorrect ? (consecutive >= 3 ? "fácil" : "bien") : "difícil";
  const sm = sm2(
    {
      ease_factor: prev.ease_factor,
      interval_days: prev.interval_days,
      repetitions: prev.repetitions,
    },
    rating,
  );

  // Per spec: correct answers NEVER re-appear in the same session.
  // Wrong answers re-appear ONCE at the end of the session (handled by the
  // study page, not by the classifier). We keep the legacy flags but the
  // study page now uses its own end-of-session queue for wrong items.
  let status: ProgressStatus = "in_progress";
  if (!isCorrect) status = "in_progress";
  else if (consecutive >= 3) status = "mastered";

  return {
    status,
    consecutive_correct: consecutive,
    ease_factor: sm.ease_factor,
    interval_days: sm.interval_days,
    repetitions: sm.repetitions,
    due_at: sm.due_at,
    reinsertSession: false,
    reinsertWindow: [0, 0],
  };
}

