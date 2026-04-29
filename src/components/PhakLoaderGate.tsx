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
  PHASE3_TOTAL,
  BANK_TOTAL_TARGET,
} from "@/lib/phak";
import { SUBJECTS, type Subject } from "@/lib/subjects";
import { Plane, Sparkles, Loader2, BookOpen, Compass, GraduationCap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

type Status = "checking" | "loading" | "ready" | "error";
type Phase = 1 | 2 | 3;

interface GeneratedQuestion {
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string;
  difficulty: "fácil" | "medio" | "difícil";
}

interface BankProgress {
  // Phase 1: PHAK
  phak_chapter_idx: number; // next chapter index to process (0..PHAK_CHAPTERS.length)
  // Phase 2: CIAAC guide
  guide_done: number; // questions generated so far
  // Phase 3: per-subject
  subject_done: Partial<Record<Subject, number>>;
  total_created: number;
  bank_loaded: boolean;
}

const SETTINGS_KEY = "bank_progress_v1";
const LEGACY_PHAK_KEY = "phak_loaded";

const DEFAULT_PROGRESS: BankProgress = {
  phak_chapter_idx: 0,
  guide_done: 0,
  subject_done: {},
  total_created: 0,
  bank_loaded: false,
};

async function loadProgress(userId: string): Promise<BankProgress> {
  // Check legacy phak_loaded flag — if set, skip phase 1
  const [{ data: bank }, { data: legacy }] = await Promise.all([
    supabase.from("app_settings").select("value").eq("user_id", userId).eq("key", SETTINGS_KEY).maybeSingle(),
    supabase.from("app_settings").select("value").eq("user_id", userId).eq("key", LEGACY_PHAK_KEY).maybeSingle(),
  ]);

  if (bank?.value) {
    try {
      return JSON.parse(bank.value) as BankProgress;
    } catch {
      // fall through
    }
  }

  if (legacy?.value === "true") {
    // PHAK already loaded in a prior session — skip phase 1
    return {
      ...DEFAULT_PROGRESS,
      phak_chapter_idx: PHAK_CHAPTERS.length,
      total_created: PHAK_TOTAL_QUESTIONS,
    };
  }

  return { ...DEFAULT_PROGRESS };
}

async function saveProgress(userId: string, progress: BankProgress): Promise<void> {
  await supabase.from("app_settings").upsert(
    {
      user_id: userId,
      key: SETTINGS_KEY,
      value: JSON.stringify(progress),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,key" },
  );
}

const SUBJECT_FOR_PHAK_CHAPTER: Record<number, Subject> = {
  2: "Reglamentación RAB/ICAO",
  3: "Factores Humanos",
  4: "Sistemas de Aeronave",
  5: "Sistemas de Aeronave",
  6: "Sistemas de Aeronave",
  7: "Sistemas de Aeronave",
  8: "Reglamentación RAB/ICAO",
  9: "Performance y Peso",
  10: "Performance y Peso",
  11: "Meteorología",
  12: "Meteorología",
  13: "Procedimientos IFR",
  14: "Reglamentación RAB/ICAO",
  15: "Navegación",
  16: "Factores Humanos",
  17: "Factores Humanos",
};

// Topic seeds to vary the per-subject batches
const SUBJECT_SEEDS: Record<Subject, string[]> = {
  "Meteorología": [
    "frentes y masas de aire", "tormentas y turbulencia", "formación de hielo",
    "METAR y TAF", "vientos y cizalladura", "estabilidad atmosférica",
    "niebla y visibilidad", "altimetría y QNH/QFE",
  ],
  "Navegación": [
    "VOR y radioayudas", "GPS y RNAV/RNP", "cartas aeronáuticas",
    "rumbos, variación y desviación", "triángulo del viento", "navegación a estima",
    "NDB y ADF", "ILS y aproximaciones de precisión",
  ],
  "Reglamentación RAB/ICAO": [
    "anexos OACI 1-19", "licencias y habilitaciones piloto comercial",
    "certificado médico clase 1", "AIP México y NOTAM", "reglas del aire VFR/IFR",
    "responsabilidades del PIC", "mercancías peligrosas", "investigación de accidentes",
  ],
  "Performance y Peso": [
    "centro de gravedad y momento", "MTOW MLW ZFW", "distancias de despegue y aterrizaje",
    "altitud densidad", "V-speeds", "diagramas de carga POH", "alcance y autonomía",
    "techo de servicio y ascenso",
  ],
  "Sistemas de Aeronave": [
    "motor de pistón y magnetos", "turbina y turbohélice", "sistema eléctrico",
    "sistema de combustible", "hidráulico y tren de aterrizaje", "instrumentos giroscópicos",
    "pitot-estática", "presurización y oxígeno", "deshielo y antihielo",
    "aerodinámica básica y pérdida", "sustentación y resistencia", "controles primarios y secundarios",
  ],
  "Comunicaciones": [
    "fraseología OACI estándar", "alfabeto fonético y números", "códigos transponder",
    "MAYDAY y PAN-PAN", "ATIS AWOS y broadcasts", "fallas de comunicación",
    "ATC clearances", "transferencia de control y handoff",
  ],
  "Factores Humanos": [
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
};

export function BankLoaderGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>("checking");
  const [phase, setPhase] = useState<Phase>(1);
  const [progress, setProgress] = useState<BankProgress>(DEFAULT_PROGRESS);
  const [currentLabel, setCurrentLabel] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const startedRef = useRef(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!user || startedRef.current) return;

    (async () => {
      const initial = await loadProgress(user.id);
      setProgress(initial);

      if (initial.bank_loaded) {
        setStatus("ready");
        return;
      }

      startedRef.current = true;
      cancelledRef.current = false;
      setStatus("loading");

      try {
        const current: BankProgress = { ...initial, subject_done: { ...initial.subject_done } };

        // ─── PHASE 1: PHAK ─────────────────────────────────
        setPhase(1);
        for (let i = current.phak_chapter_idx; i < PHAK_CHAPTERS.length; i++) {
          if (cancelledRef.current) return;
          const chapter = PHAK_CHAPTERS[i];
          setCurrentLabel(`Capítulo ${i + 1} de ${PHAK_CHAPTERS.length}: ${chapter.name}`);

          const { data, error } = await supabase.functions.invoke("load-phak-chapter", {
            body: {
              chapter_number: chapter.number,
              chapter_name: chapter.name,
              count: PHAK_QUESTIONS_PER_CHAPTER,
            },
          });
          if (error) throw new Error(error.message);
          const questions: GeneratedQuestion[] = data?.questions ?? [];
          const subject = (data?.subject ??
            SUBJECT_FOR_PHAK_CHAPTER[chapter.number] ??
            "Reglamentación RAB/ICAO") as Subject;

          if (questions.length > 0) {
            await insertQuestions(user.id, subject, questions);
            current.total_created += questions.length;
          }
          current.phak_chapter_idx = i + 1;
          await saveProgress(user.id, current);
          setProgress({ ...current });
        }

        // ─── PHASE 2: Guía CIAAC ──────────────────────────
        setPhase(2);
        while (current.guide_done < CIAAC_GUIDE_TOTAL) {
          if (cancelledRef.current) return;
          const remaining = CIAAC_GUIDE_TOTAL - current.guide_done;
          const batch = Math.min(CIAAC_GUIDE_BATCH_SIZE, remaining);
          const seedSubject = SUBJECTS[
            Math.floor((current.guide_done / CIAAC_GUIDE_BATCH_SIZE)) % SUBJECTS.length
          ] as Subject;
          setCurrentLabel(
            `Guía Oficial CIAAC del Sustentante — ${current.guide_done}/${CIAAC_GUIDE_TOTAL} preguntas`,
          );

          const { data, error } = await supabase.functions.invoke("generate-subject-batch", {
            body: {
              subject: seedSubject,
              count: batch,
              seed_topic: "preguntas tipo guía oficial del sustentante CIAAC, temario completo del piloto comercial México",
              batch_index: Math.floor(current.guide_done / CIAAC_GUIDE_BATCH_SIZE),
            },
          });
          if (error) throw new Error(error.message);
          const questions: GeneratedQuestion[] = data?.questions ?? [];
          if (questions.length > 0) {
            await insertQuestions(user.id, seedSubject, questions);
            current.total_created += questions.length;
            current.guide_done += questions.length;
          } else {
            // safety: avoid infinite loop on empty response
            current.guide_done += batch;
          }
          await saveProgress(user.id, current);
          setProgress({ ...current });
        }

        // ─── PHASE 3: Por materia ──────────────────────────
        setPhase(3);
        const subjectList = SUBJECTS as readonly Subject[];
        for (let s = 0; s < subjectList.length; s++) {
          const subject = subjectList[s];
          const target = SUBJECT_TARGETS[subject] ?? 0;
          let done = current.subject_done[subject] ?? 0;

          while (done < target) {
            if (cancelledRef.current) return;
            const batch = Math.min(SUBJECT_BATCH_SIZE, target - done);
            const seeds = SUBJECT_SEEDS[subject] ?? [];
            const seed = seeds.length > 0
              ? seeds[Math.floor(done / SUBJECT_BATCH_SIZE) % seeds.length]
              : undefined;

            setCurrentLabel(
              `Materia ${s + 1} de ${subjectList.length}: ${subject} — ${done}/${target}`,
            );

            const { data, error } = await supabase.functions.invoke("generate-subject-batch", {
              body: {
                subject,
                count: batch,
                seed_topic: seed,
                batch_index: Math.floor(done / SUBJECT_BATCH_SIZE),
              },
            });
            if (error) throw new Error(error.message);
            const questions: GeneratedQuestion[] = data?.questions ?? [];
            if (questions.length > 0) {
              await insertQuestions(user.id, subject, questions);
              current.total_created += questions.length;
              done += questions.length;
            } else {
              done += batch; // avoid infinite loop
            }
            current.subject_done[subject] = done;
            await saveProgress(user.id, current);
            setProgress({ ...current });
          }
        }

        // ─── DONE ──────────────────────────────────────────
        current.bank_loaded = true;
        await saveProgress(user.id, current);
        // Keep legacy flag for backward compat
        await supabase.from("app_settings").upsert(
          {
            user_id: user.id,
            key: LEGACY_PHAK_KEY,
            value: "true",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,key" },
        );

        toast.success(`¡Banco listo! ${current.total_created.toLocaleString("es-MX")} preguntas cargadas.`);
        setStatus("ready");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error desconocido";
        console.error("Bank load error:", e);
        setErrorMsg(msg);
        setStatus("error");
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [user]);

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-sky">
        <div className="animate-pulse text-muted-foreground">Cargando…</div>
      </div>
    );
  }

  if (status === "ready") return <>{children}</>;

  if (status === "error") {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-hero text-primary-foreground p-6">
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl font-bold">Algo salió mal</h1>
          <p className="mt-2 text-sm text-primary-foreground/70">
            Llevas {progress.total_created.toLocaleString("es-MX")} preguntas generadas.
            Tu progreso está guardado.
          </p>
          <p className="mt-3 text-primary-foreground/80 text-xs">{errorMsg}</p>
          <button
            onClick={() => {
              startedRef.current = false;
              setStatus("checking");
              setErrorMsg(null);
            }}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-white text-primary px-4 py-2 text-sm font-semibold"
          >
            Reanudar
          </button>
        </div>
      </div>
    );
  }

  // Loading screen
  const globalPct = Math.min(100, Math.round((progress.total_created / BANK_TOTAL_TARGET) * 100));

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-hero text-primary-foreground p-6 relative overflow-hidden">
      <div className="absolute -right-32 -bottom-32 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

      <div className="relative max-w-xl w-full text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/15 backdrop-blur mb-6">
          <Plane className="h-8 w-8 animate-pulse" />
        </div>

        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
          Preparando tu banco de preguntas
        </h1>
        <p className="mt-3 text-primary-foreground/80 text-sm">
          Construyendo más de {BANK_TOTAL_TARGET.toLocaleString("es-MX")} preguntas estilo CIAAC.
        </p>

        {/* Phase indicators */}
        <div className="mt-6 grid grid-cols-3 gap-2 text-xs">
          <PhaseChip icon={<BookOpen className="h-3.5 w-3.5" />} label="PHAK" active={phase === 1} done={phase > 1} />
          <PhaseChip icon={<Compass className="h-3.5 w-3.5" />} label="Guía CIAAC" active={phase === 2} done={phase > 2} />
          <PhaseChip icon={<GraduationCap className="h-3.5 w-3.5" />} label="Por materia" active={phase === 3} done={false} />
        </div>

        {/* Current phase card */}
        <div className="mt-6 rounded-2xl bg-white/10 backdrop-blur border border-white/20 p-6 text-left">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary-foreground/70 font-medium">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {phase === 1 && "Fase 1 — PHAK"}
            {phase === 2 && "Fase 2 — Guía Oficial CIAAC"}
            {phase === 3 && "Fase 3 — Generación por materia"}
          </div>
          <div className="mt-2 font-display text-base md:text-lg font-semibold leading-snug">
            {currentLabel || "Iniciando…"}
          </div>

          <PhaseDetail phase={phase} progress={progress} />
        </div>

        {/* Global progress */}
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

        <div className="mt-6 inline-flex items-start gap-2 rounded-2xl bg-white/10 backdrop-blur px-4 py-3 text-xs text-left max-w-md">
          <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            <strong>Solo ocurre una vez.</strong> Esto puede tardar 15-25 minutos.
            Ve por un café — cuando regreses tendrás más de 4,000 preguntas listas para estudiar.
            Tu progreso se guarda automáticamente.
          </span>
        </div>
      </div>
    </div>
  );
}

function PhaseChip({ icon, label, active, done }: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  done: boolean;
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

function PhaseDetail({ phase, progress }: { phase: Phase; progress: BankProgress }) {
  if (phase === 1) {
    const pct = Math.round((progress.phak_chapter_idx / PHAK_CHAPTERS.length) * 100);
    return (
      <div className="mt-3">
        <Progress value={pct} className="h-1.5 bg-white/20" />
        <div className="mt-1.5 text-xs text-primary-foreground/70">
          {progress.phak_chapter_idx} / {PHAK_CHAPTERS.length} capítulos
        </div>
      </div>
    );
  }
  if (phase === 2) {
    const pct = Math.round((progress.guide_done / CIAAC_GUIDE_TOTAL) * 100);
    return (
      <div className="mt-3">
        <Progress value={pct} className="h-1.5 bg-white/20" />
        <div className="mt-1.5 text-xs text-primary-foreground/70">
          {progress.guide_done} / {CIAAC_GUIDE_TOTAL} preguntas
        </div>
      </div>
    );
  }
  const subjectDoneTotal = Object.values(progress.subject_done).reduce(
    (a: number, b) => a + (b ?? 0), 0,
  );
  const pct = Math.round((subjectDoneTotal / PHASE3_TOTAL) * 100);
  return (
    <div className="mt-3">
      <Progress value={pct} className="h-1.5 bg-white/20" />
      <div className="mt-1.5 text-xs text-primary-foreground/70">
        {subjectDoneTotal.toLocaleString("es-MX")} / {PHASE3_TOTAL.toLocaleString("es-MX")} preguntas
      </div>
    </div>
  );
}

async function insertQuestions(
  userId: string,
  subject: Subject,
  questions: GeneratedQuestion[],
): Promise<void> {
  const rows = questions.map((q) => ({
    user_id: userId,
    document_id: null,
    subject,
    question_text: q.question_text,
    options: q.options,
    correct_index: q.correct_index,
    explanation: q.explanation,
    difficulty: q.difficulty,
  }));
  const { error } = await supabase.from("questions").insert(rows);
  if (error) throw error;
}
