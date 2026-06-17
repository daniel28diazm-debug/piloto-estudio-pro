import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SUBJECTS, type Subject, SubjectIcon } from "@/lib/subjects";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ReferenceLine, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar,
} from "recharts";
import {
  Flame, AlertTriangle, Trophy, CalendarClock, Clock, Target, BookOpen,
  CheckCircle2, ChevronUp, ChevronDown, Brain,
} from "lucide-react";

export const Route = createFileRoute("/_app/progress")({
  component: ProgressPage,
});

interface Answer { question_id: string; subject: string; is_correct: boolean; created_at: string; }
interface SessionRow { id: string; started_at: string; ended_at: string | null; subjects: string[] | unknown; }
interface ExamRow { score_pct: number; created_at: string; subjects?: string[] | unknown; total_questions?: number; passed?: boolean; }
interface ProgRow { question_id: string; status: string; subject?: string; }

interface SubjectStat {
  subject: Subject;
  total: number;       // total in bank
  seen: number;        // answered at least once
  correct: number;     // total correct
  wrong: number;
  pct: number;
  mastered: number;
  unseen: number;
}

function ProgressPage() {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [progRows, setProgRows] = useState<ProgRow[]>([]);
  const [bankBySubject, setBankBySubject] = useState<Record<string, number>>({});
  const [hardQuestions, setHardQuestions] = useState<{ id: string; text: string; subject: Subject; wrong: number }[]>([]);
  const [sortCol, setSortCol] = useState<keyof SubjectStat>("pct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    if (!user) return;
    (async () => {
      // answers (paginate)
      const all: Answer[] = [];
      let from = 0;
      for (let i = 0; i < 20; i++) {
        const { data } = await supabase
          .from("question_answers")
          .select("question_id, subject, is_correct, created_at")
          .eq("user_id", user.id)
          .range(from, from + 999);
        if (!data || data.length === 0) break;
        all.push(...(data as Answer[]));
        if (data.length < 1000) break;
        from += 1000;
      }
      setAnswers(all);

      const { data: sess } = await supabase
        .from("study_sessions")
        .select("id, started_at, ended_at, subjects")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(30);
      setSessions((sess ?? []) as SessionRow[]);

      const { data: ex } = await supabase
        .from("exam_attempts")
        .select("score_pct, created_at, subjects, total_questions")
        .order("created_at");
      setExams((ex ?? []) as unknown as ExamRow[]);

      // progress rows
      const pr: ProgRow[] = [];
      let pf = 0;
      for (let i = 0; i < 20; i++) {
        const { data } = await supabase
          .from("study_progress")
          .select("question_id, status")
          .eq("user_id", user.id)
          .range(pf, pf + 999);
        if (!data || data.length === 0) break;
        pr.push(...(data as ProgRow[]));
        if (data.length < 1000) break;
        pf += 1000;
      }
      setProgRows(pr);

      // bank counts by subject
      const counts: Record<string, number> = {};
      for (const s of SUBJECTS) {
        const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("subject", s);
        counts[s] = count ?? 0;
      }
      setBankBySubject(counts);

      // Hard questions: top 10 by wrong count (from answers)
      const wrongMap = new Map<string, { wrong: number; subject: string }>();
      for (const a of all) {
        if (a.is_correct) continue;
        const e = wrongMap.get(a.question_id) ?? { wrong: 0, subject: a.subject };
        e.wrong++;
        wrongMap.set(a.question_id, e);
      }
      const topIds = [...wrongMap.entries()].sort((a, b) => b[1].wrong - a[1].wrong).slice(0, 10);
      if (topIds.length) {
        const { data } = await supabase
          .from("questions").select("id, question_text, subject")
          .in("id", topIds.map(([id]) => id));
        const byId = new Map((data ?? []).map((q) => [q.id, q]));
        setHardQuestions(
          topIds
            .filter(([id]) => byId.has(id))
            .map(([id, v]) => {
              const q = byId.get(id)!;
              return { id, text: q.question_text as string, subject: q.subject as Subject, wrong: v.wrong };
            }),
        );
      }
    })();
  }, [user]);

  // Subject stats
  const subjectStats: SubjectStat[] = useMemo(() => {
    return SUBJECTS.map((s) => {
      const subset = answers.filter((a) => a.subject === s);
      const correct = subset.filter((a) => a.is_correct).length;
      const total = bankBySubject[s] ?? 0;
      const seenIds = new Set(subset.map((a) => a.question_id));
      const mastered = progRows.filter((p) => p.status === "mastered" && seenIds.has(p.question_id)).length;
      return {
        subject: s,
        total,
        seen: seenIds.size,
        correct,
        wrong: subset.length - correct,
        pct: subset.length ? (correct / subset.length) * 100 : 0,
        mastered,
        unseen: Math.max(0, total - seenIds.size),
      };
    });
  }, [answers, bankBySubject, progRows]);

  // Global totals
  const totalBank = Object.values(bankBySubject).reduce((a, b) => a + b, 0);
  const totalAnswered = answers.length;
  const totalCorrect = answers.filter((a) => a.is_correct).length;
  const globalPct = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const totalSeen = new Set(answers.map((a) => a.question_id)).size;
  const totalMastered = progRows.filter((p) => p.status === "mastered").length;
  const totalUnseen = totalBank - totalSeen;

  // Time studied (hours)
  const totalMinutes = sessions.reduce((acc, s) => {
    if (!s.ended_at) return acc;
    const dur = (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000;
    return acc + Math.max(0, Math.min(dur, 180)); // cap 3h per session
  }, 0);

  // Streak: current + longest
  const dayKeys = useMemo(() => new Set(answers.map((a) => new Date(a.created_at).toISOString().slice(0, 10))), [answers]);
  const { current: streak, longest } = useMemo(() => {
    let cur = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      if (dayKeys.has(k)) cur++;
      else if (i === 0) continue;
      else break;
    }
    // longest
    const sorted = [...dayKeys].sort();
    let lng = 0, run = 0, prev: Date | null = null;
    for (const k of sorted) {
      const d = new Date(k + "T00:00");
      if (prev) {
        const diff = (d.getTime() - prev.getTime()) / 86400000;
        if (diff === 1) run++; else run = 1;
      } else run = 1;
      lng = Math.max(lng, run);
      prev = d;
    }
    return { current: cur, longest: lng };
  }, [dayKeys]);

  // This week vs last week
  const now = new Date();
  const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
  const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(now.getDate() - 14);
  const thisWeek = answers.filter((a) => new Date(a.created_at) >= weekAgo).length;
  const lastWeek = answers.filter((a) => {
    const d = new Date(a.created_at); return d >= twoWeeksAgo && d < weekAgo;
  }).length;

  // Exam history points
  const examHistory = exams.map((e) => ({
    date: new Date(e.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" }),
    score: Math.round(e.score_pct),
    passed: e.score_pct >= 80,
  }));
  const recentExams = exams.slice(-3);
  const avgExam = recentExams.length ? recentExams.reduce((a, e) => a + e.score_pct, 0) / recentExams.length : 0;
  const examAvgAll = exams.length ? exams.reduce((a, e) => a + e.score_pct, 0) / exams.length : 0;

  // Session history (last 10 with answers)
  const sessionStats = useMemo(() => {
    return sessions.slice(0, 10).map((s) => {
      const start = new Date(s.started_at).getTime();
      const end = s.ended_at ? new Date(s.ended_at).getTime() : start;
      const subset = answers.filter((a) => {
        const t = new Date(a.created_at).getTime();
        return t >= start && t <= (end || Date.now());
      });
      const cor = subset.filter((a) => a.is_correct).length;
      const mins = end > start ? Math.round((end - start) / 60000) : 0;
      return {
        date: new Date(s.started_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" }),
        answered: subset.length,
        correct: cor,
        pct: subset.length ? Math.round((cor / subset.length) * 100) : 0,
        mins,
      };
    });
  }, [sessions, answers]);

  // Calendar this month
  const monthDays = (() => {
    const year = now.getFullYear(); const month = now.getMonth();
    const last = new Date(year, month + 1, 0).getDate();
    const arr: { day: number; studied: boolean }[] = [];
    for (let d = 1; d <= last; d++) {
      const k = new Date(year, month, d).toISOString().slice(0, 10);
      arr.push({ day: d, studied: dayKeys.has(k) });
    }
    return arr;
  })();

  // Radar data: dominio = correctas / vistas * 100 (per subject)
  const radarData = subjectStats.map((s) => ({
    subject: s.subject.split(" ")[0],
    fullName: s.subject,
    dominio: s.seen > 0 ? Math.round((s.correct / Math.max(1, s.correct + s.wrong)) * 100) : 0,
    correct: s.correct,
    answered: s.correct + s.wrong,
    meta: 80,
  }));

  const sorted = useMemo(() => {
    const arr = [...subjectStats];
    arr.sort((a, b) => {
      const x = a[sortCol], y = b[sortCol];
      const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [subjectStats, sortCol, sortDir]);

  const sortBy = (c: keyof SubjectStat) => {
    if (sortCol === c) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(c); setSortDir("desc"); }
  };

  const stateLabel = (pct: number) => pct >= 80
    ? { label: "Fuerte", cls: "bg-success/20 text-success" }
    : pct >= 50
      ? { label: "Progreso", cls: "bg-warning/20 text-warning" }
      : { label: "Reforzar", cls: "bg-destructive/20 text-destructive" };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto pb-24 md:pb-10">
      <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Tu progreso</h1>
      <p className="text-muted-foreground mb-8">Identifica fortalezas y áreas de mejora.</p>

      {/* Summary stats */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
        {[
          { l: "En banco", v: totalBank.toLocaleString("es-MX"), i: BookOpen },
          { l: "Vistas", v: `${totalSeen} (${totalBank ? Math.round(totalSeen / totalBank * 100) : 0}%)`, i: Target },
          { l: "Dominadas", v: `${totalMastered} (${totalBank ? Math.round(totalMastered / totalBank * 100) : 0}%)`, i: CheckCircle2 },
          { l: "Sin ver", v: totalUnseen, i: Brain },
          { l: "Respuestas", v: totalAnswered.toLocaleString("es-MX"), i: Target },
          { l: "Horas estudiadas", v: (totalMinutes / 60).toFixed(1), i: Clock },
          { l: "Aciertos global", v: `${globalPct}%`, i: Trophy },
          { l: "Simulacros", v: `${exams.length} · prom ${Math.round(examAvgAll)}%`, i: CalendarClock },
        ].map((s) => (
          <Card key={s.l} className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase mb-1">
              <s.i className="h-3.5 w-3.5" /> {s.l}
            </div>
            <div className="font-display text-lg font-bold">{s.v}</div>
          </Card>
        ))}
      </div>

      {/* Streak & week */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-8">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase mb-1">
            <Flame className="h-3.5 w-3.5" /> Racha actual
          </div>
          <div className="font-display text-2xl font-bold">{streak} {streak === 1 ? "día" : "días"}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase mb-1">
            <Flame className="h-3.5 w-3.5" /> Racha más larga
          </div>
          <div className="font-display text-2xl font-bold">{longest} {longest === 1 ? "día" : "días"}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase mb-1">Esta semana</div>
          <div className="font-display text-2xl font-bold">{thisWeek}</div>
          <div className="text-xs text-muted-foreground">prev: {lastWeek}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase mb-1">Prom. últimos 3 sim.</div>
          <div className={`font-display text-2xl font-bold ${avgExam >= 80 ? "text-success" : "text-warning"}`}>
            {avgExam ? `${avgExam.toFixed(0)}%` : "—"}
          </div>
        </Card>
      </div>

      {/* Calendar */}
      <Card className="p-5 mb-8">
        <h2 className="font-display font-bold mb-3">Días estudiados este mes</h2>
        <div className="grid grid-cols-7 gap-1.5 max-w-md">
          {monthDays.map((d) => (
            <div key={d.day}
              className={`aspect-square rounded text-[10px] flex items-center justify-center font-medium ${
                d.studied ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}>{d.day}</div>
          ))}
        </div>
      </Card>

      {/* Radar — big, dynamic, with 80% meta */}
      <Card className="p-6 mb-8" style={{ background: "#F8F9FA" }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-display font-bold">Dominio por materia</h2>
          <span className="text-xs text-muted-foreground">% aciertos por materia · meta 80%</span>
        </div>
        <div className="w-full h-[320px] md:h-[450px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius="78%">
              <defs>
                <linearGradient id="radarFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 13, fill: "#111827" }} />
              <PolarRadiusAxis domain={[0, 100]} ticks={[25, 50, 75, 100]} tick={{ fontSize: 10, fill: "#6b7280" }} />
              <Radar name="Meta 80%" dataKey="meta" stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} fill="transparent" dot={false} isAnimationActive={false} />
              <Radar name="Dominio" dataKey="dominio" stroke="#3B82F6" strokeWidth={2} fill="url(#radarFill)" dot={{ r: 4, fill: "#3B82F6", stroke: "#fff", strokeWidth: 1 }} />
              <Tooltip
                formatter={((v: unknown, name: unknown, item: unknown) => {
                  if (name === "Meta 80%") return ["80%", "Meta"];
                  const p = (item as { payload: { fullName: string; correct: number; answered: number } }).payload;
                  return [`${v}% (${p.correct}/${p.answered} correctas)`, p.fullName];
                }) as never}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Detailed table */}
      <Card className="p-5 mb-8 overflow-x-auto">
        <h2 className="font-display font-bold mb-3">Detalle por materia</h2>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase border-b">
            <tr>
              {([
                ["subject", "Materia"], ["total", "Total"], ["seen", "Vistas"],
                ["pct", "% Aciertos"], ["mastered", "Dominadas"], ["unseen", "Sin ver"],
              ] as [keyof SubjectStat, string][]).map(([k, l]) => (
                <th key={k} className="text-left py-2 px-2 cursor-pointer select-none" onClick={() => sortBy(k)}>
                  <span className="inline-flex items-center gap-1">
                    {l} {sortCol === k && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </span>
                </th>
              ))}
              <th className="text-left py-2 px-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => {
              const st = stateLabel(s.pct);
              return (
                <tr key={s.subject} className="border-b last:border-0">
                  <td className="py-2 px-2 flex items-center gap-2">
                    <SubjectIcon subject={s.subject} /> <span className="font-medium">{s.subject}</span>
                  </td>
                  <td className="py-2 px-2">{s.total}</td>
                  <td className="py-2 px-2">{s.seen}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-secondary rounded-full h-1.5 min-w-[60px]">
                        <div className={`h-full rounded-full ${s.pct >= 80 ? "bg-success" : s.pct >= 50 ? "bg-warning" : "bg-destructive"}`}
                          style={{ width: `${s.pct}%` }} />
                      </div>
                      <span className="text-xs tabular-nums w-10">{Math.round(s.pct)}%</span>
                    </div>
                  </td>
                  <td className="py-2 px-2">{s.mastered}</td>
                  <td className="py-2 px-2">{s.unseen}</td>
                  <td className="py-2 px-2"><span className={`px-2 py-0.5 rounded-full text-xs ${st.cls}`}>{st.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Session history */}
      <Card className="p-5 mb-8">
        <h2 className="font-display font-bold mb-3">Últimas sesiones de estudio</h2>
        {sessionStats.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Aún no hay sesiones registradas.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={[...sessionStats].reverse()}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="pct" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-1 text-sm">
              {sessionStats.map((s, i) => (
                <div key={i} className="flex items-center justify-between border-b pb-1">
                  <span>{s.date}</span>
                  <span className="text-xs text-muted-foreground">{s.answered} preguntas · {s.mins} min</span>
                  <span className={s.pct >= 80 ? "text-success" : s.pct >= 50 ? "text-warning" : "text-destructive"}>{s.pct}%</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Exam history */}
      <Card className="p-5 mb-8">
        <h2 className="font-display font-bold mb-3">Historial de simulacros</h2>
        {examHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Aún no tienes simulacros.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={examHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <ReferenceLine y={80} stroke="hsl(142 71% 45%)" strokeDasharray="4 4" label={{ value: "80% mínimo", fontSize: 10 }} />
                <Line type="monotone" dataKey="score" stroke="hsl(217 91% 60%)" strokeWidth={3}
                  dot={(props: { cx?: number; cy?: number; payload?: { passed?: boolean }; index?: number }) => {
                    const { cx, cy, payload, index } = props;
                    if (cx === undefined || cy === undefined) return <g key={index} />;
                    return <circle key={index} cx={cx} cy={cy} r={5} fill={payload?.passed ? "hsl(142 71% 45%)" : "hsl(0 84% 60%)"} />;
                  }} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-1 text-sm">
              {exams.slice(-10).reverse().map((e, i) => {
                const passed = e.score_pct >= 80;
                return (
                  <div key={i} className="flex items-center justify-between border-b pb-1">
                    <span>{new Date(e.created_at).toLocaleDateString("es-MX")}</span>
                    <span className="text-xs text-muted-foreground">{e.total_questions ?? "—"} preguntas</span>
                    <span className={passed ? "text-success font-semibold" : "text-destructive font-semibold"}>
                      {Math.round(e.score_pct)}% — {passed ? "APROBADO" : "REPROBADO"}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* Readiness */}
      {recentExams.length > 0 && (
        <Card className="p-5 mb-8 border-l-4 border-l-primary">
          <div className="flex items-center gap-3">
            <CalendarClock className="h-5 w-5 text-primary" />
            <div>
              <div className="text-xs uppercase text-muted-foreground">Proyección de aprobación</div>
              <div className="font-display text-lg font-bold">
                Promedio últimos {recentExams.length}: <span className="text-primary">{avgExam.toFixed(1)}%</span> ·{" "}
                {avgExam >= 80
                  ? <span className="text-success">¡Listo para presentar!</span>
                  : <>Estimado: <span className="text-warning">~{Math.ceil((80 - avgExam) / 1)} días</span> con práctica diaria</>}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Hard questions */}
      {hardQuestions.length > 0 && (
        <Card className="p-5 mb-8">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-display font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Preguntas difíciles
            </h2>
            <Button asChild size="sm">
              <Link to="/study" search={{ mode: "ids" as const, ids: hardQuestions.map((q) => q.id).join(",") }}>
                Estudiar estas 10
              </Link>
            </Button>
          </div>
          <div className="space-y-2">
            {hardQuestions.map((q, i) => (
              <div key={q.id} className="flex items-start gap-3 border-b pb-2 last:border-0">
                <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><SubjectIcon subject={q.subject} /> {q.subject}</div>
                  <p className="text-sm line-clamp-2">{q.text}</p>
                </div>
                <span className="text-xs font-bold text-destructive shrink-0">{q.wrong}× fallada</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
