// Classify a PDF excerpt into one of the 12 CIAAC subjects using Lovable AI
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUBJECTS = [
  "Meteorología",
  "Navegación Aérea",
  "Reglamentación RAB / Legislación Aeronáutica",
  "Performance y Peso y Balance",
  "Sistemas de Aeronave",
  "Comunicaciones y ATC",
  "Factores Humanos y Fisiología",
  "Procedimientos IFR",
  "Aerodinámica y Principios de Vuelo",
  "Operaciones Aeronáuticas",
  "Espacio Aéreo",
  "Reglamentación OACI / Anexos",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { text } = await req.json();
    if (!text) {
      return new Response(JSON.stringify({ error: "Falta 'text'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY no configurado");

    const trimmed = String(text).slice(0, 12000);

    const sys = `Eres un clasificador experto en aviación civil. Tu tarea: dado un texto de un PDF, decir a qué materia(s) del examen CIAAC pertenece. Materias válidas (usa los nombres EXACTOS): ${SUBJECTS.join(" | ")}. Devuelve la materia principal y, si el texto cubre más de una materia con peso significativo (>20%), enuméralas todas en orden de relevancia con su confianza 0-1.`;

    const tools = [{
      type: "function",
      function: {
        name: "classify",
        description: "Clasifica el PDF",
        parameters: {
          type: "object",
          properties: {
            primary: { type: "string", enum: SUBJECTS },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            secondary: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  subject: { type: "string", enum: SUBJECTS },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                },
                required: ["subject", "confidence"],
                additionalProperties: false,
              },
            },
            reasoning: { type: "string" },
          },
          required: ["primary", "confidence", "secondary", "reasoning"],
          additionalProperties: false,
        },
      },
    }];

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Clasifica este texto:\n\n---\n${trimmed}\n---` },
        ],
        tools, tool_choice: { type: "function", function: { name: "classify" } },
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error("AI error", r.status, err);
      return new Response(JSON.stringify({ error: `IA: ${r.status}` }), {
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
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
