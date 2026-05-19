import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Play, Pause, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/generate")({
  component: GeneratePage,
});

interface TopicSpec {
  topic: string;
  source: string;
  subject?: string;
  autoSubject?: boolean;
  count: number;
}

interface JobSpec {
  id: string;
  title: string;
  source: string;
  subject?: string;
  autoSubject?: boolean;
  topics: TopicSpec[]; // suma de counts = total
}

const BATCH = 10;

const JOBS: JobSpec[] = [
  {
    id: "legislacion_mexicana",
    title: "1. Legislación Aeronáutica Mexicana (200)",
    source: "legislacion_mexicana",
    subject: "Reglamentación RAB / Legislación Aeronáutica",
    topics: [
      { topic: "NOMs aeronáuticas aplicables a aviación civil mexicana (numeración, alcance, obligatoriedad)", source: "legislacion_mexicana", count: 25 },
      { topic: "SCT/AFAC: regulaciones, circulares y atribuciones", source: "legislacion_mexicana", count: 25 },
      { topic: "Circulares Obligatorias de la AFAC (CO-AV) vigentes", source: "legislacion_mexicana", count: 25 },
      { topic: "Ley de Aviación Civil (LAC) y su Reglamento (RLAC): articulado clave", source: "legislacion_mexicana", count: 30 },
      { topic: "Ley Federal del Trabajo aplicada a pilotos (Capítulo de tripulantes aeronáuticos)", source: "legislacion_mexicana", count: 20 },
      { topic: "Constitución Política de los EUM: artículos relacionados con aviación, espacio aéreo y comercio exterior", source: "legislacion_mexicana", count: 15 },
      { topic: "Leyes reglamentarias y federales aplicables a aviación civil mexicana", source: "legislacion_mexicana", count: 20 },
      { topic: "Reglamento de Aviación de México (RAB / RLAC): operaciones, licencias, sanciones", source: "legislacion_mexicana", count: 40 },
    ],
  },
  {
    id: "libertades_aire",
    title: "2. Libertades del Aire (40)",
    source: "libertades_aire",
    subject: "Reglamentación OACI / Anexos",
    topics: [
      { topic: "Las 9 Libertades del Aire: definición, diferencia técnica/tráfico, ejemplos prácticos, acuerdos bilaterales/multilaterales y relación con el Convenio de Chicago", source: "libertades_aire", count: 40 },
    ],
  },
  {
    id: "anexos_oaci",
    title: "3. Anexos OACI (200)",
    source: "anexos_oaci",
    subject: "Reglamentación OACI / Anexos",
    topics: [
      { topic: "Anexo 1 OACI — Licencias al personal", source: "anexos_oaci", count: 20 },
      { topic: "Anexo 2 OACI — Reglamento del aire", source: "anexos_oaci", count: 15 },
      { topic: "Anexo 6 OACI — Operación de aeronaves", source: "anexos_oaci", count: 20 },
      { topic: "Anexo 7 OACI — Marcas de nacionalidad y matrícula", source: "anexos_oaci", count: 10 },
      { topic: "Anexo 8 OACI — Aeronavegabilidad", source: "anexos_oaci", count: 15 },
      { topic: "Anexo 10 OACI — Telecomunicaciones aeronáuticas", source: "anexos_oaci", count: 15 },
      { topic: "Anexo 11 OACI — Servicios de tránsito aéreo", source: "anexos_oaci", count: 20 },
      { topic: "Anexo 12 OACI — Búsqueda y salvamento", source: "anexos_oaci", count: 10 },
      { topic: "Anexo 13 OACI — Investigación de accidentes", source: "anexos_oaci", count: 15 },
      { topic: "Anexo 14 OACI — Aeródromos", source: "anexos_oaci", count: 15 },
      { topic: "Anexo 15 OACI — Servicios de información aeronáutica", source: "anexos_oaci", count: 10 },
      { topic: "Anexo 17 OACI — Seguridad (protección de la aviación civil)", source: "anexos_oaci", count: 10 },
      { topic: "Anexo 18 OACI — Transporte sin riesgos de mercancías peligrosas", source: "anexos_oaci", count: 10 },
      { topic: "Anexo 19 OACI — Gestión de la seguridad operacional", source: "anexos_oaci", count: 15 },
    ],
  },
  {
    id: "pilot_institute",
    title: "4. Pilot Institute blog (400)",
    source: "pilot_institute",
    autoSubject: true,
    topics: [
      { topic: "Contenido educativo del blog pilotinstitute.com/blog: meteorología (METAR/TAF, frentes, turbulencia), aerodinámica (sustentación, pérdida, stall recovery)", source: "pilot_institute", count: 80 },
      { topic: "Contenido del blog pilotinstitute.com: regulaciones FAA aplicables a piloto privado/comercial, espacios aéreos (Clase A–G), TFRs, NOTAMs", source: "pilot_institute", count: 80 },
      { topic: "Contenido del blog pilotinstitute.com: navegación (cartas, VOR, GPS, planeación de vuelo, performance), peso y balance", source: "pilot_institute", count: 80 },
      { topic: "Contenido del blog pilotinstitute.com: sistemas de aeronave, instrumentos, motor a pistón, hélice, sistemas eléctricos e hidráulicos", source: "pilot_institute", count: 80 },
      { topic: "Contenido del blog pilotinstitute.com: factores humanos, CRM, fisiología (hipoxia, vértigo, ilusiones), comunicaciones ATC y procedimientos IFR", source: "pilot_institute", count: 80 },
    ],
  },
];

