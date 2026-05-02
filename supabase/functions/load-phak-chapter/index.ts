// Generate up to 10 CIAAC-style questions for a single PHAK chapter using Lovable AI.
// Small batches keep the call well under the edge timeout (120 s ceiling).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GeneratedQuestion {
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string;
  difficulty: "fácil" | "medio" | "difícil";
}

// 12-materia mapping (must match src/lib/subjects.ts).
const SUBJECT_FOR_CHAPTER: Record<number, string> = {
  2: "Reglamentación RAB / Legislación Aeronáutica",
  3: "Factores Humanos y Fisiología",
  4: "Aerodinámica y Principios de Vuelo",
  5: "Aerodinámica y Principios de Vuelo",
  6: "Sistemas de Aeronave",
  7: "Sistemas de Aeronave",
  8: "Reglamentación RAB / Legislación Aeronáutica",
  9: "Performance y Peso y Balance",
  10: "Performance y Peso y Balance",
  11: "Meteorología",
  12: "Meteorología",
  13: "Operaciones Aeronáuticas",
  14: "Espacio Aéreo",
  15: "Navegación Aérea",
  16: "Factores Humanos y Fisiología",
  17: "Factores Humanos y Fisiología",
};

const MAX_COUNT = 10;
const AI_TIMEOUT_MS = 110_000; // < 120 s edge ceiling

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const chapter_number: number = body.chapter_number;
    const chapter_name: string = body.chapter_name;
    const requested = Number(body.count ?? MAX_COUNT);
    const count = Math.min(MAX_COUNT, Math.max(1, requested));

    if (!chapter_number || !chapter_name) {
      return json({ error: "Faltan parámetros" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY no configurado");

    const subject = SUBJECT_FOR_CHAPTER[chapter_number] ?? "Reglamentación RAB / Legislación Aeronáutica";

    const systemPrompt = `Eres un instructor experto en aviación civil mexicana y en el examen teórico CIAAC para Piloto Comercial.
Conoces a fondo el "Pilot's Handbook of Aeronautical Knowledge" (FAA-H-8083-25B).
Generas preguntas de opción múltiple realistas en español con el estilo, vocabulario y dificultad del examen oficial CIAAC.
Cada pregunta tiene exactamente 4 opciones, solo UNA correcta, una explicación breve clara y citando el concepto, y una dificultad ('fácil', 'medio' o 'difícil').
Mezcla niveles: ~30% fácil, 50% medio, 20% difícil.`;

    const userPrompt = `Genera exactamente ${count} preguntas tipo CIAAC sobre el contenido del PHAK Capítulo ${chapter_number}: "${chapter_name}".
Las preguntas deben corresponder al material del capítulo y al programa CIAAC en la materia "${subject}".
Devuelve SOLO mediante la herramienta create_questions.`;

    const tools = [{
      type: "function",
      function: {
        name: "create_questions",
        description: "Devuelve las preguntas generadas",
        parameters: {
          type: "object",
          properties: {
            questions: {
              type: "array", minItems: 1,
              items: {
                type: "object",
                properties: {
                  question_text: { type: "string" },
                  options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                  correct_index: { type: "integer", minimum: 0, maximum: 3 },
                  explanation: { type: "string" },
                  difficulty: { type: "string", enum: ["fácil", "medio", "difícil"] },
                },
                required: ["question_text", "options", "correct_index", "explanation", "difficulty"],
                additionalProperties: false,
              },
            },
          },
          required: ["questions"], additionalProperties: false,
        },
      },
    }];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    let aiResp: Response;
    try {
      aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools,
          tool_choice: { type: "function", function: { name: "create_questions" } },
        }),
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!aiResp.ok) {
      if (aiResp.status === 429) return json({ error: "Demasiadas solicitudes" }, 429);
      if (aiResp.status === 402) return json({ error: "Sin créditos de IA" }, 402);
      const errText = await aiResp.text();
      console.error("AI error:", aiResp.status, errText);
      return json({ error: "Error de IA" }, 500);
    }

    const data = await aiResp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return json({ error: "La IA no devolvió preguntas" }, 500);

    const args = JSON.parse(toolCall.function.arguments);
    const questions: GeneratedQuestion[] = args.questions ?? [];

    return json({ questions, subject });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    console.error("load-phak-chapter error:", msg);
    const aborted = msg.toLowerCase().includes("abort");
    return json({ error: aborted ? "Tiempo de espera excedido" : msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
