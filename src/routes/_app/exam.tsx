import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SUBJECTS, type Subject, SUBJECT_ICONS } from "@/lib/subjects";
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

function ExamPage() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedSubjects, setSelectedSubjects] = useState<Subject[]>(SUBJECTS as unknown as Subject[]);
  const [count, setCount] = useState<20 | 40 | 60>(20);
  const [minutes, setMinutes] = useState(30);

  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [idx, setIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const startTime = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [results, setResults] = useState<{ score: number; correct: number; timeUsed: number } | null>(null);

  const toggleSubject = (s: Subject) => {
    setSelectedSubjects((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  };

  const startExam = async () => {
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
      toast.error("No hay preguntas en las materias seleccionadas. Genera algunas desde la biblioteca.");
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

    setResults({ score, correct: correctCount, timeUsed });

    // Persist
    if (user) {
      await supabase.from("exam_attempts").insert({
        user_id: user.id,
        subjects: selectedSubjects,
        total_questions: questions.length,
        correct_count: correctCount,
        score_pct: score,
        time_used_seconds: timeUsed,
        time_limit_seconds: minutes * 60,
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
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // ─── Setup ─────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto pb-24 md:pb-10">
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Simulador de examen</h1>
        <p className="text-muted-foreground mb-8">Configura tu examen estilo CIAAC.</p>

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
          <div className="grid grid-cols-3 gap-3">
            {([20, 40, 60] as const).map((n) => (
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
            max={180}
            value={minutes}
            onChange={(e) => setMinutes(Math.max(5, Math.min(180, Number(e.target.value) || 30)))}
            className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Card>

        <Button size="lg" className="w-full" onClick={startExam}>
          <Timer className="h-4 w-4 mr-2" />
          Comenzar examen
        </Button>
      </div>
    );
  }

  // ─── Running ───────────────────────────────────────────
  if (phase === "running") {
    const q = questions[idx];
    const lowTime = secondsLeft < 60;
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
  return <ResultsView results={results!} questions={questions} answers={answers} onRestart={() => setPhase("setup")} />;
}

function ResultsView({
  results,
  questions,
  answers,
  onRestart,
}: {
  results: { score: number; correct: number; timeUsed: number };
  questions: QuestionRow[];
  answers: (number | null)[];
  onRestart: () => void;
}) {
  const wrong = useMemo(
    () => questions.map((q, i) => ({ q, i })).filter(({ q, i }) => answers[i] !== q.correct_index),
    [questions, answers],
  );
  const passed = results.score >= 70;
  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto pb-24 md:pb-10">
      <Card className={`p-8 text-center ${passed ? "bg-gradient-sky" : ""}`}>
        <Award className={`h-16 w-16 mx-auto mb-4 ${passed ? "text-success" : "text-warning"}`} />
        <div className="font-display text-6xl font-bold">{Math.round(results.score)}%</div>
        <p className="mt-2 text-muted-foreground">
          {results.correct} / {questions.length} correctas · {Math.floor(results.timeUsed / 60)}m {results.timeUsed % 60}s
        </p>
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
            {wrong.map(({ q, i }) => (
              <Card key={q.id} className="p-5">
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
          </div>
        </div>
      )}
    </div>
  );
}