interface SavedJob { done: number; topicIdx: number; topicDone: number }

function settingKey(jobId: string) { return `gen-job-${jobId}`; }

function GeneratePage() {
  const { user } = useAuth();
  const [state, setState] = useState<Record<string, SavedJob>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const cancelRef = useRef(false);

  const totals = useMemo(() => Object.fromEntries(
    JOBS.map(j => [j.id, j.topics.reduce((a,t) => a + t.count, 0)])
  ), []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const keys = JOBS.map(j => settingKey(j.id));
      const { data } = await supabase.from("app_settings").select("key,value").in("key", keys);
      const next: Record<string, SavedJob> = {};
      for (const j of JOBS) {
        const row = data?.find(d => d.key === settingKey(j.id));
        try { next[j.id] = row ? JSON.parse(row.value) : { done: 0, topicIdx: 0, topicDone: 0 }; }
        catch { next[j.id] = { done: 0, topicIdx: 0, topicDone: 0 }; }
      }
      setState(next);
      setLoading(false);
    })();
  }, [user]);

  const persist = async (jobId: string, s: SavedJob) => {
    if (!user) return;
    await supabase.from("app_settings").upsert(
      { user_id: user.id, key: settingKey(jobId), value: JSON.stringify(s) },
      { onConflict: "user_id,key" } as never,
    );
  };

  const log = (m: string) => setLogs(l => [...l.slice(-200), m]);

  const runJob = async (job: JobSpec) => {
    if (!user || running) return;
    cancelRef.current = false;
    setRunning(job.id);
    const cur = { ...(state[job.id] ?? { done: 0, topicIdx: 0, topicDone: 0 }) };
    const total = totals[job.id];

    while (cur.topicIdx < job.topics.length && !cancelRef.current) {
      const t = job.topics[cur.topicIdx];
      while (cur.topicDone < t.count && !cancelRef.current) {
        const n = Math.min(BATCH, t.count - cur.topicDone);

        // sample existing to avoid duplicates within the source
        const { data: existing } = await supabase
          .from("questions").select("question_text")
          .eq("source", job.source).limit(40);
        const avoid = (existing ?? []).map(r => r.question_text.slice(0, 120));

        try {
          const { data, error } = await supabase.functions.invoke("generate-bulk-questions", {
            body: {
              topic: t.topic, source: job.source,
              subject: job.subject, autoSubject: job.autoSubject,
              count: n, avoidSamples: avoid,
            },
          });
          if (error) throw error;
          const qs = (data?.questions ?? []) as Array<{
            question_text: string; options: string[]; correct_index: number;
            explanation: string; difficulty: string; reference?: string; subject?: string;
          }>;
          if (qs.length === 0) throw new Error("La IA devolvió 0 preguntas");

          const rows = qs.map(q => ({
            user_id: user.id,
            subject: (job.autoSubject ? q.subject : job.subject)!,
            source: job.source,
            question_text: q.question_text,
            options: q.options,
            correct_index: q.correct_index,
            explanation: q.explanation,
            difficulty: q.difficulty as "fácil"|"medio"|"difícil",
            reference: q.reference ?? null,
          }));
          const { error: insErr } = await supabase.from("questions").insert(rows);
          if (insErr) throw insErr;

          cur.topicDone += rows.length;
          cur.done += rows.length;
          await persist(job.id, cur);
          setState(s => ({ ...s, [job.id]: { ...cur } }));
          log(`✓ ${job.id} · "${t.topic.slice(0,50)}…" +${rows.length} (acum ${cur.done}/${total})`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Error";
          log(`✗ ${job.id}: ${msg}`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      if (!cancelRef.current && cur.topicDone >= t.count) {
        cur.topicIdx += 1;
        cur.topicDone = 0;
        await persist(job.id, cur);
        setState(s => ({ ...s, [job.id]: { ...cur } }));
      }
    }
    setRunning(null);
    if (cancelRef.current) toast.info(`Pausado: ${job.id}`);
    else toast.success(`Job completo: ${job.id} (${cur.done} preguntas)`);
  };

  const resetJob = async (job: JobSpec) => {
    if (!user) return;
    const empty = { done: 0, topicIdx: 0, topicDone: 0 };
    await persist(job.id, empty);
    setState(s => ({ ...s, [job.id]: empty }));
  };

  if (loading) {
    return <div className="p-10 flex items-center gap-2 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin"/> Cargando…</div>;
  }

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto pb-24">
      <h1 className="font-display text-3xl font-bold tracking-tight mb-1 flex items-center gap-2">
        <Sparkles className="h-7 w-7 text-primary"/> Generar preguntas
      </h1>
      <p className="text-muted-foreground mb-6">
        Agrega preguntas nuevas al banco. Lotes de {BATCH}. El progreso se guarda automáticamente.
      </p>

      {JOBS.map(j => {
        const s = state[j.id] ?? { done: 0, topicIdx: 0, topicDone: 0 };
        const total = totals[j.id];
        const pct = total ? (s.done / total) * 100 : 0;
        const isThis = running === j.id;
        return (
          <Card key={j.id} className="p-5 mb-4">
            <div className="flex items-end justify-between gap-3 mb-2">
              <div>
                <div className="font-semibold">{j.title}</div>
                <div className="text-xs text-muted-foreground">source: {j.source}{j.subject ? ` · ${j.subject}` : " · materia automática"}</div>
              </div>
              <div className="text-right font-mono">
                <div className="text-2xl font-bold">{s.done}/{total}</div>
              </div>
            </div>
            <Progress value={pct} className="h-2 mb-3"/>
            <div className="flex gap-2 flex-wrap">
              {!isThis ? (
                <Button size="sm" disabled={!!running || s.done >= total} onClick={() => runJob(j)}>
                  <Play className="h-4 w-4 mr-1.5"/>
                  {s.done > 0 && s.done < total ? "Reanudar" : "Iniciar"}
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => { cancelRef.current = true; }}>
                  <Pause className="h-4 w-4 mr-1.5"/> Pausar
                </Button>
              )}
              <Button size="sm" variant="ghost" disabled={!!running} onClick={() => resetJob(j)}>
                <RotateCcw className="h-4 w-4 mr-1.5"/> Reiniciar
              </Button>
              {isThis && <span className="text-sm text-muted-foreground self-center">
                <Loader2 className="h-4 w-4 animate-spin inline mr-1"/> Generando…
              </span>}
            </div>
          </Card>
        );
      })}

      <Card className="p-4 mt-6">
        <h3 className="font-semibold mb-2 text-sm">Registro</h3>
        <div className="text-xs font-mono text-muted-foreground max-h-64 overflow-auto space-y-0.5">
          {logs.length === 0 ? <div className="opacity-60">(sin actividad)</div>
            : logs.slice().reverse().map((l,i) => <div key={i}>{l}</div>)}
        </div>
      </Card>
    </div>
  );
}
