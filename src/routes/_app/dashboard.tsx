import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SUBJECTS, SubjectIcon } from "@/lib/subjects";
import {
  BookOpen, Layers, Timer, Sparkles, Plane, GraduationCap,
  Target, XCircle, MessagesSquare, Upload, Zap, Calendar, Award, Brain,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function firstName(full?: string | null, email?: string | null): string {
  const raw = (full || email?.split("@")[0] || "Piloto").trim();
  const first = raw.split(/\s+/)[0].toLowerCase();
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    documents: 0, questions: 0, dueToday: 0, lastScore: null as number | null,
    studyDue: 0, pendingSession: 0, mastered: 0, seen: 0, unseen: 0,
  });
  const [recentSubjects, setRecentSubjects] = useState<{ subject: string; count: number }[]>([]);
  const [examDate, setExamDate] = useState<string>("");
  const [savingDate, setSavingDate] = useState(false);

  const loadAll = async () => {
    if (!user) return;
    const now = new Date().toISOString();
    const [docs, qs, due, lastExam, studyDue, pending, mastered, seenCount, settings] = await Promise.all([
      supabase.from("documents").select("id", { count: "exact", head: true }),
      supabase.from("questions").select("id", { count: "exact", head: true }),
      supabase.from("flashcard_reviews").select("id", { count: "exact", head: true })
        .lte("due_at", now).not("last_reviewed_at", "is", null),
      supabase.from("exam_attempts").select("score_pct").order("created_at", { ascending: false }).limit(1),
      // SM-2 due today: only questions ALREADY seen whose next_review_at has arrived
      supabase.from("study_progress").select("id", { count: "exact", head: true })
        .eq("user_id", user.id).lte("next_review_at", now)
        .neq("status", "mastered").gt("times_seen", 0),
      supabase.from("study_sessions").select("pending_question_ids").is("ended_at", null)
        .order("started_at", { ascending: false }).limit(1),
      supabase.from("study_progress").select("id", { count: "exact", head: true })
        .eq("user_id", user.id).eq("status", "mastered"),
      supabase.from("study_progress").select("id", { count: "exact", head: true })
        .eq("user_id", user.id).gt("times_seen", 0),
      supabase.from("app_settings").select("value").eq("key", "exam_date").maybeSingle(),
    ]);

    const pendIds = (pending.data?.[0]?.pending_question_ids as string[] | undefined) ?? [];
    // Real interrupted session: user actually progressed (queue shrunk below the 50 cap)
    const realPending = pendIds.length > 0 && pendIds.length < 50 ? pendIds.length : 0;
    const totalQ = qs.count ?? 0;
    const seen = seenCount.count ?? 0;

    setStats({
      documents: docs.count ?? 0,
      questions: totalQ,
      dueToday: due.count ?? 0,
      lastScore: lastExam.data?.[0]?.score_pct ?? null,
      studyDue: studyDue.count ?? 0,
      pendingSession: realPending,
      mastered: mastered.count ?? 0,
      seen,
      unseen: Math.max(0, totalQ - seen),
    });
    setExamDate(settings.data?.value ?? "");

    const counts = await Promise.all(
      SUBJECTS.map(async (s) => {
        const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("subject", s);
        return { subject: s, count: count ?? 0 };
      }),
    );
    setRecentSubjects(counts);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  const saveExamDate = async () => {
    if (!user) return;
    setSavingDate(true);
    try {
      const { data: existing } = await supabase.from("app_settings").select("id")
        .eq("key", "exam_date").maybeSingle();
      if (existing) {
        await supabase.from("app_settings").update({ value: examDate, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("app_settings").insert({ user_id: user.id, key: "exam_date", value: examDate });
      }
      toast.success("Fecha guardada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSavingDate(false);
    }
  };

  const daysToExam = (() => {
    if (!examDate) return null;
    const target = new Date(examDate + "T00:00:00");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / 86400000);
  })();

  const seenPct = stats.questions > 0 ? Math.min(100, (stats.seen / stats.questions) * 100) : 0;
  const masteredPct = stats.questions > 0 ? Math.min(100, (stats.mastered / stats.questions) * 100) : 0;

  return (
    <div className="pb-24 md:pb-10">
      {/* iOS gradient hero header */}
      <div className="ios-hero text-white px-6 md:px-10 pt-8 pb-10 md:pb-12">
        <div className="max-w-6xl mx-auto">
          <p className="text-sm text-white/70">¡Listo para volar!</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-2 mt-1">
            Hola, {firstName(user?.user_metadata?.full_name, user?.email)}
            <Plane className="h-7 w-7 text-[#3B82F6]" />
          </h1>
          {daysToExam !== null && (
            <div className="mt-5 font-display">
              {daysToExam > 0 ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-white/80 text-sm">Faltan</span>
                  <span className="text-5xl md:text-6xl font-bold text-[#3B82F6] leading-none">{daysToExam}</span>
                  <span className="text-white/80 text-sm">días para tu examen CIAAC</span>
                </div>
              ) : daysToExam === 0 ? (
                <div className="text-3xl font-bold text-[#FF9F0A]">¡Hoy es el día!</div>
              ) : (
                <div className="text-white/70">Examen pasado hace {Math.abs(daysToExam)} días</div>
              )}
            </div>
          )}
          <div className="mt-5 max-w-md">
            <div className="flex items-center justify-between text-xs text-white/70 mb-1.5">
              <span>Preguntas vistas</span>
              <span className="font-semibold text-white">{stats.seen} / {stats.questions} ({seenPct.toFixed(1)}%)</span>
            </div>
            <div className="h-2 rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${seenPct}%`,
                  background: "linear-gradient(90deg, #3B82F6, #60a5fa)",
                }}
              />
            </div>
            <div className="mt-1.5 text-[11px] text-white/60">
              {stats.mastered} dominadas · {stats.unseen.toLocaleString("es-MX")} sin explorar
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 md:px-10 max-w-6xl mx-auto -mt-6">
        {/* Exam date card */}
        <div className="ios-card p-5 mb-6">
          <div className="flex items-center gap-2 text-sm font-semibold mb-3">
            <Calendar className="h-4 w-4 text-primary" /> Fecha de mi examen CIAAC
          </div>
          <div className="flex gap-2">
            <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="flex-1 rounded-xl" />
            <Button onClick={saveExamDate} disabled={savingDate || !examDate} className="rounded-xl">Guardar</Button>
          </div>
        </div>

        {/* Resume banner — only when user actually interrupted a real session */}
        {stats.pendingSession > 0 && (
          <Link to="/study" className="block mb-6 ios-card ios-card-hover p-4 border-l-4 border-l-[#3B82F6]">
            <div className="font-semibold">Continuar sesión interrumpida</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Te quedan {stats.pendingSession} preguntas de tu última sesión →
            </div>
          </Link>
        )}

        {/* Quick actions — iOS app-grid style */}
        <h2 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
          <Zap className="h-5 w-5 text-[#FF9F0A]" /> Acciones rápidas
        </h2>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mb-8">
          <QuickAction to="/study" search={{ mode: "due" as const }} icon={<Target className="h-6 w-6" />} label="Estudiar ahora" badge={stats.studyDue} color="#3B82F6" />
          <QuickAction to="/exam" icon={<Timer className="h-6 w-6" />} label="Simulacro" color="#5856D6" />
          <QuickAction to="/study" search={{ mode: "wrong" as const }} icon={<XCircle className="h-6 w-6" />} label="Repasar errores" color="#FF3B30" />
          <QuickAction to="/flashcards" icon={<Layers className="h-6 w-6" />} label="Flashcards" badge={stats.dueToday} color="#34C759" />
          <QuickAction to="/library" icon={<Upload className="h-6 w-6" />} label="Biblioteca" color="#FF9F0A" />
          <QuickAction to="/tutor" icon={<MessagesSquare className="h-6 w-6" />} label="Tutor IA" color="#AF52DE" />
        </div>

        {/* Stat cards — iOS clean number style */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard icon={<Sparkles className="h-5 w-5" />} label="Preguntas en banco" value={stats.questions.toLocaleString("es-MX")} to="/library" />
          <StatCard
            icon={<Brain className="h-5 w-5" />}
            label="Sin explorar"
            sublabel="Nunca las has respondido"
            value={stats.unseen.toLocaleString("es-MX")}
            to="/study"
          />
          <StatCard icon={<Award className="h-5 w-5" />} label="Dominadas" value={stats.mastered.toLocaleString("es-MX")} to="/progress" />
          <StatCard icon={<Timer className="h-5 w-5" />} label="Último examen" value={stats.lastScore !== null ? `${Math.round(stats.lastScore)}%` : "—"} to="/exam" />
        </div>

        {/* Featured */}
        <div className="grid gap-6 lg:grid-cols-3 mb-10">
          <Link to="/study" className="lg:col-span-2 rounded-2xl ios-hero text-white p-8 relative overflow-hidden group ios-smooth hover:scale-[1.01]"
                style={{ boxShadow: "0 8px 24px rgba(10,22,40,0.25)" }}>
            <GraduationCap className="absolute -right-6 -bottom-6 h-40 w-40 text-white/10 group-hover:rotate-6 transition-transform" />
            <h3 className="font-display text-2xl font-bold">Modo estudio inteligente</h3>
            <p className="mt-2 text-white/80 max-w-md">
              Repaso espaciado SM-2: las preguntas falladas vuelven, las dominadas se programan al futuro.
            </p>
            <span className="mt-4 inline-block text-sm font-semibold underline-offset-4 group-hover:underline">Empezar →</span>
          </Link>

          <Link to="/tutor" className="ios-card ios-card-hover p-8">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#AF52DE]/15 text-[#AF52DE] mb-4">
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
                className="ios-card ios-card-hover p-4">
                <div className="text-primary"><SubjectIcon subject={s} className="h-6 w-6" /></div>
                <div className="mt-2 text-sm font-semibold leading-tight">{s}</div>
                <div className="mt-1 text-xs text-muted-foreground">{count} preguntas</div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  to, search, icon, label, badge, color,
}: {
  to: string; search?: Record<string, string>; icon: React.ReactNode; label: string; badge?: number; color?: string;
}) {
  return (
    <Link to={to as "/study"} search={search as never}
      className="relative ios-card ios-pop p-4 flex flex-col items-center text-center gap-2 group">
      <div className="grid h-12 w-12 place-items-center rounded-2xl text-white shadow-md"
           style={{ background: color ? `linear-gradient(135deg, ${color}, ${color}cc)` : "var(--color-primary)" }}>
        {icon}
      </div>
      <span className="text-xs font-semibold leading-tight">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="ios-badge absolute top-2 right-2">{badge > 99 ? "99+" : badge}</span>
      )}
    </Link>
  );
}

function StatCard({
  icon, label, value, to, highlight, sublabel,
}: {
  icon: React.ReactNode; label: string; value: string | number;
  to: "/library" | "/flashcards" | "/exam" | "/tutor" | "/progress" | "/study";
  highlight?: boolean;
  sublabel?: string;
}) {
  return (
    <Link to={to} className={`ios-card ios-card-hover p-5 block ${highlight ? "ring-2 ring-[#FF9F0A]/50" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-secondary-foreground">{icon}</div>
        {highlight && <span className="ios-badge">¡Hoy!</span>}
      </div>
      <div className="mt-3 font-display text-3xl font-bold tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      {sublabel && <div className="text-[11px] text-muted-foreground/70 mt-0.5">{sublabel}</div>}
    </Link>
  );
}
