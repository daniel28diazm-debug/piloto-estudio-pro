import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SUBJECTS, SUBJECT_ICONS, type Subject, SubjectIcon } from "@/lib/subjects";
import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import { Flame, AlertTriangle, Trophy } from "lucide-react";

export const Route = createFileRoute("/_app/progress")({
  component: ProgressPage,
});

interface SubjectStat {
  subject: Subject;
  total: number;
  correct: number;
  pct: number;
}

interface ExamPoint {
  date: string;
  score: number;
}

function ProgressPage() {
  const { user } = useAuth();
  const [subjectStats, setSubjectStats] = useState<SubjectStat[]>([]);
  const [streak, setStreak] = useState(0);
  const [examHistory, setExamHistory] = useState<ExamPoint[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Paginate to bypass 1000-row default limit
      const answers: { subject: string; is_correct: boolean; created_at: string }[] = [];
      let from = 0;
      for (let i = 0; i < 20; i++) {
        const { data } = await supabase
          .from("question_answers")
          .select("subject, is_correct, created_at")
          .range(from, from + 999);
        if (!data || data.length === 0) break;
        answers.push(...data);
        if (data.length < 1000) break;
        from += 1000;
      }

      const stats = SUBJECTS.map((s) => {
        const subset = (answers ?? []).filter((a) => a.subject === s);
        const correct = subset.filter((a) => a.is_correct).length;
        return {
          subject: s as Subject,
          total: subset.length,
          correct,
          pct: subset.length ? (correct / subset.length) * 100 : 0,
        };
      });
      setSubjectStats(stats);

      // streak: consecutive days with at least one answer
      const days = new Set(
        (answers ?? []).map((a) => new Date(a.created_at).toISOString().slice(0, 10)),
      );
      let s = 0;
      const today = new Date();
      for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        if (days.has(d.toISOString().slice(0, 10))) s++;
        else if (i === 0) continue; // skip today if not studied yet
        else break;
      }
      setStreak(s);

      const { data: exams } = await supabase
        .from("exam_attempts")
        .select("score_pct, created_at")
        .order("created_at");
      setExamHistory(
        (exams ?? []).map((e) => ({
          date: new Date(e.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" }),
          score: Math.round(e.score_pct),
        })),
      );
    })();
  }, [user]);

  const studied = subjectStats.filter((s) => s.total > 0);
  const weakest = [...studied].sort((a, b) => a.pct - b.pct).slice(0, 3);

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto pb-24 md:pb-10">
      <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Tu progreso</h1>
      <p className="text-muted-foreground mb-8">Identifica fortalezas y áreas de mejora.</p>

      {/* Top stats */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/20">
              <Flame className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">Racha</div>
              <div className="font-display text-3xl font-bold">{streak} {streak === 1 ? "día" : "días"}</div>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-success/20">
              <Trophy className="h-5 w-5 text-success" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">Mejor materia</div>
              <div className="font-display text-lg font-bold">
                {studied.length ? [...studied].sort((a, b) => b.pct - a.pct)[0].subject : "—"}
              </div>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">A reforzar</div>
              <div className="font-display text-lg font-bold">{weakest[0]?.subject ?? "—"}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Exam history chart */}
      <Card className="p-6 mb-8">
        <h2 className="font-display text-lg font-bold mb-4">Historial de exámenes</h2>
        {examHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Aún no tienes exámenes registrados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={examHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.015 235)" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid oklch(0.9 0.015 235)",
                  borderRadius: 8,
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="oklch(0.55 0.18 245)"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Subject performance */}
      <Card className="p-6 mb-8">
        <h2 className="font-display text-lg font-bold mb-4">Rendimiento por materia</h2>
        {studied.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Responde algunas preguntas para ver tu rendimiento.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={studied} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.015 235)" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="subject" width={140} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="pct" fill="oklch(0.55 0.18 245)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Weakest subjects */}
      {weakest.length > 0 && (
        <Card className="p-6">
          <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Materias a reforzar
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {weakest.map((w) => (
              <div key={w.subject} className="rounded-lg border-2 border-destructive/30 bg-destructive/5 p-4">
                <div className="text-2xl"><SubjectIcon subject={w.subject} /></div>
                <div className="font-semibold mt-1 text-sm">{w.subject}</div>
                <div className="font-display text-2xl font-bold mt-1 text-destructive">
                  {Math.round(w.pct)}%
                </div>
                <div className="text-xs text-muted-foreground">{w.correct} de {w.total}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
