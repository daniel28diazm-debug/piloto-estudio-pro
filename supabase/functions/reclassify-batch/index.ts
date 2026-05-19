// Reclassifies a batch of questions into one of the 12 CIAAC subjects.
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

interface InQ { id: string; question_text: string; options?: string[]; explanation?: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { questions } = await req.json() as { questions: InQ[] };
    if (!Array.isArray(questions) || questions.length === 0) {
      return new Response(JSON.stringify({ error: "Falta 'questions'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY no configurado");

    const items = questions.slice(0, 60).map((q, i) => {
      const opts = Array.isArray(q.options) ? ` | Opciones: ${q.options.join(" / ")}` : "";
      const exp = q.explanation ? ` | Explic: ${String(q.explanation).slice(0, 200)}` : "";
      return `${i + 1}. [id=${q.id}] ${q.question_text}${opts}${exp}`;
    }).join("\n");

    const sys = `Eres un clasificador experto en aviación civil. Para cada pregunta, asigna la materia CORRECTA del examen CIAAC. Usa SOLO estos nombres EXACTOS: ${SUBJECTS.join(" | ")}. Analiza el contenido real (ángulo de ataque/sustentación → Aerodinámica; METAR/nubes → Meteorología; ATC/fraseología → Comunicaciones y ATC; RAB → Reglamentación RAB; OACI/Anexos → Reglamentación OACI; pesos/CG → Performance; sistemas eléctricos/hidráulicos/motor → Sistemas; IFR/aproximaciones → Procedimientos IFR; clases de espacio → Espacio Aéreo; CRM/fisiología/hipoxia → Factores Humanos; operaciones generales → Operaciones; cartas/rumbos/VOR/GPS → Navegación).`;

    const tools = [{
      type: "function",
      function: {
        name: "classify_batch",
        description: "Devuelve la materia correcta para cada pregunta",
        parameters: {
          type: "object",
          properties: {
            results: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  subject: { type: "string", enum: SUBJECTS },
                },
                required: ["id", "subject"],
                additionalProperties: false,
              },
            },
          },
          required: ["results"],
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
          { role: "user", content: `Clasifica cada pregunta y devuelve el id exacto con su materia:\n\n${items}` },
        ],
        tools, tool_choice: { type: "function", function: { name: "classify_batch" } },
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error("AI error", r.status, err);
      return new Response(JSON.stringify({ error: `IA ${r.status}: ${err.slice(0, 200)}` }), {
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
