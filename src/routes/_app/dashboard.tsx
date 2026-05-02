import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SUBJECTS, SUBJECT_ICONS } from "@/lib/subjects";
import { BookOpen, Layers, Timer, Sparkles, Plane } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    documents: 0,
    questions: 0,
    dueToday: 0,
    lastScore: null as number | null,
  });
  const [recentSubjects, setRecentSubjects] = useState<{ subject: string; count: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [docs, qs, due, lastExam] = await Promise.all([
        supabase.from("documents").select("id", { count: "exact", head: true }),
        supabase.from("questions").select("id", { count: "exact", head: true }),
        supabase
          .from("flashcard_reviews")
          .select("id", { count: "exact", head: true })
          .lte("due_at", new Date().toISOString()),
        supabase
          .from("exam_attempts")
          .select("score_pct")
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      setStats({
        documents: docs.count ?? 0,
        questions: qs.count ?? 0,
        dueToday: due.count ?? 0,
        lastScore: lastExam.data?.[0]?.score_pct ?? null,
      });

      // Per-subject counts via head+exact (accurate, bypasses 1000-row limit).
      const counts = await Promise.all(
        SUBJECTS.map(async (s) => {
          const { count } = await supabase
            .from("questions")
            .select("id", { count: "exact", head: true })
            .eq("subject", s);
          return { subject: s, count: count ?? 0 };
        }),
      );
      setRecentSubjects(counts);
    })();
  }, [user]);

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto pb-24 md:pb-10">
      <div className="mb-8">
        <p className="text-sm text-muted-foreground">¡Listo para volar!</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
          Hola, {user?.user_metadata?.full_name || "Piloto"} ✈️
        </h1>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          icon={<BookOpen className="h-5 w-5" />}
          label="Documentos"
          value={stats.documents}
          to="/library"
        />
        <StatCard
          icon={<Sparkles className="h-5 w-5" />}
          label="Preguntas creadas"
          value={stats.questions}
          to="/library"
        />
        <StatCard
          icon={<Layers className="h-5 w-5" />}
          label="Cards para hoy"
          value={stats.dueToday}
          highlight={stats.dueToday > 0}
          to="/flashcards"
        />
        <StatCard
          icon={<Timer className="h-5 w-5" />}
          label="Último examen"
          value={stats.lastScore !== null ? `${Math.round(stats.lastScore)}%` : "—"}
          to="/exam"
        />
      </div>

      {/* Quick start */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Link
          to="/library"
          className="lg:col-span-2 rounded-2xl bg-gradient-hero text-primary-foreground p-8 shadow-elevated relative overflow-hidden group"
        >
          <Plane className="absolute -right-6 -bottom-6 h-40 w-40 text-white/10 group-hover:rotate-12 transition-transform" />
          <h3 className="font-display text-2xl font-bold">Sube tus apuntes</h3>
          <p className="mt-2 text-primary-foreground/80 max-w-md">
            Sube un PDF y la IA generará 20 preguntas estilo CIAAC al instante.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold underline-offset-4 group-hover:underline">
            Ir a la biblioteca →
          </span>
        </Link>

        <Link to="/tutor" className="rounded-2xl bg-card border p-8 shadow-card hover:shadow-elevated transition">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/20 text-accent-foreground mb-4">
            <Sparkles className="h-5 w-5" />
          </div>
          <h3 className="font-display text-xl font-bold">Pregunta al tutor IA</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Resuelve dudas sobre RAB, ICAO o procedimientos IFR.
          </p>
        </Link>
      </div>

      {/* Subjects overview */}
      <h2 className="font-display text-xl font-bold mt-10 mb-4">Materias</h2>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {SUBJECTS.map((s) => {
          const count = recentSubjects.find((r) => r.subject === s)?.count ?? 0;
          return (
            <Link
              key={s}
              to="/library"
              className="rounded-xl border bg-card p-4 hover:shadow-card transition"
            >
              <div className="text-2xl">{SUBJECT_ICONS[s]}</div>
              <div className="mt-2 text-sm font-semibold leading-tight">{s}</div>
              <div className="mt-1 text-xs text-muted-foreground">{count} preguntas</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  to,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  to: "/library" | "/flashcards" | "/exam" | "/tutor" | "/progress";
  highlight?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`rounded-2xl border bg-card p-5 shadow-card hover:shadow-elevated transition ${
        highlight ? "ring-2 ring-accent" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-secondary-foreground">
          {icon}
        </div>
        {highlight && <span className="text-xs font-medium text-accent-foreground bg-accent/30 px-2 py-0.5 rounded">¡Hoy!</span>}
      </div>
      <div className="mt-3 font-display text-3xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Link>
  );
}
