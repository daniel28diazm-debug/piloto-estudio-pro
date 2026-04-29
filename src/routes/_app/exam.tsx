import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SUBJECTS, type Subject, SUBJECT_ICONS } from "@/lib/subjects";
import {
  CIAAC_EXAM_TOTAL_QUESTIONS,
  CIAAC_EXAM_TIME_MINUTES,
  CIAAC_EXAM_PASS_PCT,
  CIAAC_EXAM_DISTRIBUTION,
} from "@/lib/phak";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Timer, ChevronRight, Award, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/exam")({
  component: ExamPage,
});

interface QuestionRow {
  id: string;
  subject: Subject;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

type Phase = "setup" | "running" | "results";
type Mode = "ciaac" | "custom";

function ExamPage() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("setup");
  const [mode, setMode] = useState<Mode>("ciaac");
  const [selectedSubjects, setSelectedSubjects] = useState<Subject[]>(SUBJECTS as unknown as Subject[]);
  const [count, setCount] = useState<number>(40);
  const [minutes, setMinutes] = useState(60);

  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [idx, setIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const startTime = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [results, setResults] = useState<{ score: number; correct: number; timeUsed: number; subjects: Subject[]; total: number } | null>(null);

  const toggleSubject = (s: Subject) => {
    setSelectedSubjects((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  };

  const startExam = async () => {
    if (mode === "ciaac") {
      await startCiaacExam();
    } else {
      await startCustomExam();
    }
  };

  const startCiaacExam = async () => {
    // Pull questions weighted by official CIAAC distribution.
    const allSubjects = Object.keys(CIAAC_EXAM_DISTRIBUTION) as Subject[];
    const collected: QuestionRow[] = [];

    for (const subject of allSubjects) {
      const target = CIAAC_EXAM_DISTRIBUTION[subject];
      const { data, error } = await supabase
        .from("questions")
        .select("id, subject, question_text, options, correct_index, explanation")
        .eq("subject", subject)
        .limit(1000);
      if (error) {
        toast.error(error.message);
        return;
      }
      const pool = (data ?? []) as QuestionRow[];
      const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, target);
      collected.push(...shuffled);
    }

    if (collected.length < 50) {
      toast.error("Aún no hay suficientes preguntas en el banco. Espera a que termine la carga inicial.");
      return;
    }
    if (collected.length < CIAAC_EXAM_TOTAL_QUESTIONS) {
      toast.warning(
        `El banco tiene ${collected.length} preguntas disponibles (faltan ${CIAAC_EXAM_TOTAL_QUESTIONS - collected.length} para llegar a 405).`,
      );
    }

    const finalQuestions = collected.sort(() => Math.random() - 0.5);
    setQuestions(finalQuestions);
    setAnswers(new Array(finalQuestions.length).fill(null));
    setIdx(0);
    setSecondsLeft(CIAAC_EXAM_TIME_MINUTES * 60);
    startTime.current = Date.now();
    setPhase("running");
  };

  const startCustomExam = async () => {
    if (selectedSubjects.length === 0) {
      toast.error("Selecciona al menos una materia");
      return;
    }
    const { data, error } = await supabase
      .from("questions")
      .select("id, subject, question_text, options, correct_index, explanation")
      .in("subject", selectedSubjects);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data || data.length === 0) {
      toast.error("No hay preguntas en las materias seleccionadas.");
      return;
    }
    const shuffled = [...(data as QuestionRow[])].sort(() => Math.random() - 0.5).slice(0, count);
    setQuestions(shuffled);
    setAnswers(new Array(shuffled.length).fill(null));
    setIdx(0);
    setSecondsLeft(minutes * 60);
    startTime.current = Date.now();
    setPhase("running");
  };

  useEffect(() => {
    if (phase !== "running") return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          finish();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const finish = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const correctCount = questions.reduce(
      (acc, q, i) => acc + (answers[i] === q.correct_index ? 1 : 0),
      0,
    );
    const score = (correctCount / questions.length) * 100;
    const timeUsed = Math.round((Date.now() - startTime.current) / 1000);
    const subjectsUsed = Array.from(new Set(questions.map((q) => q.subject)));
    const timeLimitSeconds = mode === "ciaac" ? CIAAC_EXAM_TIME_MINUTES * 60 : minutes * 60;

    setResults({ score, correct: correctCount, timeUsed, subjects: subjectsUsed, total: questions.length });

    if (user) {
      await supabase.from("exam_attempts").insert({
        user_id: user.id,
        subjects: subjectsUsed,
        total_questions: questions.length,
        correct_count: correctCount,
        score_pct: score,
        time_used_seconds: timeUsed,
        time_limit_seconds: timeLimitSeconds,
        details: questions.map((q, i) => ({
          question_id: q.id,
          chosen: answers[i],
          correct: q.correct_index,
        })),
      });
      await supabase.from("question_answers").insert(
        questions.map((q, i) => ({
          user_id: user.id,
          question_id: q.id,
          subject: q.subject,
          is_correct: answers[i] === q.correct_index,
          source: "exam",
        })),
      );
    }
    setPhase("results");
  };

  const fmtTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // ─── Setup ─────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto pb-24 md:pb-10">
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Simulador de examen</h1>
        <p className="text-muted-foreground mb-8">Modo CIAAC oficial o examen personalizado.</p>

        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => setMode("ciaac")}
            className={`text-left rounded-2xl border-2 p-5 transition ${
              mode === "ciaac" ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"
            }`}
          >
            <div className="flex items-center gap-2 font-display font-bold text-lg">
              <Award className="h-5 w-5 text-accent" /> CIAAC oficial
            </div>
            <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
              <div>· {CIAAC_EXAM_TOTAL_QUESTIONS} preguntas</div>
              <div>· {CIAAC_EXAM_TIME_MINUTES} minutos ({Math.floor(CIAAC_EXAM_TIME_MINUTES / 60)}h {CIAAC_EXAM_TIME_MINUTES % 60}m)</div>
              <div>· Mínimo aprobatorio: {CIAAC_EXAM_PASS_PCT.toFixed(2)}%</div>
              <div>· Distribución oficial por materia</div>
            </div>
          </button>
          <button
            onClick={() => setMode("custom")}
            className={`text-left rounded-2xl border-2 p-5 transition ${
              mode === "custom" ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"
            }`}
          >
            <div className="flex items-center gap-2 font-display font-bold text-lg">
              <Timer className="h-5 w-5" /> Personalizado
            </div>
            <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
              <div>· Tú eliges materias</div>
              <div>· 20 / 40 / 60 / 100 preguntas</div>
              <div>· Tiempo configurable</div>
              <div>· Práctica enfocada</div>
            </div>
          </button>
        </div>

        {mode === "ciaac" ? (
          <Card className="p-6 mb-6">
            <h2 className="font-display font-semibold mb-3">Distribución del examen oficial</h2>
            <div className="space-y-2">
              {(Object.entries(CIAAC_EXAM_DISTRIBUTION) as [Subject, number][])
                .sort((a, b) => b[1] - a[1])
                .map(([s, n]) => (
                  <div key={s} className="flex items-center justify-between text-sm">
                    <span>{SUBJECT_ICONS[s]} {s}</span>
                    <span className="font-semibold">{n} preguntas</span>
                  </div>
                ))}
              <div className="flex items-center justify-between text-sm pt-2 border-t font-bold">
                <span>Total</span>
                <span>{CIAAC_EXAM_TOTAL_QUESTIONS} preguntas</span>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-warning/10 border border-warning/30 p-3 text-xs text-warning-foreground">
              ⚠️ Mínimo aprobatorio: <strong>80.00%</strong> exacto. 79.99% reprueba.
            </div>
          </Card>
        ) : (
          <>
            <Card className="p-6 mb-6">
              <h2 className="font-display font-semibold mb-3">Materias</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUBJECTS.map((s) => (
                  <label key={s} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-secondary transition">
                    <Checkbox
                      checked={selectedSubjects.includes(s)}
                      onCheckedChange={() => toggleSubject(s)}
                    />
                    <span className="text-sm">
                      {SUBJECT_ICONS[s]} {s}
                    </span>
                  </label>
                ))}
              </div>
            </Card>

            <Card className="p-6 mb-6">
              <h2 className="font-display font-semibold mb-3">Número de preguntas</h2>
              <div className="grid grid-cols-4 gap-3">
                {([20, 40, 60, 100] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={`rounded-lg border-2 p-4 font-display font-bold text-2xl transition ${
                      count === n ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-6 mb-6">
              <Label htmlFor="mins" className="font-semibold">Tiempo límite (minutos)</Label>
              <input
                id="mins"
                type="number"
                min={5}
                max={360}
                value={minutes}
                onChange={(e) => setMinutes(Math.max(5, Math.min(360, Number(e.target.value) || 30)))}
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Card>
          </>
        )}

        <Button size="lg" className="w-full" onClick={startExam}>
          <Timer className="h-4 w-4 mr-2" />
          {mode === "ciaac" ? "Comenzar examen CIAAC" : "Comenzar examen personalizado"}
        </Button>
      </div>
    );
  }

  // ─── Running ───────────────────────────────────────────
  if (phase === "running") {
    const q = questions[idx];
    const lowTime = secondsLeft < 600; // <10 min
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto pb-24 md:pb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium text-muted-foreground">
            Pregunta {idx + 1} / {questions.length}
          </div>
          <div className={`font-display font-bold text-lg flex items-center gap-2 ${lowTime ? "text-destructive animate-pulse" : ""}`}>
            <Timer className="h-4 w-4" /> {fmtTime(secondsLeft)}
          </div>
        </div>
        <div className="h-1.5 bg-secondary rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-gradient-runway transition-all"
            style={{ width: `${((idx + 1) / questions.length) * 100}%` }}
          />
        </div>

        <Card className="p-6 md:p-8">
          <div className="text-xs text-muted-foreground mb-2">{SUBJECT_ICONS[q.subject]} {q.subject}</div>
          <h2 className="font-display text-xl md:text-2xl font-semibold leading-snug">{q.question_text}</h2>

          <div className="mt-6 space-y-2">
            {q.options.map((opt, i) => {
              const selected = answers[idx] === i;
              return (
                <button
                  key={i}
                  onClick={() =>
                    setAnswers((a) => {
                      const next = [...a];
                      next[idx] = i;
                      return next;
                    })
                  }
                  className={`w-full text-left rounded-lg border-2 px-4 py-3 transition ${
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  <span className="font-semibold mr-2">{String.fromCharCode(65 + i)}.</span> {opt}
                </button>
              );
            })}
          </div>

          <div className="flex justify-between mt-6">
            <Button variant="outline" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
              Anterior
            </Button>
            {idx < questions.length - 1 ? (
              <Button onClick={() => setIdx((i) => i + 1)}>
                Siguiente <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={finish} className="bg-success text-success-foreground hover:bg-success/90">
                Terminar examen
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // ─── Results ───────────────────────────────────────────
  return (
    <ResultsView
      results={results!}
      questions={questions}
      answers={answers}
      mode={mode}
      onRestart={() => setPhase("setup")}
    />
  );
}

function ResultsView({
  results,
  questions,
  answers,
  mode,
  onRestart,
}: {
  results: { score: number; correct: number; timeUsed: number; total: number };
  questions: QuestionRow[];
  answers: (number | null)[];
  mode: Mode;
  onRestart: () => void;
}) {
  const wrong = useMemo(
    () => questions.map((q, i) => ({ q, i })).filter(({ q, i }) => answers[i] !== q.correct_index),
    [questions, answers],
  );
  // Strict 80.00% rule for CIAAC mode (79.99 reprueba)
  const passThreshold = mode === "ciaac" ? CIAAC_EXAM_PASS_PCT : 70;
  const passed = results.score >= passThreshold;

  const h = Math.floor(results.timeUsed / 3600);
  const m = Math.floor((results.timeUsed % 3600) / 60);
  const s = results.timeUsed % 60;
  const timeFmt = h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto pb-24 md:pb-10">
      <Card className={`p-8 text-center ${passed ? "bg-gradient-sky" : ""}`}>
        <Award className={`h-16 w-16 mx-auto mb-4 ${passed ? "text-success" : "text-warning"}`} />
        <div className="font-display text-6xl font-bold">{results.score.toFixed(2)}%</div>
        <p className="mt-2 text-muted-foreground">
          {results.correct} / {results.total} correctas · {timeFmt}
        </p>
        <div className={`mt-3 inline-block px-4 py-1 rounded-full text-sm font-bold ${
          passed ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
        }`}>
          {passed ? "✓ APROBADO" : `✗ REPROBADO (mínimo ${passThreshold.toFixed(2)}%)`}
        </div>
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <Button onClick={onRestart}>
            <RotateCcw className="h-4 w-4 mr-2" /> Otro examen
          </Button>
          <Link to="/progress">
            <Button variant="outline">Ver progreso</Button>
          </Link>
        </div>
      </Card>

      {wrong.length > 0 && (
        <div className="mt-8">
          <h2 className="font-display text-xl font-bold mb-4">Repasa tus errores ({wrong.length})</h2>
          <div className="space-y-4">
            {wrong.slice(0, 50).map(({ q, i }) => (
              <Card key={q.id} className="p-5">
                <div className="text-xs text-muted-foreground mb-1">{SUBJECT_ICONS[q.subject]} {q.subject}</div>
                <p className="font-semibold">{q.question_text}</p>
                <div className="mt-3 text-sm space-y-1">
                  {answers[i] !== null && (
                    <p className="text-destructive">
                      ✗ Tu respuesta: {String.fromCharCode(65 + (answers[i] as number))}. {q.options[answers[i] as number]}
                    </p>
                  )}
                  <p className="text-success">
                    ✓ Correcta: {String.fromCharCode(65 + q.correct_index)}. {q.options[q.correct_index]}
                  </p>
                </div>
                <p className="mt-3 text-sm text-muted-foreground border-l-2 border-primary pl-3">
                  {q.explanation}
                </p>
              </Card>
            ))}
            {wrong.length > 50 && (
              <p className="text-center text-sm text-muted-foreground">
                Mostrando los primeros 50 de {wrong.length} errores.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
