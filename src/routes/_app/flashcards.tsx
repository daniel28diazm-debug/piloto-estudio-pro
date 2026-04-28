import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { sm2, type Rating } from "@/lib/sm2";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SUBJECT_ICONS, type Subject } from "@/lib/subjects";
import { Layers, CheckCircle2, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_app/flashcards")({
  component: Flashcards,
});

interface DueCard {
  review_id: string;
  question_id: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  question: {
    question_text: string;
    options: string[];
    correct_index: number;
    explanation: string;
    subject: Subject;
  };
}

function Flashcards() {
  const { user } = useAuth();
  const [queue, setQueue] = useState<DueCard[]>([]);
  const [showBack, setShowBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewedCount, setReviewedCount] = useState(0);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("flashcard_reviews")
      .select("id, question_id, ease_factor, interval_days, repetitions, questions(question_text, options, correct_index, explanation, subject)")
      .lte("due_at", now)
      .order("due_at")
      .limit(50);

    const cards: DueCard[] = (data ?? [])
      .filter((r) => r.questions)
      .map((r) => ({
        review_id: r.id,
        question_id: r.question_id,
        ease_factor: r.ease_factor,
        interval_days: r.interval_days,
        repetitions: r.repetitions,
        question: r.questions as DueCard["question"],
      }));
    setQueue(cards);
    setShowBack(false);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const current = queue[0];

  const rate = async (rating: Rating) => {
    if (!current) return;
    const next = sm2(
      {
        ease_factor: current.ease_factor,
        interval_days: current.interval_days,
        repetitions: current.repetitions,
      },
      rating,
    );

    await supabase
      .from("flashcard_reviews")
      .update({
        ease_factor: next.ease_factor,
        interval_days: next.interval_days,
        repetitions: next.repetitions,
        due_at: next.due_at.toISOString(),
        last_rating: rating,
        last_reviewed_at: new Date().toISOString(),
      })
      .eq("id", current.review_id);

    // log answer
    await supabase.from("question_answers").insert({
      user_id: user!.id,
      question_id: current.question_id,
      subject: current.question.subject,
      is_correct: rating !== "difícil",
      source: "flashcard",
    });

    setReviewedCount((c) => c + 1);
    setQueue((q) => q.slice(1));
    setShowBack(false);
  };

  if (loading) {
    return <div className="p-10 text-center text-muted-foreground">Cargando…</div>;
  }

  if (!current) {
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto pb-24 md:pb-10">
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Flashcards</h1>
        <Card className="mt-8 p-12 text-center bg-gradient-sky">
          <CheckCircle2 className="h-16 w-16 text-success mx-auto mb-4" />
          <h2 className="font-display text-2xl font-bold">¡Sin tarjetas pendientes!</h2>
          <p className="mt-2 text-muted-foreground">
            {reviewedCount > 0
              ? `Repasaste ${reviewedCount} tarjetas hoy. Excelente trabajo.`
              : "Genera preguntas desde un PDF para empezar."}
          </p>
          <div className="mt-6 flex gap-3 justify-center">
            <Link to="/library">
              <Button>Ir a la biblioteca</Button>
            </Link>
            {reviewedCount > 0 && (
              <Button variant="outline" onClick={load}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Recargar
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto pb-24 md:pb-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" /> Flashcards
          </h1>
          <p className="text-sm text-muted-foreground">{queue.length} pendientes · {reviewedCount} hoy</p>
        </div>
        <div className="text-xs text-muted-foreground">
          {SUBJECT_ICONS[current.question.subject]} {current.question.subject}
        </div>
      </div>

      <Card className="p-8 min-h-[400px] flex flex-col shadow-elevated">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Pregunta</div>
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
            </div>
          </div>
        )}

        <div className="mt-auto pt-6">
          {!showBack ? (
            <Button onClick={() => setShowBack(true)} className="w-full" size="lg">
              Mostrar respuesta
            </Button>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <Button onClick={() => rate("difícil")} variant="destructive">
                Difícil
              </Button>
              <Button onClick={() => rate("bien")} variant="secondary">
                Bien
              </Button>
              <Button onClick={() => rate("fácil")} className="bg-success text-success-foreground hover:bg-success/90">
                Fácil
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
