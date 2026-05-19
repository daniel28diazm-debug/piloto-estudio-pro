import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SUBJECTS, type Subject } from "@/lib/subjects";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Play, Pause, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/reclassify")({
  component: ReclassifyPage,
});

interface QRow { id: string; question_text: string; subject: string; options: string[]; explanation: string }

const BATCH = 50;
const STORAGE_KEY = "reclassify-progress-v1";

interface Saved { doneIds: string[] }

function loadSaved(): Saved {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"doneIds":[]}'); }
  catch { return { doneIds: [] }; }
}
function saveSaved(s: Saved) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

function ReclassifyPage() {
  const { user } = useAuth();
  const [all, setAll] = useState<QRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set(loadSaved().doneIds));
  const [changed, setChanged] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const out: QRow[] = [];
      let from = 0;
      for (let i = 0; i < 20; i++) {
        const { data, error } = await supabase
          .from("questions")
          .select("id, question_text, subject, options, explanation")
          .order("created_at", { ascending: true })
          .range(from, from + 999);
        if (error) { toast.error(error.message); break; }
        const r = (data ?? []) as QRow[];
        out.push(...r);
        if (r.length < 1000) break;
        from += 1000;
      }
      setAll(out);
      recount(out);
      setLoading(false);
    })();
  }, [user]);

  const recount = (rows: QRow[]) => {
    const c: Record<string, number> = {};
    for (const s of SUBJECTS) c[s] = 0;
    for (const r of rows) c[r.subject] = (c[r.subject] ?? 0) + 1;
    setCounts(c);
  };

  const pending = useMemo(() => all.filter((q) => !doneIds.has(q.id)), [all, doneIds]);
  const total = all.length;
  const done = total - pending.length;

  const start = async () => {
    if (running) return;
    cancelRef.current = false;
    setRunning(true);
    setErrors([]);
    const queue = [...pending];
    const subjectSet = new Set<string>(SUBJECTS);
    const updatedAll = [...all];
    const byId = new Map(updatedAll.map((q, i) => [q.id, i]));

    let localChanged = changed;
    const newDone = new Set(doneIds);

    while (queue.length > 0 && !cancelRef.current) {
      const batch = queue.splice(0, BATCH);
      try {
        const { data, error } = await supabase.functions.invoke("reclassify-batch", {
          body: { questions: batch.map((q) => ({
            id: q.id, question_text: q.question_text,
            options: q.options, explanation: q.explanation,
          })) },
        });
        if (error) throw error;
        const results: { id: string; subject: string }[] = data?.results ?? [];
        const mapRes = new Map(results.map((r) => [r.id, r.subject]));

        // Apply updates one-by-one (RLS scoped). Group by subject for fewer round-trips.
        const bySubject = new Map<string, string[]>();
        for (const q of batch) {
          const newS = mapRes.get(q.id);
          if (!newS || !subjectSet.has(newS)) continue;
          if (newS === q.subject) continue;
          if (!bySubject.has(newS)) bySubject.set(newS, []);
          bySubject.get(newS)!.push(q.id);
        }
        for (const [s, ids] of bySubject) {
          const { error: upErr } = await supabase
            .from("questions").update({ subject: s as Subject }).in("id", ids);
          if (upErr) { setErrors((e) => [...e, upErr.message]); continue; }
          for (const id of ids) {
            const idx = byId.get(id);
            if (idx != null) updatedAll[idx] = { ...updatedAll[idx], subject: s };
          }
          localChanged += ids.length;
        }
        for (const q of batch) newDone.add(q.id);
        setDoneIds(new Set(newDone));
        saveSaved({ doneIds: [...newDone] });
        setChanged(localChanged);
        setAll([...updatedAll]);
        recount(updatedAll);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error";
        setErrors((er) => [...er, msg]);
        // brief backoff then continue
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    setRunning(false);
    if (cancelRef.current) toast.info("Pausado");
    else if (queue.length === 0) toast.success(`Listo. ${localChanged} preguntas reclasificadas.`);
  };

  const stop = () => { cancelRef.current = true; };
  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setDoneIds(new Set());
    setChanged(0);
    setErrors([]);
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto pb-24">
      <h1 className="font-display text-3xl font-bold tracking-tight mb-1 flex items-center gap-2">
        <Sparkles className="h-7 w-7 text-primary" /> Reclasificar banco
      </h1>
      <p className="text-muted-foreground mb-6">
        Reasigna la materia correcta a cada pregunta usando IA. Procesa en lotes de {BATCH}.
      </p>

      <Card className="p-6 mb-6">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando preguntas…
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between mb-3">
              <div>
                <div className="text-sm text-muted-foreground">Progreso</div>
                <div className="text-2xl font-bold">{done.toLocaleString()} / {total.toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Cambios aplicados</div>
                <div className="text-2xl font-bold text-primary">{changed.toLocaleString()}</div>
              </div>
            </div>
            <Progress value={total ? (done / total) * 100 : 0} className="h-2" />
            <div className="flex flex-wrap gap-2 mt-4">
              {!running ? (
                <Button onClick={start} disabled={pending.length === 0}>
                  <Play className="h-4 w-4 mr-1.5" />
                  {done > 0 && pending.length > 0 ? "Reanudar" : "Iniciar reclasificación"}
                </Button>
              ) : (
                <Button onClick={stop} variant="secondary">
                  <Pause className="h-4 w-4 mr-1.5" /> Pausar
                </Button>
              )}
              <Button onClick={reset} variant="ghost" disabled={running}>
                <RotateCcw className="h-4 w-4 mr-1.5" /> Reiniciar progreso
              </Button>
            </div>
            {running && (
              <p className="text-sm text-muted-foreground mt-3">
                Reclasificando preguntas… {done.toLocaleString()} de {total.toLocaleString()}
              </p>
            )}
          </>
        )}
      </Card>

      <Card className="p-6 mb-6">
        <h2 className="font-semibold mb-3">Distribución actual por materia</h2>
        <div className="grid sm:grid-cols-2 gap-1.5 text-sm">
          {SUBJECTS.map((s) => (
            <div key={s} className="flex justify-between border-b py-1.5">
              <span className="truncate pr-2">{s}</span>
              <span className="font-mono font-semibold">{(counts[s] ?? 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </Card>

      {errors.length > 0 && (
        <Card className="p-4 border-destructive/50 bg-destructive/5">
          <h3 className="font-semibold text-destructive mb-2">Errores ({errors.length})</h3>
          <ul className="text-xs text-muted-foreground space-y-1 max-h-48 overflow-auto">
            {errors.slice(-20).map((e, i) => <li key={i}>• {e}</li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}
