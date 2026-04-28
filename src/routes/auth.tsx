import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plane } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await signIn(String(fd.get("email")), String(fd.get("password")));
    setBusy(false);
    if (error) toast.error(error.message === "Invalid login credentials" ? "Credenciales inválidas" : error.message);
    else toast.success("¡Bienvenido!");
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await signUp(String(fd.get("email")), String(fd.get("password")), String(fd.get("fullName")));
    setBusy(false);
    if (error) {
      if (error.message.includes("already")) toast.error("Este correo ya está registrado");
      else toast.error(error.message);
    } else toast.success("¡Cuenta creada! Iniciando sesión…");
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex relative bg-gradient-hero text-primary-foreground p-12 flex-col justify-between overflow-hidden">
        <Link to="/" className="flex items-center gap-2 relative z-10">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 backdrop-blur">
            <Plane className="h-5 w-5" />
          </div>
          <span className="font-display font-semibold">CIAAC Pilot</span>
        </Link>
        <div className="relative z-10">
          <h2 className="font-display text-4xl font-bold leading-tight">
            Tu copiloto para aprobar el examen teórico.
          </h2>
          <p className="mt-4 text-primary-foreground/80">
            Estudia con materiales reales del examen CIAAC, generación de preguntas con IA y un tutor disponible 24/7.
          </p>
        </div>
        <div className="absolute -right-40 -bottom-40 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-6 md:p-12 bg-background">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-2xl font-bold mb-1">Comencemos</h1>
          <p className="text-sm text-muted-foreground mb-6">Crea tu cuenta o inicia sesión.</p>

          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Iniciar sesión</TabsTrigger>
              <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="email-in">Correo</Label>
                  <Input id="email-in" name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pw-in">Contraseña</Label>
                  <Input id="pw-in" name="password" type="password" required minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Entrando…" : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre completo</Label>
                  <Input id="name" name="fullName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-up">Correo</Label>
                  <Input id="email-up" name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pw-up">Contraseña</Label>
                  <Input id="pw-up" name="password" type="password" required minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Creando…" : "Crear cuenta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
