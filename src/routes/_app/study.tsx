import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SUBJECTS, type Subject, SubjectIcon } from "@/lib/subjects";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronRight, CheckCircle, XCircle, BookOpen, RotateCcw, Home,
  Target, RefreshCw, Brain,
} from "lucide-react";
import { toast } from "sonner";
import {
  buildRotatedQueue, classifyAnswer, reinsertAhead,
  type ProgressRow, type StudyQuestion,
} from "@/lib/study-engine";
import { sourceLabel } from "@/lib/sources";

type SearchParams = { mode?: "due" | "wrong" | "ids"; ids?: string };

export const Route = createFileRoute("/_app/study")({
  component: StudyPage,
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    mode: (s.mode as SearchParams["mode"]) ?? undefined,
    ids: typeof s.ids === "string" ? s.ids : undefined,
  }),
});

const PAGE = 1000;
async function fetchAllBySubject(subject: Subject): Promise<StudyQuestion[]> {
  const all: StudyQuestion[] = [];
  let from = 0;
  for (let i = 0; i < 10; i++) {
    const { data, error } = await supabase
      .from("questions")
      .select("id, subject, question_text, options, correct_index, explanation, source, reference")
      .eq("subject", subject)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as StudyQuestion[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function fetchByIds(ids: string[]): Promise<StudyQuestion[]> {
  if (ids.length === 0) return [];
  const out: StudyQuestion[] = [];
  // chunk to avoid url-length issues
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data, error } = await supabase
      .from("questions")
      .select("id, subject, question_text, options, correct_index, explanation, source, reference")
      .in("id", chunk);
    if (error) throw error;
    out.push(...((data ?? []) as unknown as StudyQuestion[]));
  }
  return out;
}

interface SessionStats {
  mastered: string[]; // question ids mastered today
  toReview: StudyQuestion[]; // wrong/in-progress to keep in mind
  pendingTomorrow: number;
  answered: number;
  correct: number;
}

function defaultProgress(qid: string): ProgressRow {
  return {
    question_id: qid,
    times_seen: 0, times_correct: 0, times_wrong: 0, consecutive_correct: 0,
    status: "new", ease_factor: 2.5, interval_days: 0, repetitions: 0,
  };
}

function StudyPage() {
  const { user } = useAuth();
  const search = useSearch({ from: "/_app/study" });
  const [phase, setPhase] = useState<"setup" | "running" | "done">("setup");
  const [selected, setSelected] = useState<Subject[]>([...SUBJECTS]);
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState<StudyQuestion[]>([]);
  const [progress, setProgress] = useState<Record<string, ProgressRow>>({});
  const [chosen, setChosen] = useState<number | null>(null);
  const [stats, setStats] = useState<SessionStats>({
    mastered: [], toReview: [], pendingTomorrow: 0, answered: 0, correct: 0,
  });
  const [resumeOffer, setResumeOffer] = useState<{ id: string; ids: string[] } | null>(null);

  const all = selected.length === SUBJECTS.length;
  const toggle = (s: Subject) =>
    setSelected((c) => (c.includes(s) ? c.filter((x) => x !== s) : [...c, s]));
  const toggleAll = () => setSelected(all ? [] : [...SUBJECTS]);

  // Resume offer + auto-start when ?mode=
  useEffect(() => {
    if (!user) return;
    (async () => {
      // Pending session
      const { data } = await supabase
        .from("study_sessions")
        .select("id, pending_question_ids")
        .eq("user_id", user.id)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1);
      const row = data?.[0];
      const ids = (row?.pending_question_ids as string[] | undefined) ?? [];
      if (row && ids.length > 0) setResumeOffer({ id: row.id, ids });

      // Auto start by mode
      if (search.mode === "due") void startDue();
      else if (search.mode === "wrong") void startWrong();
      else if (search.mode === "ids" && search.ids) void startFromIds(search.ids.split(","));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadProgress = async (qids: string[]): Promise<Record<string, ProgressRow>> => {
    if (!user || qids.length === 0) return {};
    const map: Record<string, ProgressRow> = {};
    for (let i = 0; i < qids.length; i += 200) {
      const chunk = qids.slice(i, i + 200);
      const { data } = await supabase
        .from("study_progress")
        .select("question_id, times_seen, times_correct, times_wrong, consecutive_correct, status, ease_factor, interval_days, repetitions")
        .eq("user_id", user.id)
        .in("question_id", chunk);
      for (const r of (data ?? []) as unknown as ProgressRow[]) map[r.question_id] = r;
    }
    return map;
  };

  const beginQueue = async (questions: StudyQuestion[]) => {
    if (questions.length === 0) {
      toast.error("No hay preguntas disponibles");
      return;
    }
    const rotated = buildRotatedQueue(questions);
    const prog = await loadProgress(questions.map((q) => q.id));
    setQueue(rotated);
    setProgress(prog);
    setChosen(null);
    setStats({ mastered: [], toReview: [], pendingTomorrow: 0, answered: 0, correct: 0 });
    // Open a session row
    if (user) {
      await supabase.from("study_sessions").insert({
        user_id: user.id,
        pending_question_ids: rotated.map((q) => q.id),
        subjects: [...new Set(rotated.map((q) => q.subject))],
      });
    }
    setPhase("running");
  };

  const start = async () => {
    if (selected.length === 0) {
      toast.error("Selecciona al menos una materia");
      return;
    }
    setBusy(true);
    try {
      const pools = await Promise.all(selected.map(fetchAllBySubject));
      await beginQueue(pools.flat());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando preguntas");
    } finally {
      setBusy(false);
    }
  };

  const startDue = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { data } = await supabase
        .from("study_progress")
        .select("question_id")
        .eq("user_id", user.id)
        .lte("next_review_at", new Date().toISOString())
        .neq("status", "mastered")
        .limit(200);
      const ids = (data ?? []).map((r) => r.question_id as string);
      if (ids.length === 0) {
        // fall back to fresh questions
        toast.info("Sin pendientes — iniciando con preguntas nuevas");
        const pools = await Promise.all(SUBJECTS.map(fetchAllBySubject));
        const fresh = pools.flat().sort(() => Math.random() - 0.5).slice(0, 30);
        await beginQueue(fresh);
        return;
      }
      const qs = await fetchByIds(ids);
      await beginQueue(qs);
    } finally {
      setBusy(false);
    }
  };

  const startWrong = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { data } = await supabase
        .from("question_answers")
        .select("question_id")
        .eq("user_id", user.id)
        .eq("is_correct", false)
        .order("created_at", { ascending: false })
        .limit(500);
      const ids = [...new Set((data ?? []).map((r) => r.question_id as string))];
      if (ids.length === 0) {
        toast.info("No tienes preguntas falladas todavía");
        setBusy(false);
        return;
      }
      const qs = await fetchByIds(ids);
      await beginQueue(qs);
    } finally {
      setBusy(false);
    }
  };

  const startFromIds = async (ids: string[]) => {
    setBusy(true);
    try {
      const qs = await fetchByIds(ids);
      await beginQueue(qs);
    } finally {
      setBusy(false);
    }
  };

  const continueSession = async () => {
    if (!resumeOffer) return;
    setBusy(true);
    try {
      const qs = await fetchByIds(resumeOffer.ids);
      await beginQueue(qs);
      setResumeOffer(null);
    } finally {
      setBusy(false);
    }
  };

  const current = queue[0];

  const persistProgress = async (q: StudyQuestion, prev: ProgressRow, outcome: ReturnType<typeof classifyAnswer>, isCorrect: boolean) => {
    if (!user) return;
    const row = {
      user_id: user.id,
      question_id: q.id,
      times_seen: prev.times_seen + 1,
      times_correct: prev.times_correct + (isCorrect ? 1 : 0),
      times_wrong: prev.times_wrong + (isCorrect ? 0 : 1),
      consecutive_correct: outcome.consecutive_correct,
      status: outcome.status,
      ease_factor: outcome.ease_factor,
      interval_days: outcome.interval_days,
      repetitions: outcome.repetitions,
      last_seen_at: new Date().toISOString(),
      next_review_at: outcome.due_at.toISOString(),
    };
    await supabase.from("study_progress").upsert(row, { onConflict: "user_id,question_id" });
    await supabase.from("question_answers").insert({
      user_id: user.id, question_id: q.id, subject: q.subject,
      is_correct: isCorrect, source: "study",
    });
    // update progress map
    setProgress((p) => ({ ...p, [q.id]: { ...row, question_id: q.id } as ProgressRow }));
  };

  const answer = async (i: number) => {
    if (chosen !== null || !current) return;
    setChosen(i);
    const ok = i === current.correct_index;
    const prev = progress[current.id] ?? defaultProgress(current.id);
    const outcome = classifyAnswer(prev, ok);
    await persistProgress(current, prev, outcome, ok);

    setStats((s) => ({
      ...s,
      answered: s.answered + 1,
      correct: s.correct + (ok ? 1 : 0),
      mastered: outcome.status === "mastered" && !s.mastered.includes(current.id)
        ? [...s.mastered, current.id] : s.mastered,
      toReview: !ok && !s.toReview.find((q) => q.id === current.id)
        ? [...s.toReview, current]
        : ok && outcome.status === "mastered"
          ? s.toReview.filter((q) => q.id !== current.id)
          : s.toReview,
      pendingTomorrow: outcome.status !== "mastered" ? s.pendingTomorrow + 1 : s.pendingTomorrow,
    }));
  };

  const next = async () => {
    if (!current) return;
    const ok = chosen === current.correct_index;
    const outcome = classifyAnswer(progress[current.id] ?? defaultProgress(current.id), ok);
    let newQueue = queue.slice(1);
    if (outcome.reinsertSession) {
      newQueue = reinsertAhead(newQueue, current, outcome.reinsertWindow[0], outcome.reinsertWindow[1]);
    }
    setQueue(newQueue);
    setChosen(null);

    // update session pending
    if (user) {
      const pending = newQueue.map((q) => q.id);
      const { data } = await supabase
        .from("study_sessions").select("id").eq("user_id", user.id)
        .is("ended_at", null).order("started_at", { ascending: false }).limit(1);
      const id = data?.[0]?.id;
      if (id) await supabase.from("study_sessions").update({
        pending_question_ids: pending, mastered_count: stats.mastered.length, review_count: stats.toReview.length,
      }).eq("id", id);
    }

    if (newQueue.length === 0) await finish();
  };

  const finish = async () => {
    if (user) {
      await supabase.from("study_sessions")
        .update({ ended_at: new Date().toISOString(), pending_question_ids: [] })
        .eq("user_id", user.id).is("ended_at", null);
    }
    setPhase("done");
  };

  // ─── SETUP ──────────
  if (phase === "setup") {
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto pb-24 md:pb-10">
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2 flex items-center gap-2">
          <Brain className="h-7 w-7 text-primary" /> Modo estudio
        </h1>
        <p className="text-muted-foreground mb-6">
          Repaso espaciado con SM-2: las preguntas falladas vuelven en la sesión, las dominadas se programan a futuro.
        </p>

        {resumeOffer && (
          <Card className="p-5 mb-6 border-2 border-primary/40 bg-primary/5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-semibold">Tienes {resumeOffer.ids.length} preguntas pendientes de tu sesión anterior</div>
                <div className="text-xs text-muted-foreground">Continúa donde te quedaste.</div>
              </div>
              <Button onClick={continueSession} disabled={busy}>
                <RefreshCw className="h-4 w-4 mr-1" /> Continuar donde quedé
              </Button>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <Button variant="outline" onClick={startDue} disabled={busy} className="h-auto py-4 flex-col items-start text-left">
            <span className="flex items-center gap-1 font-semibold"><Target className="h-4 w-4" /> Pendientes hoy</span>
            <span className="text-xs text-muted-foreground mt-1">SM-2 due</span>
          </Button>
          <Button variant="outline" onClick={startWrong} disabled={busy} className="h-auto py-4 flex-col items-start text-left">
            <span className="flex items-center gap-1 font-semibold"><XCircle className="h-4 w-4" /> Repasar errores</span>
            <span className="text-xs text-muted-foreground mt-1">Las que has fallado</span>
          </Button>
          <Button variant="outline" onClick={start} disabled={busy} className="h-auto py-4 flex-col items-start text-left">
            <span className="flex items-center gap-1 font-semibold"><BookOpen className="h-4 w-4" /> Sesión libre</span>
            <span className="text-xs text-muted-foreground mt-1">Selecciona materias abajo</span>
          </Button>
        </div>

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
          {busy ? "Cargando…" : "Comenzar sesión libre"}
        </Button>
      </div>
    );
  }

  // ─── RUNNING ──────────
  if (phase === "running" && current) {
    const q = current;
    const prog = progress[q.id];
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto pb-24 md:pb-10">
        <div className="flex items-center justify-between mb-4 text-sm flex-wrap gap-2">
          <div className="text-muted-foreground">{queue.length} en cola · {stats.answered} respondidas</div>
          <div className="flex items-center gap-3">
            <span className="text-success flex items-center gap-1"><CheckCircle className="h-4 w-4" /> {stats.mastered.length}</span>
            <span className="text-warning flex items-center gap-1"><RefreshCw className="h-4 w-4" /> {stats.toReview.length}</span>
            <Button variant="ghost" size="sm" onClick={finish}>Terminar</Button>
          </div>
        </div>
        <Card className="p-6 md:p-8">
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2 flex-wrap">
            <SubjectIcon subject={q.subject} /> {q.subject}
            <span className="ml-2 text-muted-foreground/70">· Fuente: {sourceLabel(q.source)}</span>
            {prog && prog.times_seen > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-secondary text-[10px]">
                Visto {prog.times_seen}× · ✓{prog.times_correct} ✗{prog.times_wrong}
              </span>
            )}
          </div>
          <h2 className="font-display text-xl md:text-2xl font-semibold leading-snug">{q.question_text}</h2>
          <div className="mt-6 space-y-2">
            {q.options.map((opt, i) => {
              const isCorrect = i === q.correct_index;
              const isChosen = chosen === i;
              let cls = "border-border hover:bg-secondary";
              if (chosen !== null) {
                if (isCorrect) cls = "border-success bg-success/10";
                else if (isChosen) cls = "border-destructive bg-destructive/10";
                else cls = "border-border opacity-60";
              }
              return (
                <button key={i} disabled={chosen !== null} onClick={() => answer(i)}
                  className={`w-full text-left rounded-lg border-2 px-4 py-3 transition flex items-start gap-2 ${cls}`}>
                  <span className="font-semibold mr-1">{String.fromCharCode(65 + i)}.</span>
                  <span className="flex-1">{opt}</span>
                  {chosen !== null && isCorrect && <CheckCircle className="h-5 w-5 text-success shrink-0" />}
                  {chosen !== null && isChosen && !isCorrect && <XCircle className="h-5 w-5 text-destructive shrink-0" />}
                </button>
              );
            })}
          </div>

          {chosen !== null && (
            <div className="mt-6 space-y-3">
              <div className="rounded-lg bg-secondary/50 border p-4">
                <div className="text-sm font-semibold mb-1">Explicación</div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{q.explanation || "—"}</p>
                {q.reference && (
                  <p className="mt-2 text-xs text-primary">Fuente: {q.reference}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end mt-6">
            <Button onClick={next} disabled={chosen === null}>
              {queue.length <= 1 ? "Ver resumen" : "Siguiente"} <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ─── DONE ──────────
  return <DoneView stats={stats} onRestart={() => setPhase("setup")} />;
}

function DoneView({ stats, onRestart }: { stats: SessionStats; onRestart: () => void }) {
  const pct = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : 0;
  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto pb-24 md:pb-10">
      <Card className="p-8 text-center mb-6">
        <h1 className="font-display text-3xl font-bold mb-2">Sesión terminada</h1>
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="rounded-lg bg-success/10 p-4">
            <div className="text-3xl font-bold text-success">{stats.mastered.length}</div>
            <div className="text-xs text-muted-foreground">Dominadas</div>
          </div>
          <div className="rounded-lg bg-warning/10 p-4">
            <div className="text-3xl font-bold text-warning">{stats.toReview.length}</div>
            <div className="text-xs text-muted-foreground">A repasar</div>
          </div>
          <div className="rounded-lg bg-primary/10 p-4">
            <div className="text-3xl font-bold text-primary">{pct}%</div>
            <div className="text-xs text-muted-foreground">Aciertos ({stats.correct}/{stats.answered})</div>
          </div>
        </div>
        <div className="flex gap-3 justify-center mt-6 flex-wrap">
          <Button onClick={onRestart}><RotateCcw className="h-4 w-4 mr-1" /> Nueva sesión</Button>
          <Button variant="outline" asChild><Link to="/dashboard"><Home className="h-4 w-4 mr-1" /> Inicio</Link></Button>
        </div>
      </Card>

      {stats.toReview.length > 0 && (
        <Card className="p-6 mb-6">
          <h2 className="font-display text-lg font-bold mb-3">Repasa estas {stats.toReview.length}</h2>
          <div className="space-y-3">
            {stats.toReview.map((q) => (
              <div key={q.id} className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                  <SubjectIcon subject={q.subject} /> {q.subject}
                </div>
                <p className="font-semibold text-sm">{q.question_text}</p>
                <p className="mt-1 text-sm text-success">
                  ✓ {String.fromCharCode(65 + q.correct_index)}. {q.options[q.correct_index]}
                </p>
                {q.explanation && (
                  <p className="mt-1 text-xs text-muted-foreground">{q.explanation}</p>
                )}
                {q.reference && <p className="mt-1 text-xs text-primary">Fuente: {q.reference}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <p className="text-sm text-muted-foreground">
          Hay <strong>{stats.pendingTomorrow}</strong> preguntas programadas para volver según SM-2.
          Vuelve mañana para repasarlas.
        </p>
      </Card>
    </div>
  );
}
