import { Outlet, createRootRoute, HeadContent, Scripts, Link } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-sky px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta ruta no existe o fue movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CIAAC Pilot — Estudia para el examen teórico de Piloto Comercial" },
      {
        name: "description",
        content:
          "App de estudio para el examen teórico CIAAC de Piloto Comercial en México: biblioteca, preguntas IA, flashcards, simulador y tutor.",
      },
      { name: "author", content: "CIAAC Pilot" },
      { property: "og:title", content: "CIAAC Pilot — Estudia para el examen teórico de Piloto Comercial" },
      { property: "og:description", content: "Estudia para el examen teórico de piloto comercial CIAAC con esta app en español." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "CIAAC Pilot — Estudia para el examen teórico de Piloto Comercial" },
      { name: "description", content: "Estudia para el examen teórico de piloto comercial CIAAC con esta app en español." },
      { name: "twitter:description", content: "Estudia para el examen teórico de piloto comercial CIAAC con esta app en español." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/944fbed9-c790-42bb-83a4-820f3e4cb2b6/id-preview-4f934e9d--51274066-6c8d-401a-aff4-50f08aa302f0.lovable.app-1777343756487.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/944fbed9-c790-42bb-83a4-820f3e4cb2b6/id-preview-4f934e9d--51274066-6c8d-401a-aff4-50f08aa302f0.lovable.app-1777343756487.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}
