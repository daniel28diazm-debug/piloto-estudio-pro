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

/** Build a queue: shuffle, then round-robin over subjects so no two consecutive share a subject when possible. */
export function buildRotatedQueue(questions: StudyQuestion[]): StudyQuestion[] {
  const buckets = new Map<Subject, StudyQuestion[]>();
  for (const q of questions) {
    const arr = buckets.get(q.subject) ?? [];
    arr.push(q);
    buckets.set(q.subject, arr);
  }
  // Shuffle each bucket
  for (const arr of buckets.values()) arr.sort(() => Math.random() - 0.5);
  // Order subjects by remaining count desc each time
  const result: StudyQuestion[] = [];
  let lastSubject: Subject | null = null;
  while (result.length < questions.length) {
    const candidates = [...buckets.entries()]
      .filter(([_, arr]) => arr.length > 0)
      .sort((a, b) => b[1].length - a[1].length);
    if (candidates.length === 0) break;
    let pick = candidates.find(([s]) => s !== lastSubject) ?? candidates[0];
    const q = pick[1].shift()!;
    result.push(q);
    lastSubject = q.subject;
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

  // SM-2 step
  const rating = isCorrect ? (consecutive >= 3 ? "fácil" : "bien") : "difícil";
  const sm = sm2(
    {
      ease_factor: prev.ease_factor,
      interval_days: prev.interval_days,
      repetitions: prev.repetitions,
    },
    rating,
  );

  let status: ProgressStatus = "in_progress";
  let reinsertSession = false;
  let window: [number, number] = [1, 2];

  if (!isCorrect) {
    status = "in_progress";
    reinsertSession = true;
    window = [2, 3];
  } else if (consecutive >= 3) {
    status = "mastered";
    reinsertSession = false;
  } else {
    status = "in_progress";
    reinsertSession = true;
    window = [3, 6]; // light re-touch later in session
  }

  return {
    status,
    consecutive_correct: consecutive,
    ease_factor: sm.ease_factor,
    interval_days: sm.interval_days,
    repetitions: sm.repetitions,
    due_at: sm.due_at,
    reinsertSession,
    reinsertWindow: window,
  };
}
