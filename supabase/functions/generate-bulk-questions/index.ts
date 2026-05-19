// Generates a batch of CIAAC-style questions for a given topic/source/subject.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUBJECTS = [
  "Meteorología","Navegación Aérea","Reglamentación RAB / Legislación Aeronáutica",
  "Performance y Peso y Balance","Sistemas de Aeronave","Comunicaciones y ATC",
  "Factores Humanos y Fisiología","Procedimientos IFR","Aerodinámica y Principios de Vuelo",
  "Operaciones Aeronáuticas","Espacio Aéreo","Reglamentación OACI / Anexos",
];

interface Body {
  topic: string;          // descripción específica del tema
  source: string;         // tag a guardar en source
  subject?: string;       // si se fija, todas las preguntas usan esta materia
  autoSubject?: boolean;  // si true, IA elige materia por pregunta
  count: number;          // cuántas preguntas (≤ 10 recomendado)
  avoidSamples?: string[]; // primeras frases de preguntas existentes para evitar duplicados
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { topic, source, subject, autoSubject, count, avoidSamples } = await req.json() as Body;
    if (!topic || !source || !count) {
      return new Response(JSON.stringify({ error: "Faltan parámetros" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY no configurado");

    const subjEnum = autoSubject
      ? `Asigna a cada pregunta una de estas materias EXACTAS: ${SUBJECTS.join(" | ")}.`
      : `Materia fija para todas: "${subject}". Devuelve ese mismo string en el campo subject.`;

    const avoid = (avoidSamples ?? []).slice(0, 40).map((s, i) => `${i+1}. ${s}`).join("\n");

    const sys = `Eres experto en aviación civil y en el examen teórico CIAAC para Piloto Comercial en México.
Generas preguntas de opción múltiple REALISTAS, en español, con vocabulario y dificultad estilo CIAAC.
Cada pregunta: 4 opciones, SOLO UNA correcta, explicación clara y dificultad ('fácil','medio','difícil').
Distribución de dificultad objetivo: 30% fácil, 50% medio, 20% difícil.
Incluye SIEMPRE en 'reference' la fuente específica (ej. "RAB Art. 12", "Anexo 1 OACI §2.3", "LAC Art. 5", "pilotinstitute.com/blog/...").
${subjEnum}`;

    const user = `Tema: ${topic}
Genera ${count} preguntas NUEVAS sobre este tema. Evita repetir preguntas similares a estas (si las hay):
${avoid || "(no hay muestras)"}

Devuelve SOLO mediante la herramienta create_questions.`;

    const questionItem: Record<string, unknown> = {
      type: "object",
      properties: {
        question_text: { type: "string" },
        options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
        correct_index: { type: "integer", minimum: 0, maximum: 3 },
        explanation: { type: "string" },
        difficulty: { type: "string", enum: ["fácil","medio","difícil"] },
        reference: { type: "string" },
        ...(autoSubject ? { subject: { type: "string", enum: SUBJECTS } } : {}),
      },
      required: autoSubject
        ? ["question_text","options","correct_index","explanation","difficulty","reference","subject"]
        : ["question_text","options","correct_index","explanation","difficulty","reference"],
      additionalProperties: false,
    };

    const tools = [{
      type: "function",
      function: {
        name: "create_questions",
        parameters: {
          type: "object",
          properties: { questions: { type: "array", minItems: 1, items: questionItem } },
          required: ["questions"], additionalProperties: false,
        },
      },
    }];

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        tools, tool_choice: { type: "function", function: { name: "create_questions" } },
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      return new Response(JSON.stringify({ error: `IA ${r.status}: ${t.slice(0,200)}` }), {
        status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await r.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) throw new Error("Sin respuesta de la IA");
    const args = JSON.parse(tc.function.arguments);
    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
