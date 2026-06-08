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

  // Top 5 nav items for mobile bottom bar
  const PRIMARY_NAV = NAV.slice(0, 5);

  return (
    <BankLoaderGate>
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 flex-col ios-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3 px-6 py-7 border-b border-white/10">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#1e6fd9] text-white shadow-lg">
            <Plane className="h-6 w-6" />
          </div>
          <div>
            <div className="font-display text-lg font-semibold tracking-tight">CIAAC Pilot</div>
            <div className="text-[11px] text-white/50 tracking-wide uppercase">Examen teórico</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-5 space-y-1">
          {NAV.map((item, idx) => {
            const active = location.pathname.startsWith(item.to);
            const Icon = item.icon;
            // subtle separator before admin items
            const showSep = item.to.startsWith("/admin") && !NAV[idx - 1]?.to.startsWith("/admin");
            return (
              <div key={item.to}>
                {showSep && <div className="my-2 mx-3 border-t border-white/10" />}
                <Link
                  to={item.to}
                  className={cn(
                    "relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium ios-smooth",
                    active
                      ? "bg-[rgba(59,130,246,0.2)] text-white"
                      : "text-white/70 hover:bg-white/[0.08] hover:text-white",
                  )}
                  style={active ? { boxShadow: "inset 3px 0 0 #3B82F6" } : undefined}
                >
                  <Icon className="h-[18px] w-[18px]" style={{ color: active ? "#3B82F6" : undefined, opacity: active ? 1 : 0.7 }} />
                  <span>{item.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-white/10">
          <div className="px-3 pb-3 text-xs text-white/50 truncate">{user.email}</div>
          <Button
            variant="ghost"
            className="w-full justify-start text-white/70 hover:bg-white/[0.08] hover:text-white mb-1 rounded-[10px]"
            onClick={toggleDark}
          >
            {dark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
            {dark ? "Modo claro" : "Modo oscuro"}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-white/70 hover:bg-white/[0.08] hover:text-white rounded-[10px]"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 ios-sidebar text-sidebar-foreground px-4 py-3 flex items-center justify-between backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#1e6fd9]">
            <Plane className="h-4 w-4 text-white" />
          </div>
          <span className="font-display font-semibold">CIAAC Pilot</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={toggleDark} className="text-white/80 hover:bg-white/10" aria-label="Cambiar tema">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => signOut()} className="text-white/80 hover:bg-white/10">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <main className="flex-1 md:ml-0 mt-14 md:mt-0">
        <Outlet />
        {/* Mobile bottom nav (iOS tab bar style) */}
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-black/5 grid grid-cols-5"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {PRIMARY_NAV.map((item) => {
            const active = location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex flex-col items-center gap-0.5 py-2 text-[10px] ios-smooth"
                style={{ color: active ? "#3B82F6" : "#8E8E93" }}
              >
                <Icon className="h-[22px] w-[22px]" />
                <span className="font-medium">{item.label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
    </BankLoaderGate>
  );
}
