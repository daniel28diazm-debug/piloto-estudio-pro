import { Link, useLocation, useNavigate, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  BookOpen,
  Layers,
  Timer,
  MessagesSquare,
  TrendingUp,
  LogOut,
  Plane,
  GraduationCap,
  Moon,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { BankLoaderGate } from "@/components/PhakLoaderGate";

import { Sparkles } from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { to: "/library", label: "Biblioteca", icon: BookOpen },
  { to: "/study", label: "Estudio", icon: GraduationCap },
  { to: "/flashcards", label: "Flashcards", icon: Layers },
  { to: "/exam", label: "Simulador", icon: Timer },
  { to: "/tutor", label: "Tutor IA", icon: MessagesSquare },
  { to: "/progress", label: "Progreso", icon: TrendingUp },
  { to: "/admin/reclassify", label: "Reclasificar", icon: Sparkles },
  { to: "/admin/generate", label: "Generar", icon: Sparkles },
] as const;

export function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [dark, setDark] = useState<boolean>(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  // Restore dark-mode preference
  useEffect(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("theme") : null;
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setDark(true);
    }
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch { /* noop */ }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-sky">
        <div className="animate-pulse text-muted-foreground">Cargando…</div>
      </div>
    );
  }

  return (
    <BankLoaderGate>
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 px-6 py-6 border-b border-sidebar-border">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Plane className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display font-semibold tracking-tight">CIAAC Pilot</div>
            <div className="text-xs text-sidebar-foreground/60">Examen teórico</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => {
            const active = location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-glow"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-sidebar-border">
          <div className="px-3 pb-3 text-xs text-sidebar-foreground/60 truncate">{user.email}</div>
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground mb-1"
            onClick={toggleDark}
          >
            {dark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
            {dark ? "Modo claro" : "Modo oscuro"}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-sidebar text-sidebar-foreground px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plane className="h-5 w-5" />
          <span className="font-display font-semibold">CIAAC Pilot</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={toggleDark} className="text-sidebar-foreground" aria-label="Cambiar tema">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => signOut()} className="text-sidebar-foreground">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <main className="flex-1 md:ml-0 mt-12 md:mt-0">
        <Outlet />
        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar text-sidebar-foreground border-t border-sidebar-border grid grid-cols-7">
          {NAV.map((item) => {
            const active = location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 text-[10px]",
                  active ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/60",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label.split(" ")[0]}
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
    </BankLoaderGate>
  );
}
