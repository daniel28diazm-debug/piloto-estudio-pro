import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SUBJECTS, SubjectIcon } from "@/lib/subjects";
import {
  BookOpen, Layers, Timer, Sparkles, Plane, GraduationCap,
  Target, XCircle, MessagesSquare, Upload, Zap,
} from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    documents: 0, questions: 0, dueToday: 0, lastScore: null as number | null,
    studyDue: 0, pendingSession: 0,
  });
  const [recentSubjects, setRecentSubjects] = useState<{ subject: string; count: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const now = new Date().toISOString();
      const [docs, qs, due, lastExam, studyDue, pending] = await Promise.all([
        supabase.from("documents").select("id", { count: "exact", head: true }),
        supabase.from("questions").select("id", { count: "exact", head: true }),
        supabase.from("flashcard_reviews").select("id", { count: "exact", head: true }).lte("due_at", now),
        supabase.from("exam_attempts").select("score_pct").order("created_at", { ascending: false }).limit(1),
        supabase.from("study_progress").select("id", { count: "exact", head: true })
          .lte("next_review_at", now).neq("status", "mastered"),
        supabase.from("study_sessions").select("pending_question_ids").is("ended_at", null)
          .order("started_at", { ascending: false }).limit(1),
      ]);

      setStats({
        documents: docs.count ?? 0,
        questions: qs.count ?? 0,
        dueToday: due.count ?? 0,
        lastScore: lastExam.data?.[0]?.score_pct ?? null,
        studyDue: studyDue.count ?? 0,
        pendingSession: ((pending.data?.[0]?.pending_question_ids as string[] | undefined) ?? []).length,
      });

      const counts = await Promise.all(
        SUBJECTS.map(async (s) => {
          const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("subject", s);
          return { subject: s, count: count ?? 0 };
        }),
      );
      setRecentSubjects(counts);
    })();
  }, [user]);

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto pb-24 md:pb-10">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">¡Listo para volar!</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-2">
          Hola, {user?.user_metadata?.full_name || "Piloto"} <Plane className="h-7 w-7 text-primary" />
        </h1>
      </div>

      {/* Resume banner */}
      {stats.pendingSession > 0 && (
        <Link to="/study" className="block mb-6 rounded-xl border-2 border-primary/40 bg-primary/5 p-4 hover:bg-primary/10 transition">
          <div className="font-semibold">Tienes {stats.pendingSession} preguntas pendientes de tu sesión anterior</div>
          <div className="text-xs text-muted-foreground">Continuar donde quedé →</div>
        </Link>
      )}

      {/* Quick actions */}
      <h2 className="font-display text-lg font-bold mb-3 flex items-center gap-2"><Zap className="h-5 w-5 text-accent" /> Acciones rápidas</h2>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mb-8">
        <QuickAction to="/study" search={{ mode: "due" as const }} icon={<Target className="h-5 w-5" />} label="Estudiar ahora" badge={stats.studyDue} />
        <QuickAction to="/exam" icon={<Timer className="h-5 w-5" />} label="Simulacro rápido" />
        <QuickAction to="/study" search={{ mode: "wrong" as const }} icon={<XCircle className="h-5 w-5" />} label="Repasar errores" />
        <QuickAction to="/flashcards" icon={<Layers className="h-5 w-5" />} label="Flashcards hoy" badge={stats.dueToday} />
        <QuickAction to="/library" icon={<Upload className="h-5 w-5" />} label="Subir PDF" />
        <QuickAction to="/tutor" icon={<MessagesSquare className="h-5 w-5" />} label="Tutor IA" />
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard icon={<BookOpen className="h-5 w-5" />} label="Documentos" value={stats.documents} to="/library" />
        <StatCard icon={<Sparkles className="h-5 w-5" />} label="Preguntas en banco" value={stats.questions} to="/library" />
        <StatCard icon={<Layers className="h-5 w-5" />} label="Cards para hoy" value={stats.dueToday} highlight={stats.dueToday > 0} to="/flashcards" />
        <StatCard icon={<Timer className="h-5 w-5" />} label="Último examen" value={stats.lastScore !== null ? `${Math.round(stats.lastScore)}%` : "—"} to="/exam" />
      </div>

      {/* Featured */}
      <div className="grid gap-6 lg:grid-cols-3 mb-10">
        <Link to="/study" className="lg:col-span-2 rounded-2xl bg-gradient-hero text-primary-foreground p-8 shadow-elevated relative overflow-hidden group">
          <GraduationCap className="absolute -right-6 -bottom-6 h-40 w-40 text-white/10 group-hover:rotate-6 transition-transform" />
          <h3 className="font-display text-2xl font-bold">Modo estudio inteligente</h3>
          <p className="mt-2 text-primary-foreground/80 max-w-md">
            Repaso espaciado SM-2: las preguntas falladas vuelven, las dominadas se programan al futuro.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold underline-offset-4 group-hover:underline">Empezar →</span>
        </Link>

        <Link to="/tutor" className="rounded-2xl bg-card border p-8 shadow-card hover:shadow-elevated transition">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/20 text-accent-foreground mb-4">
            <Sparkles className="h-5 w-5" />
          </div>
          <h3 className="font-display text-xl font-bold">Pregunta al tutor IA</h3>
          <p className="mt-2 text-sm text-muted-foreground">Resuelve dudas sobre RAB, ICAO o procedimientos IFR.</p>
        </Link>
      </div>

      <h2 className="font-display text-xl font-bold mb-4">Materias</h2>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {SUBJECTS.map((s) => {
          const count = recentSubjects.find((r) => r.subject === s)?.count ?? 0;
          return (
            <Link key={s} to="/library/$subject" params={{ subject: encodeURIComponent(s) }}
              className="rounded-xl border bg-card p-4 hover:shadow-card transition">
              <div className="text-primary"><SubjectIcon subject={s} className="h-6 w-6" /></div>
              <div className="mt-2 text-sm font-semibold leading-tight">{s}</div>
              <div className="mt-1 text-xs text-muted-foreground">{count} preguntas</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function QuickAction({
  to, search, icon, label, badge,
}: {
  to: string; search?: Record<string, string>; icon: React.ReactNode; label: string; badge?: number;
}) {
  return (
    <Link to={to as "/study"} search={search as never} className="relative rounded-xl border bg-card p-3 hover:shadow-card transition flex flex-col items-start gap-2">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</div>
      <span className="text-xs font-semibold leading-tight">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute top-2 right-2 min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">
          {badge}
        </span>
      )}
    </Link>
  );
}

function StatCard({
  icon, label, value, to, highlight,
}: {
  icon: React.ReactNode; label: string; value: string | number;
  to: "/library" | "/flashcards" | "/exam" | "/tutor" | "/progress" | "/study";
  highlight?: boolean;
}) {
  return (
    <Link to={to} className={`rounded-2xl border bg-card p-5 shadow-card hover:shadow-elevated transition ${highlight ? "ring-2 ring-accent" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-secondary-foreground">{icon}</div>
        {highlight && <span className="text-xs font-medium text-accent-foreground bg-accent/30 px-2 py-0.5 rounded">¡Hoy!</span>}
      </div>
      <div className="mt-3 font-display text-3xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Link>
  );
}
