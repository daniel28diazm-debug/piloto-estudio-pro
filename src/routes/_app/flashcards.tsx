import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { sm2, type Rating } from "@/lib/sm2";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SUBJECTS, type Subject, SubjectIcon } from "@/lib/subjects";
import { SOURCE_TABS, type SourceKey, sourceLabel } from "@/lib/sources";
import { Layers, CheckCircle2, RotateCcw, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/flashcards")({
  component: Flashcards,
});

interface DueCard {
  review_id: string;
  question_id: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  due_at: string;
  question: {
    question_text: string;
    options: string[];
    correct_index: number;
    explanation: string;
    subject: Subject;
    source: string | null;
    reference: string | null;
  };
}

type StatusFilter = "due" | "all" | "mastered";

function Flashcards() {
  const { user } = useAuth();
  const [allCards, setAllCards] = useState<DueCard[]>([]);
  const [showBack, setShowBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [seeding, setSeeding] = useState(false);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("due");
  const [subjectFilter, setSubjectFilter] = useState<Subject | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<SourceKey>("all");
  const [idx, setIdx] = useState(0);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const all: DueCard[] = [];
    let from = 0;
    for (let i = 0; i < 10; i++) {
      const { data } = await supabase
        .from("flashcard_reviews")
        .select("id, question_id, ease_factor, interval_days, repetitions, due_at, questions(question_text, options, correct_index, explanation, subject, source, reference)")
        .order("due_at")
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      for (const r of data) {
        if (!r.questions) continue;
        all.push({
          review_id: r.id, question_id: r.question_id,
          ease_factor: r.ease_factor, interval_days: r.interval_days,
          repetitions: r.repetitions, due_at: r.due_at,
          question: r.questions as DueCard["question"],
        });
      }
      if (data.length < 1000) break;
      from += 1000;
    }
    setAllCards(all);
    setIdx(0);
    setShowBack(false);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const filtered = useMemo(() => {
    const now = new Date();
    return allCards.filter((c) => {
      if (subjectFilter !== "all" && c.question.subject !== subjectFilter) return false;
      const tabDef = SOURCE_TABS.find((t) => t.key === sourceFilter);
      if (tabDef?.match && !(c.question.source && tabDef.match.includes(c.question.source))) return false;
      if (statusFilter === "due") return new Date(c.due_at) <= now && c.repetitions < 5;
      if (statusFilter === "mastered") return c.repetitions >= 5;
      return true;
    });
  }, [allCards, subjectFilter, sourceFilter, statusFilter]);

  const dueCount = useMemo(() => {
    const now = new Date();
    return allCards.filter((c) => new Date(c.due_at) <= now && c.repetitions < 5).length;
  }, [allCards]);

  const seedFlashcards = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      // Get all questions for the user, paginated
      const qids: string[] = [];
      let from = 0;
      for (let i = 0; i < 20; i++) {
        const { data } = await supabase.from("questions").select("id").range(from, from + 999);
        if (!data || data.length === 0) break;
        qids.push(...data.map((d) => d.id as string));
        if (data.length < 1000) break;
        from += 1000;
      }
      // Get already-existing flashcards
      const have = new Set<string>();
      let f = 0;
      for (let i = 0; i < 20; i++) {
        const { data } = await supabase.from("flashcard_reviews").select("question_id").range(f, f + 999);
        if (!data || data.length === 0) break;
        for (const r of data) have.add(r.question_id as string);
        if (data.length < 1000) break;
        f += 1000;
      }
      const missing = qids.filter((id) => !have.has(id));
      if (missing.length === 0) {
        toast.info("Ya tienes flashcards para todas tus preguntas");
        return;
      }
      // Insert in chunks
      for (let i = 0; i < missing.length; i += 500) {
        const chunk = missing.slice(i, i + 500);
        await supabase.from("flashcard_reviews").insert(
          chunk.map((qid) => ({ user_id: user.id, question_id: qid })),
        );
      }
      toast.success(`${missing.length} flashcards creadas`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error generando flashcards");
    } finally {
      setSeeding(false);
    }
  };

  const current = filtered[idx];

  const rate = async (rating: Rating) => {
    if (!current) return;
    const next = sm2(
      { ease_factor: current.ease_factor, interval_days: current.interval_days, repetitions: current.repetitions },
      rating,
    );
    await supabase.from("flashcard_reviews").update({
      ease_factor: next.ease_factor,
      interval_days: next.interval_days,
      repetitions: next.repetitions,
      due_at: next.due_at.toISOString(),
      last_rating: rating,
      last_reviewed_at: new Date().toISOString(),
    }).eq("id", current.review_id);

    await supabase.from("question_answers").insert({
      user_id: user!.id, question_id: current.question_id,
      subject: current.question.subject, is_correct: rating !== "difícil", source: "flashcard",
    });

    setReviewedCount((c) => c + 1);
    setIdx((i) => i + 1);
    setShowBack(false);
  };

  if (loading) return <div className="p-10 text-center text-muted-foreground">Cargando…</div>;

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto pb-24 md:pb-10">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" /> Flashcards
          </h1>
          <p className="text-sm text-muted-foreground">
            {dueCount} pendientes hoy · {reviewedCount} revisadas
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={seedFlashcards} disabled={seeding}>
          {seeding ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
          Generar de mis preguntas
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-3 mb-4 flex flex-wrap gap-2 items-center">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setIdx(0); }}
          className="text-xs rounded border bg-background px-2 py-1">
          <option value="due">Pendientes hoy</option>
          <option value="all">Todas</option>
          <option value="mastered">Dominadas</option>
        </select>
        <select value={subjectFilter} onChange={(e) => { setSubjectFilter(e.target.value as Subject | "all"); setIdx(0); }}
          className="text-xs rounded border bg-background px-2 py-1">
          <option value="all">Todas las materias</option>
          {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value as SourceKey); setIdx(0); }}
          className="text-xs rounded border bg-background px-2 py-1">
          {SOURCE_TABS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} resultado{filtered.length === 1 ? "" : "s"}</span>
      </Card>

      {!current ? (
        <Card className="p-12 text-center bg-gradient-sky">
          <CheckCircle2 className="h-16 w-16 text-success mx-auto mb-4" />
          <h2 className="font-display text-2xl font-bold">¡Sin tarjetas en esta vista!</h2>
          <p className="mt-2 text-muted-foreground">
            {allCards.length === 0
              ? "Crea flashcards a partir de tu banco de preguntas."
              : "Cambia los filtros para ver más tarjetas."}
          </p>
          <div className="mt-6 flex gap-3 justify-center">
            <Link to="/library"><Button variant="outline">Ir a la biblioteca</Button></Link>
            {reviewedCount > 0 && <Button variant="outline" onClick={load}><RotateCcw className="h-4 w-4 mr-2" />Recargar</Button>}
          </div>
        </Card>
      ) : (
        <Card className="p-8 min-h-[400px] flex flex-col shadow-elevated">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
            <span><SubjectIcon subject={current.question.subject} /> {current.question.subject}</span>
            <span className="px-1.5 py-0.5 rounded bg-secondary">{sourceLabel(current.question.source)}</span>
          </div>
          <p className="font-display text-xl md:text-2xl font-semibold leading-snug">
            {current.question.question_text}
          </p>

          {!showBack && (
            <ul className="mt-6 space-y-2">
              {current.question.options.map((opt, i) => (
                <li key={i} className="rounded-lg border bg-secondary/40 px-4 py-2.5 text-sm">
                  <span className="font-semibold mr-2">{String.fromCharCode(65 + i)}.</span> {opt}
                </li>
              ))}
            </ul>
          )}

          {showBack && (
            <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="rounded-lg bg-success/10 border border-success/30 p-4">
                <div className="text-xs font-semibold text-success uppercase mb-1">Respuesta correcta</div>
                <p className="font-semibold">
                  {String.fromCharCode(65 + current.question.correct_index)}. {current.question.options[current.question.correct_index]}
                </p>
              </div>
              <div className="rounded-lg bg-secondary p-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Explicación</div>
                <p className="text-sm leading-relaxed">{current.question.explanation}</p>
                {current.question.reference && (
                  <p className="mt-2 text-xs text-primary">Fuente: {current.question.reference}</p>
                )}
              </div>
            </div>
          )}

          <div className="mt-auto pt-6">
            {!showBack ? (
              <Button onClick={() => setShowBack(true)} className="w-full" size="lg">Mostrar respuesta</Button>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <Button onClick={() => rate("difícil")} variant="destructive">Difícil</Button>
                <Button onClick={() => rate("bien")} variant="secondary">Bien</Button>
                <Button onClick={() => rate("fácil")} className="bg-success text-success-foreground hover:bg-success/90">Fácil</Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
