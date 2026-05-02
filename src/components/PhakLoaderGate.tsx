import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  PHAK_CHAPTERS,
  PHAK_QUESTIONS_PER_CHAPTER,
  PHAK_TOTAL_QUESTIONS,
  CIAAC_GUIDE_TOTAL,
  CIAAC_GUIDE_BATCH_SIZE,
  SUBJECT_TARGETS,
  SUBJECT_BATCH_SIZE,
  BANK_TOTAL_TARGET,
} from "@/lib/phak";
import { SUBJECTS, type Subject } from "@/lib/subjects";
import { Plane, Sparkles, Loader2, BookOpen, Compass, GraduationCap, Play } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Status = "checking" | "ready" | "loading" | "paused" | "error";
type Phase = 1 | 2 | 3;

interface GeneratedQuestion {
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string;
  difficulty: "fácil" | "medio" | "difícil";
}

interface BankProgress {
  phak_chapter_idx: number;       // next chapter index to process
  guide_done: number;
  subject_done: Partial<Record<Subject, number>>;
  total_created: number;
  bank_loaded: boolean;
}

const SETTINGS_KEY = "bank_progress_v2";
const LEGACY_PHAK_KEY = "phak_loaded";
const MIN_TO_UNLOCK = 1000; // si ya hay >=1000 preguntas, dejamos entrar a la app aunque siga generando

const DEFAULT_PROGRESS: BankProgress = {
  phak_chapter_idx: 0,
  guide_done: 0,
  subject_done: {},
  total_created: 0,
  bank_loaded: false,
};

const SUBJECT_FOR_PHAK_CHAPTER: Record<number, Subject> = {
  2: "Reglamentación RAB / Legislación Aeronáutica",
  3: "Factores Humanos y Fisiología",
  4: "Aerodinámica y Principios de Vuelo",
  5: "Aerodinámica y Principios de Vuelo",
  6: "Sistemas de Aeronave",
  7: "Sistemas de Aeronave",
  8: "Reglamentación RAB / Legislación Aeronáutica",
  9: "Performance y Peso y Balance",
  10: "Performance y Peso y Balance",
  11: "Meteorología",
  12: "Meteorología",
  13: "Operaciones Aeronáuticas",
  14: "Espacio Aéreo",
  15: "Navegación Aérea",
  16: "Factores Humanos y Fisiología",
  17: "Factores Humanos y Fisiología",
};

