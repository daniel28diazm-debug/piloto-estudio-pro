import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Plane, Sparkles, Layers, Timer, MessagesSquare, TrendingUp, BookOpen } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-hero text-primary-foreground">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)",
          backgroundSize: "60px 60px, 90px 90px",
        }} />
        <div className="relative mx-auto max-w-6xl px-6 pt-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 backdrop-blur">
              <Plane className="h-5 w-5" />
            </div>
            <span className="font-display font-semibold tracking-tight">CIAAC Pilot</span>
          </div>
          <Link to="/auth">
            <Button variant="secondary" size="sm">Entrar</Button>
          </Link>
        </div>

        <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-28 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-4 py-1.5 text-xs font-medium border border-white/20">
            <Sparkles className="h-3.5 w-3.5" />
            Preparación con inteligencia artificial
          </div>
          <h1 className="mt-6 font-display text-5xl md:text-7xl font-bold tracking-tight max-w-4xl mx-auto leading-[1.05]">
            Aprueba tu examen teórico CIAAC
          </h1>
          <p className="mt-6 text-lg md:text-xl text-primary-foreground/80 max-w-2xl mx-auto">
            Sube tus apuntes, genera preguntas estilo CIAAC con IA, repasa con flashcards y simula el examen oficial de Piloto Comercial en México.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" variant="secondary" className="text-primary font-semibold shadow-elevated">
                Comenzar gratis
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="ghost" className="text-primary-foreground hover:bg-white/10">
                Ver funciones
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold">Todo lo que necesitas para el examen</h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Diseñado específicamente para el examen teórico CIAAC de aviación civil mexicana.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: BookOpen, title: "Biblioteca por materia", desc: "Sube PDFs y los organizamos por las 12 materias del examen CIAAC." },
            { icon: Sparkles, title: "Preguntas con IA", desc: "Genera 20 preguntas opción múltiple desde cualquier documento." },
            { icon: Layers, title: "Flashcards SRS", desc: "Repaso espaciado SM-2 para memorizar a largo plazo." },
            { icon: Timer, title: "Simulador de examen", desc: "Examen cronometrado con explicación de errores." },
            { icon: MessagesSquare, title: "Tutor IA en español", desc: "Pregúntale lo que sea sobre RAB, ICAO o procedimientos IFR." },
            { icon: TrendingUp, title: "Progreso detallado", desc: "Identifica tus materias débiles con gráficas claras." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border bg-card p-6 shadow-card hover:shadow-elevated transition-shadow">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-runway text-primary-foreground mb-4">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-display font-semibold text-lg">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
        Hecho para futuros pilotos comerciales mexicanos.
      </footer>
    </div>
  );
}
