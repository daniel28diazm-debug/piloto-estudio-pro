import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SUBJECTS, type Subject, SubjectIcon } from "@/lib/subjects";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronRight,
  CheckCircle,
  XCircle,
  BookOpen,
  RotateCcw,
  Home,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/study")({
  component: StudyPage,
  validateSearch: (s: Record<string, unknown>) => ({
    started: s.started === true || s.started === "true",
  }),
});

interface QRow {
  id: string;
  subject: Subject;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

const PAGE = 1000;
async function fetchAllBySubject(subject: Subject): Promise<QRow[]> {
  const all: QRow[] = [];
  let from = 0;
  for (let i = 0; i < 10; i++) {
    const { data, error } = await supabase
      .from("questions")
      .select("id, subject, question_text, options, correct_index, explanation")
      .eq("subject", subject)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as QRow[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

function StudyPage() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<"setup" | "running" | "done">("setup");
  const [selected, setSelected] = useState<Subject[]>([...SUBJECTS]);
  const [busy, setBusy] = useState(false);
  const [questions, setQuestions] = useState<QRow[]>([]);
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [stats, setStats] = useState({ correct: 0, wrong: 0 });

  const toggle = (s: Subject) =>
    setSelected((c) => (c.includes(s) ? c.filter((x) => x !== s) : [...c, s]));
  const all = selected.length === SUBJECTS.length;
  const toggleAll = () => setSelected(all ? [] : [...SUBJECTS]);

  const start = async () => {
    if (selected.length === 0) {
      toast.error("Selecciona al menos una materia");
      return;
    }
    setBusy(true);
    try {
      const pools = await Promise.all(selected.map(fetchAllBySubject));
      const merged = pools.flat();
      if (merged.length === 0) {
        toast.error("No hay preguntas en las materias seleccionadas");
        return;
      }
      const shuffled = [...merged].sort(() => Math.random() - 0.5);
      setQuestions(shuffled);
      setIdx(0);
      setChosen(null);
      setStats({ correct: 0, wrong: 0 });
      setPhase("running");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando preguntas");
    } finally {
      setBusy(false);
    }
  };

  const answer = async (i: number) => {
    if (chosen !== null) return;
    setChosen(i);
    const q = questions[idx];
    const ok = i === q.correct_index;
    setStats((s) => (ok ? { ...s, correct: s.correct + 1 } : { ...s, wrong: s.wrong + 1 }));
    if (user) {
      await supabase.from("question_answers").insert({
        user_id: user.id,
        question_id: q.id,
        subject: q.subject,
        is_correct: ok,
        source: "study",
      });
    }
  };

  const next = () => {
    if (idx + 1 >= questions.length) {
      setPhase("done");
      return;
    }
    setIdx((i) => i + 1);
    setChosen(null);
  };

  if (phase === "setup") {
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto pb-24 md:pb-10">
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2 flex items-center gap-2">
          <BookOpen className="h-7 w-7 text-primary" /> Modo estudio libre
        </h1>
        <p className="text-muted-foreground mb-6">
          Sin cronómetro, sin calificación. Aprende a tu ritmo con feedback inmediato y explicación.
        </p>
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold">Materias</h2>
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {all ? "Quitar todas" : "Todas las materias"}
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SUBJECTS.map((s) => (
              <label key={s} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-secondary transition">
                <Checkbox checked={selected.includes(s)} onCheckedChange={() => toggle(s)} />
                <span className="text-sm flex items-center gap-2"><SubjectIcon subject={s} /> {s}</span>
              </label>
            ))}
          </div>
        </Card>
        <Button size="lg" className="w-full" onClick={start} disabled={busy}>
          {busy ? "Cargando…" : "Comenzar estudio"}
        </Button>
      </div>
    );
  }

  if (phase === "running") {
    const q = questions[idx];
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto pb-24 md:pb-10">
        <div className="flex items-center justify-between mb-4 text-sm">
          <div className="text-muted-foreground">Pregunta {idx + 1} de {questions.length}</div>
          <div className="flex items-center gap-3">
            <span className="text-success flex items-center gap-1"><CheckCircle className="h-4 w-4" /> {stats.correct}</span>
            <span className="text-destructive flex items-center gap-1"><XCircle className="h-4 w-4" /> {stats.wrong}</span>
            <Button variant="ghost" size="sm" onClick={() => setPhase("done")}>Terminar</Button>
          </div>
        </div>
        <Card className="p-6 md:p-8">
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2"><SubjectIcon subject={q.subject} /> {q.subject}</div>
          <h2 className="font-display text-xl md:text-2xl font-semibold leading-snug">{q.question_text}</h2>
          <div className="mt-6 space-y-2">
            {q.options.map((opt, i) => {
              const isCorrect = i === q.correct_index;
              const isChosen = chosen === i;
              let cls = "border-border hover:bg-secondary";
              if (chosen !== null) {
                if (isCorrect) cls = "border-success bg-success/10 text-success-foreground";
                else if (isChosen) cls = "border-destructive bg-destructive/10";
                else cls = "border-border opacity-60";
              }
              return (
                <button
                  key={i}
                  disabled={chosen !== null}
                  onClick={() => answer(i)}
                  className={`w-full text-left rounded-lg border-2 px-4 py-3 transition flex items-start gap-2 ${cls}`}
                >
                  <span className="font-semibold mr-1">{String.fromCharCode(65 + i)}.</span>
                  <span className="flex-1">{opt}</span>
                  {chosen !== null && isCorrect && <CheckCircle className="h-5 w-5 text-success shrink-0" />}
                  {chosen !== null && isChosen && !isCorrect && <XCircle className="h-5 w-5 text-destructive shrink-0" />}
                </button>
              );
            })}
          </div>

          {chosen !== null && (
            <div className="mt-6 rounded-lg bg-secondary/50 border p-4">
              <div className="text-sm font-semibold mb-1">Explicación</div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{q.explanation || "—"}</p>
            </div>
          )}

          <div className="flex justify-end mt-6">
            <Button onClick={next} disabled={chosen === null}>
              {idx + 1 >= questions.length ? "Ver resumen" : "Siguiente pregunta"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // done
  const total = stats.correct + stats.wrong;
  const pct = total ? Math.round((stats.correct / total) * 100) : 0;
  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto pb-24 md:pb-10">
      <Card className="p-8 text-center">
        <h1 className="font-display text-3xl font-bold mb-2">Sesión terminada</h1>
        <p className="text-muted-foreground mb-6">Buen trabajo. Sigue practicando a tu ritmo.</p>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-lg bg-success/10 p-4">
            <div className="text-3xl font-bold text-success">{stats.correct}</div>
            <div className="text-xs text-muted-foreground">Correctas</div>
          </div>
          <div className="rounded-lg bg-destructive/10 p-4">
            <div className="text-3xl font-bold text-destructive">{stats.wrong}</div>
            <div className="text-xs text-muted-foreground">Incorrectas</div>
          </div>
          <div className="rounded-lg bg-primary/10 p-4">
            <div className="text-3xl font-bold text-primary">{pct}%</div>
            <div className="text-xs text-muted-foreground">Aciertos</div>
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => setPhase("setup")}><RotateCcw className="h-4 w-4 mr-1" /> Nueva sesión</Button>
          <Button variant="outline" asChild><Link to="/dashboard"><Home className="h-4 w-4 mr-1" /> Inicio</Link></Button>
        </div>
      </Card>
    </div>
  );
}