const SUBJECT_SEEDS: Record<Subject, string[]> = {
  "Meteorología": [
    "frentes y masas de aire", "tormentas y turbulencia", "formación de hielo",
    "METAR y TAF", "vientos y cizalladura", "estabilidad atmosférica",
    "niebla y visibilidad", "altimetría y QNH/QFE",
  ],
  "Navegación Aérea": [
    "VOR y radioayudas", "GPS y RNAV/RNP", "cartas aeronáuticas",
    "rumbos, variación y desviación", "triángulo del viento", "navegación a estima",
    "NDB y ADF", "ILS y aproximaciones de precisión",
  ],
  "Reglamentación RAB / Legislación Aeronáutica": [
    "LASCM ley de aviación civil mexicana", "RACM reglamento", "NOM-DGAC",
    "AIP México y NOTAM", "licencias piloto comercial", "certificado médico clase 1",
    "responsabilidades del PIC", "AIC México",
  ],
  "Performance y Peso y Balance": [
    "centro de gravedad y momento", "MTOW MLW ZFW", "distancias de despegue y aterrizaje",
    "altitud densidad", "V-speeds", "diagramas de carga POH", "alcance y autonomía",
    "techo de servicio y ascenso",
  ],
  "Sistemas de Aeronave": [
    "motor de pistón y magnetos", "turbina y turbohélice", "sistema eléctrico",
    "sistema de combustible", "hidráulico y tren de aterrizaje", "instrumentos giroscópicos",
    "pitot-estática", "presurización y oxígeno", "deshielo y antihielo",
  ],
  "Comunicaciones y ATC": [
    "fraseología OACI estándar", "alfabeto fonético y números", "códigos transponder",
    "MAYDAY y PAN-PAN", "ATIS AWOS y broadcasts", "fallas de comunicación",
    "ATC clearances", "transferencia de control y handoff",
  ],
  "Factores Humanos y Fisiología": [
    "hipoxia y oxígeno suplementario", "ilusiones visuales y vestibulares",
    "desorientación espacial", "fatiga y estrés", "alcohol drogas y automedicación",
    "CRM y comunicación en cabina", "toma de decisiones DECIDE", "modelo SHELL y error humano",
    "fisiología de presión y descompresión",
  ],
  "Procedimientos IFR": [
    "SIDs y STARs", "holding patterns y entradas", "aproximaciones de precisión y no precisión",
    "missed approach", "mínimos meteorológicos y alternados", "altitudes MEA MORA MSA",
    "EFB y briefing de aproximación", "fallas de comunicación IFR",
  ],
  "Aerodinámica y Principios de Vuelo": [
    "sustentación y resistencia", "perfil alar y ángulo de ataque", "pérdida y barrena",
    "estabilidad longitudinal lateral direccional", "controles primarios y secundarios",
    "factor de carga y maniobras", "vuelo de crucero y máxima resistencia",
    "aerodinámica de alta velocidad",
  ],
  "Operaciones Aeronáuticas": [
    "operaciones en aeropuerto", "rodaje y señalización", "luces de pista y calle de rodaje",
    "wake turbulence y separaciones", "operaciones VFR y en circuito",
    "procedimientos de ruido", "operaciones nocturnas", "cargo y mercancías peligrosas",
  ],
  "Espacio Aéreo": [
    "clases de espacio aéreo OACI A-G", "espacio controlado y no controlado",
    "TMA CTR ATZ", "áreas restringidas, prohibidas y peligrosas",
    "reglamento espacio aéreo mexicano", "Class B C D E reglas FAA",
    "transponder requerimientos", "altitudes de transición",
  ],
  "Reglamentación OACI / Anexos": [
    "Anexo 1 licencias", "Anexo 2 reglas del aire", "Anexo 3 meteorología",
    "Anexo 4 cartas", "Anexo 6 operación aeronaves", "Anexo 8 aeronavegabilidad",
    "Anexo 11 ATS", "Anexo 14 aeródromos", "Anexo 17 seguridad", "Anexo 18 mercancías peligrosas",
    "Anexo 19 SMS",
  ],
};

// ────────────────────────────────────────────────────────────────────────
// Persistencia

async function loadProgress(userId: string): Promise<BankProgress> {
  const [{ data: bank }, { data: legacy }] = await Promise.all([
    supabase.from("app_settings").select("value").eq("user_id", userId).eq("key", SETTINGS_KEY).maybeSingle(),
    supabase.from("app_settings").select("value").eq("user_id", userId).eq("key", LEGACY_PHAK_KEY).maybeSingle(),
  ]);

  if (bank?.value) {
    try { return JSON.parse(bank.value) as BankProgress; } catch { /* fall through */ }
  }
  if (legacy?.value === "true") {
    return { ...DEFAULT_PROGRESS, phak_chapter_idx: PHAK_CHAPTERS.length, total_created: PHAK_TOTAL_QUESTIONS };
  }
  return { ...DEFAULT_PROGRESS };
}

async function saveProgress(userId: string, progress: BankProgress) {
  await supabase.from("app_settings").upsert(
    { user_id: userId, key: SETTINGS_KEY, value: JSON.stringify(progress), updated_at: new Date().toISOString() },
    { onConflict: "user_id,key" },
  );
}

/**
 * Reconciliar el contador con la verdad de la tabla `questions`.
 * Sirve para reanudar correctamente y para reflejar las preguntas
 * que ya están en la base aunque el contador local se haya perdido.
 */
async function reconcileFromDb(progress: BankProgress): Promise<BankProgress> {
  const { count } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true });
  const real = count ?? 0;

  const next: BankProgress = { ...progress, subject_done: { ...progress.subject_done } };
  if (real > next.total_created) next.total_created = real;
  return next;
}

async function insertQuestions(userId: string, subject: Subject, questions: GeneratedQuestion[]) {
  if (!questions.length) return;
  await supabase.from("questions").insert(
    questions.map((q) => ({
      user_id: userId,
      subject,
      question_text: q.question_text,
      options: q.options,
      correct_index: q.correct_index,
      explanation: q.explanation,
      difficulty: q.difficulty,
    })),
  );
}

