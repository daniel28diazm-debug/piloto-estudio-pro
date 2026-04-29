import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PHAK_CHAPTERS, PHAK_TOTAL_QUESTIONS } from "@/lib/phak";
import type { Subject } from "@/lib/subjects";
import { Plane, Sparkles, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

type Status = "checking" | "loading" | "ready" | "error";

interface GeneratedQuestion {
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string;
  difficulty: "fácil" | "medio" | "difícil";
}

export function PhakLoaderGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>("checking");
  const [chapterIdx, setChapterIdx] = useState(0);
  const [questionsCreated, setQuestionsCreated] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!user || startedRef.current) return;

    (async () => {
      const { data: setting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("user_id", user.id)
        .eq("key", "phak_loaded")
        .maybeSingle();

      if (setting?.value === "true") {
        setStatus("ready");
        return;
      }

      startedRef.current = true;
      setStatus("loading");

      try {
        for (let i = 0; i < PHAK_CHAPTERS.length; i++) {
          const chapter = PHAK_CHAPTERS[i];
          setChapterIdx(i);

          const { data, error } = await supabase.functions.invoke(
            "load-phak-chapter",
            {
              body: {
                chapter_number: chapter.number,
                chapter_name: chapter.name,
                count: 40,
              },
            },
          );

          if (error) throw new Error(error.message);
          const questions: GeneratedQuestion[] = data?.questions ?? [];
          const subject = (data?.subject ?? "Reglamentación RAB/ICAO") as Subject;

          if (questions.length > 0) {
            const rows = questions.map((q) => ({
              user_id: user.id,
              document_id: null,
              subject,
              question_text: q.question_text,
              options: q.options,
              correct_index: q.correct_index,
              explanation: q.explanation,
              difficulty: q.difficulty,
            }));
            const { error: insertError } = await supabase.from("questions").insert(rows);
            if (insertError) throw insertError;
            setQuestionsCreated((prev) => prev + questions.length);
          }
        }

        await supabase.from("app_settings").upsert(
          {
            user_id: user.id,
            key: "phak_loaded",
            value: "true",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,key" },
        );

        toast.success("¡Tu app está lista! 640 preguntas del PHAK cargadas.");
        setStatus("ready");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error desconocido";
        console.error("PHAK load error:", e);
        setErrorMsg(msg);
        setStatus("error");
      }
    })();
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
          <p className="mt-3 text-primary-foreground/80 text-sm">{errorMsg}</p>
          <button
            onClick={() => {
              startedRef.current = false;
              setStatus("checking");
              setChapterIdx(0);
              setQuestionsCreated(0);
              setErrorMsg(null);
            }}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-white text-primary px-4 py-2 text-sm font-semibold"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Loading screen
  const chapter = PHAK_CHAPTERS[chapterIdx];
  const pct = Math.min(100, Math.round((questionsCreated / PHAK_TOTAL_QUESTIONS) * 100));

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-hero text-primary-foreground p-6 relative overflow-hidden">
      <div className="absolute -right-32 -bottom-32 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

      <div className="relative max-w-lg w-full text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/15 backdrop-blur mb-6">
          <Plane className="h-8 w-8 animate-pulse" />
        </div>

        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
          Preparando tu app
        </h1>
        <p className="mt-3 text-primary-foreground/80">
          Cargando el Pilot's Handbook of Aeronautical Knowledge (FAA-H-8083-25B).
        </p>

        <div className="mt-8 rounded-2xl bg-white/10 backdrop-blur border border-white/20 p-6">
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <Loader2 className="h-4 w-4 animate-spin" />
            Capítulo {chapterIdx + 1} de {PHAK_CHAPTERS.length}
          </div>
          <div className="mt-2 font-display text-xl font-semibold">{chapter.name}</div>

          <div className="mt-6">
            <Progress value={pct} className="h-2 bg-white/20" />
            <div className="mt-2 flex items-center justify-between text-xs text-primary-foreground/80">
              <span>{questionsCreated} / {PHAK_TOTAL_QUESTIONS} preguntas</span>
              <span>{pct}%</span>
            </div>
          </div>
        </div>

        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-4 py-1.5 text-xs">
          <Sparkles className="h-3.5 w-3.5" />
          Esto solo ocurre una vez. En unos minutos tendrás 640 preguntas listas para estudiar.
        </div>
      </div>
    </div>
  );
}
