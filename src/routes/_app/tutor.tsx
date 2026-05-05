import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Send, MessagesSquare, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/tutor")({
  component: Tutor,
});

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Explícame VOR/DME con un ejemplo",
  "¿Qué es METAR y cómo lo interpreto?",
  "Diferencia entre RAB y RAC",
  "Procedimiento de aproximación ILS paso a paso",
];

function Tutor() {
  const { user, session } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load history
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("role, content")
        .order("created_at")
        .limit(50);
      setMessages(((data ?? []) as Msg[]).filter((m) => m.role !== "system" as unknown as Msg["role"]));
    })();
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || streaming) return;

    const userMsg: Msg = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    // Persist user msg
    if (user) {
      await supabase.from("chat_messages").insert({
        user_id: user.id,
        role: "user",
        content,
      });
    }

    const callTutor = async (attempt: number): Promise<Response> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tutor-chat`;
        const r = await fetch(url, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ messages: newMessages }),
        });
        return r;
      } catch (err) {
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 800));
          return callTutor(1);
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    try {
      const resp = await callTutor(0);

      if (!resp.ok) {
        let detail = "";
        try {
          const j = await resp.json();
          detail = j?.error || j?.message || "";
        } catch {
          try { detail = await resp.text(); } catch { /* noop */ }
        }
        if (resp.status === 429) toast.error("Demasiadas solicitudes. Espera un momento.");
        else if (resp.status === 402) toast.error("Sin créditos de IA. Agrega créditos en Lovable Cloud.");
        else if (resp.status === 401) toast.error("No autorizado. Vuelve a iniciar sesión.");
        else toast.error(`Error del tutor IA (${resp.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
        setStreaming(false);
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      let done = false;
      while (!done) {
        const { value, done: rd } = await reader.read();
        if (rd) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const delta: string | undefined = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantText += delta;
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", content: assistantText };
                return copy;
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Persist assistant msg
      if (user && assistantText) {
        await supabase.from("chat_messages").insert({
          user_id: user.id,
          role: "assistant",
          content: assistantText,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error de conexión";
      const isAbort = e instanceof DOMException && e.name === "AbortError";
      toast.error(isAbort ? "El tutor IA tardó demasiado (timeout 30s). Intenta de nuevo." : `Error del tutor IA: ${msg}`);
      setMessages((m) => m.filter((x, i) => !(i === m.length - 1 && x.role === "assistant" && x.content === "")));
    } finally {
      setStreaming(false);
    }
  };

  const clearChat = async () => {
    if (!confirm("¿Borrar conversación?")) return;
    setMessages([]);
    if (user) await supabase.from("chat_messages").delete().eq("user_id", user.id);
  };

  return (
    <div className="flex flex-col h-screen md:h-[calc(100vh-0px)] max-w-3xl mx-auto">
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-runway text-primary-foreground">
            <MessagesSquare className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display font-bold">Tutor IA</h1>
            <p className="text-xs text-muted-foreground">Experto en aviación civil mexicana</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearChat}>Limpiar</Button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4 pb-32 md:pb-6">
        {messages.length === 0 && (
          <div className="max-w-md mx-auto text-center mt-12">
            <Sparkles className="h-10 w-10 text-primary mx-auto mb-3" />
            <h2 className="font-display text-xl font-bold">¿En qué te ayudo, piloto?</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Pregúntame lo que sea sobre el examen CIAAC, RAB, ICAO o procedimientos.
            </p>
            <div className="mt-6 grid gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left rounded-lg border bg-card hover:bg-secondary px-4 py-3 text-sm transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <Card
              className={`max-w-[85%] px-4 py-3 ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card"
              }`}
            >
              <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.content || (streaming ? "…" : "")}</div>
            </Card>
          </div>
        ))}
        {streaming && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <Card className="px-4 py-3"><Loader2 className="h-4 w-4 animate-spin" /></Card>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="border-t bg-background p-4 fixed md:static bottom-12 md:bottom-0 inset-x-0 md:inset-auto"
      >
        <div className="flex gap-2 max-w-3xl mx-auto">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu pregunta…"
            className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={streaming}
          />
          <Button type="submit" disabled={streaming || !input.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