// ────────────────────────────────────────────────────────────────────────
// Reintentos

async function callWithRetry<T>(fn: () => Promise<T>, label: string, attempts = 3, waitMs = 2000): Promise<T> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      console.warn(`[bank] ${label} intento ${i + 1}/${attempts} falló:`, e);
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`${label}: error desconocido`);
}

interface BatchResult { questions: GeneratedQuestion[]; subject?: string }

async function invokePhak(chapter: { number: number; name: string }, count: number): Promise<BatchResult> {
  const { data, error } = await supabase.functions.invoke("load-phak-chapter", {
    body: { chapter_number: chapter.number, chapter_name: chapter.name, count },
  });
  if (error) throw new Error(error.message);
  return { questions: data?.questions ?? [], subject: data?.subject };
}

async function invokeSubjectBatch(subject: Subject, count: number, seed_topic: string | undefined, batch_index: number): Promise<BatchResult> {
  const { data, error } = await supabase.functions.invoke("generate-subject-batch", {
    body: { subject, count, seed_topic, batch_index },
  });
  if (error) throw new Error(error.message);
  return { questions: data?.questions ?? [] };
}

// ────────────────────────────────────────────────────────────────────────
// Component

export function BankLoaderGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>("checking");
  const [phase, setPhase] = useState<Phase>(1);
  const [progress, setProgress] = useState<BankProgress>(DEFAULT_PROGRESS);
  const [currentLabel, setCurrentLabel] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const runningRef = useRef(false);

  // Comprobación inicial: si ya hay suficientes preguntas, dejamos entrar.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const initial = await reconcileFromDb(await loadProgress(user.id));
      setProgress(initial);
      if (initial.bank_loaded || initial.total_created >= MIN_TO_UNLOCK) {
        setStatus("ready");
      } else {
        setStatus("paused"); // Mostramos pantalla con botón "Empezar / Continuar"
      }
    })();
  }, [user]);

  const startGeneration = async () => {
    if (!user || runningRef.current) return;
    runningRef.current = true;
    cancelledRef.current = false;
    setStatus("loading");
    setErrorMsg(null);

    try {
      const current = await reconcileFromDb(await loadProgress(user.id));
      setProgress(current);

      // ─── PHASE 1: PHAK ──────────────────────────────────
      setPhase(1);
      for (let i = current.phak_chapter_idx; i < PHAK_CHAPTERS.length; i++) {
        if (cancelledRef.current) { runningRef.current = false; setStatus("paused"); return; }
        const chapter = PHAK_CHAPTERS[i];
        const targetForChapter = PHAK_QUESTIONS_PER_CHAPTER;
        const inChunks = Math.ceil(targetForChapter / 10);

        for (let c = 0; c < inChunks; c++) {
          if (cancelledRef.current) { runningRef.current = false; setStatus("paused"); return; }
          setCurrentLabel(`Cap. ${i + 1}/${PHAK_CHAPTERS.length}: ${chapter.name} — lote ${c + 1}/${inChunks}`);
          const batch = Math.min(10, targetForChapter - c * 10);
          const res = await callWithRetry(
            () => invokePhak(chapter, batch),
            `PHAK ${chapter.number} lote ${c + 1}`,
          );
          const subject = (res.subject ?? SUBJECT_FOR_PHAK_CHAPTER[chapter.number] ?? "Reglamentación RAB / Legislación Aeronáutica") as Subject;
          if (res.questions.length) {
            await insertQuestions(user.id, subject, res.questions);
            current.total_created += res.questions.length;
          }
          setProgress({ ...current });
        }

        current.phak_chapter_idx = i + 1;
        await saveProgress(user.id, current);
      }

      // ─── PHASE 2: Guía CIAAC ───────────────────────────
      setPhase(2);
      while (current.guide_done < CIAAC_GUIDE_TOTAL) {
        if (cancelledRef.current) { runningRef.current = false; setStatus("paused"); return; }
        const remaining = CIAAC_GUIDE_TOTAL - current.guide_done;
        const batch = Math.min(CIAAC_GUIDE_BATCH_SIZE, remaining);
        const seedSubject = SUBJECTS[Math.floor(current.guide_done / CIAAC_GUIDE_BATCH_SIZE) % SUBJECTS.length];
        setCurrentLabel(`Guía Oficial CIAAC — ${current.guide_done}/${CIAAC_GUIDE_TOTAL}`);
        const res = await callWithRetry(
          () => invokeSubjectBatch(
            seedSubject,
            batch,
            "preguntas tipo guía oficial del sustentante CIAAC México, temario completo piloto comercial",
            Math.floor(current.guide_done / CIAAC_GUIDE_BATCH_SIZE),
          ),
          `Guía CIAAC ${current.guide_done}`,
        );
        if (res.questions.length) {
          await insertQuestions(user.id, seedSubject, res.questions);
          current.total_created += res.questions.length;
          current.guide_done += res.questions.length;
        } else {
          current.guide_done += batch;
        }
        await saveProgress(user.id, current);
        setProgress({ ...current });
      }

      // ─── PHASE 3: Por materia ───────────────────────────
      setPhase(3);
      const subjectList = SUBJECTS;
      for (let s = 0; s < subjectList.length; s++) {
        const subject = subjectList[s];
        const target = SUBJECT_TARGETS[subject] ?? 0;
        let done = current.subject_done[subject] ?? 0;

        // Reconciliar con DB: si en la base hay más que el contador, lo subimos.
        const { count: realInDb } = await supabase
          .from("questions").select("id", { count: "exact", head: true }).eq("subject", subject);
        if ((realInDb ?? 0) > done) done = realInDb!;

        while (done < target) {
          if (cancelledRef.current) { runningRef.current = false; setStatus("paused"); return; }
          const batch = Math.min(SUBJECT_BATCH_SIZE, target - done);
          const seeds = SUBJECT_SEEDS[subject] ?? [];
          const seed = seeds.length ? seeds[Math.floor(done / SUBJECT_BATCH_SIZE) % seeds.length] : undefined;
          setCurrentLabel(`Materia ${s + 1}/${subjectList.length}: ${subject} — ${done}/${target}`);

          const res = await callWithRetry(
            () => invokeSubjectBatch(subject, batch, seed, Math.floor(done / SUBJECT_BATCH_SIZE)),
            `${subject} lote`,
          );
          if (res.questions.length) {
            await insertQuestions(user.id, subject, res.questions);
            current.total_created += res.questions.length;
            done += res.questions.length;
          } else {
            done += batch;
          }
          current.subject_done[subject] = done;
          await saveProgress(user.id, current);
          setProgress({ ...current });
        }
      }

      // ─── DONE ────────────────────────────────────────
      current.bank_loaded = true;
      await saveProgress(user.id, current);
      await supabase.from("app_settings").upsert(
        { user_id: user.id, key: LEGACY_PHAK_KEY, value: "true", updated_at: new Date().toISOString() },
        { onConflict: "user_id,key" },
      );
      runningRef.current = false;
      toast.success(`¡Banco completo! ${current.total_created.toLocaleString("es-MX")} preguntas.`);
      setStatus("ready");
    } catch (e) {
      runningRef.current = false;
      const msg = e instanceof Error ? e.message : "Error desconocido";
      console.error("Bank load error:", e);
      setErrorMsg(msg);
      setStatus("error");
    }
  };

  // Cancelar cuando se desmonta
  useEffect(() => () => { cancelledRef.current = true; }, []);

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-sky">
        <div className="animate-pulse text-muted-foreground">Cargando…</div>
      </div>
    );
  }

  if (status === "ready") return <>{children}</>;

  // ─── UI: paused / loading / error ─────────────────────
  const globalPct = Math.min(100, Math.round((progress.total_created / BANK_TOTAL_TARGET) * 100));
  const hasSomeData = progress.total_created > 0;

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-hero text-primary-foreground p-6 relative overflow-hidden">
      <div className="absolute -right-32 -bottom-32 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

      <div className="relative max-w-xl w-full text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/15 backdrop-blur mb-6">
          <Plane className={`h-8 w-8 ${status === "loading" ? "animate-pulse" : ""}`} />
        </div>

        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
          {status === "error"
            ? "Generación interrumpida"
            : status === "paused"
              ? hasSomeData ? "Continuar generación del banco" : "Preparar tu banco de preguntas"
              : "Construyendo tu banco de preguntas"}
        </h1>
        <p className="mt-3 text-primary-foreground/80 text-sm">
          Objetivo: {BANK_TOTAL_TARGET.toLocaleString("es-MX")} preguntas estilo CIAAC en 12 materias.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-2 text-xs">
          <PhaseChip icon={<BookOpen className="h-3.5 w-3.5" />} label="PHAK" active={phase === 1 && status === "loading"} done={phase > 1 || progress.phak_chapter_idx >= PHAK_CHAPTERS.length} />
          <PhaseChip icon={<Compass className="h-3.5 w-3.5" />} label="Guía CIAAC" active={phase === 2 && status === "loading"} done={phase > 2 || progress.guide_done >= CIAAC_GUIDE_TOTAL} />
          <PhaseChip icon={<GraduationCap className="h-3.5 w-3.5" />} label="Por materia" active={phase === 3 && status === "loading"} done={progress.bank_loaded} />
        </div>

        <div className="mt-6 rounded-2xl bg-white/10 backdrop-blur border border-white/20 p-6 text-left">
          {status === "loading" && (
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary-foreground/70 font-medium">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generando…
            </div>
          )}
          <div className="mt-2 font-display text-base md:text-lg font-semibold leading-snug">
            {status === "error"
              ? "Se detuvo la generación. Tu progreso está guardado."
              : currentLabel || (hasSomeData
                ? `Llevas ${progress.total_created.toLocaleString("es-MX")} preguntas guardadas.`
                : "Aún no has generado preguntas.")}
          </div>
          {errorMsg && (
            <div className="mt-3 text-xs text-primary-foreground/80 bg-destructive/30 border border-destructive/50 rounded p-2">
              {errorMsg}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-5">
          <div className="flex items-center justify-between text-xs font-medium mb-2">
            <span>Progreso global</span>
            <span>{globalPct}%</span>
          </div>
          <Progress value={globalPct} className="h-2 bg-white/20" />
          <div className="mt-2 text-xs text-primary-foreground/70">
            {progress.total_created.toLocaleString("es-MX")} / {BANK_TOTAL_TARGET.toLocaleString("es-MX")} preguntas
          </div>
        </div>

        {/* Botones de acción */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          {(status === "paused" || status === "error") && (
            <Button
              size="lg"
              variant="secondary"
              className="text-primary font-semibold"
              onClick={startGeneration}
            >
              <Play className="h-4 w-4 mr-2" />
              {hasSomeData ? "Continuar generación" : "Empezar generación"}
            </Button>
          )}
          {status === "loading" && (
            <Button
              size="lg"
              variant="ghost"
              className="text-primary-foreground hover:bg-white/10"
              onClick={() => { cancelledRef.current = true; }}
            >
              Pausar
            </Button>
          )}
          {hasSomeData && (
            <Button
              size="lg"
              variant="ghost"
              className="text-primary-foreground hover:bg-white/10"
              onClick={() => setStatus("ready")}
            >
              Entrar a la app ({progress.total_created.toLocaleString("es-MX")} preguntas)
            </Button>
          )}
        </div>

        <div className="mt-6 inline-flex items-start gap-2 rounded-2xl bg-white/10 backdrop-blur px-4 py-3 text-xs text-left max-w-md">
          <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            La generación se hace en lotes pequeños con reintentos automáticos.
            Puedes pausar y continuar cuando quieras — tu progreso queda guardado.
          </span>
        </div>
      </div>
    </div>
  );
}

function PhaseChip({ icon, label, active, done }: {
  icon: React.ReactNode; label: string; active: boolean; done: boolean;
}) {
  return (
    <div className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 border ${
      active
        ? "bg-accent text-primary border-accent shadow-glow"
        : done
          ? "bg-white/20 text-primary-foreground border-white/30"
          : "bg-white/5 text-primary-foreground/50 border-white/10"
    }`}>
      {done ? <span className="text-xs">✓</span> : icon}
      <span className="font-medium">{label}</span>
    </div>
  );
}
