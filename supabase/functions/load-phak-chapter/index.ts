// Generate 40 CIAAC-style questions for a single PHAK chapter using Lovable AI.
// We don't parse the PHAK PDF on the edge runtime (too large/slow); instead we
// rely on Gemini's knowledge of the FAA PHAK (FAA-H-8083-25B) and prompt it to
// produce questions tied to the chapter topic and the CIAAC exam style.

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

const SUBJECT_FOR_CHAPTER: Record<number, string> = {
  2: "Reglamentación RAB/ICAO",
  3: "Factores Humanos",
  4: "Sistemas de Aeronave",
  5: "Sistemas de Aeronave",
  6: "Sistemas de Aeronave",
  7: "Sistemas de Aeronave",
  8: "Reglamentación RAB/ICAO",
  9: "Performance y Peso",
  10: "Performance y Peso",
  11: "Meteorología",
  12: "Meteorología",
  13: "Procedimientos IFR",
  14: "Reglamentación RAB/ICAO",
  15: "Navegación",
  16: "Factores Humanos",
  17: "Factores Humanos",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { chapter_number, chapter_name, count = 40 } = await req.json();
    if (!chapter_number || !chapter_name) {
      return new Response(JSON.stringify({ error: "Faltan parámetros" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY no configurado");

    const subject = SUBJECT_FOR_CHAPTER[chapter_number] ?? "Reglamentación RAB/ICAO";

    const systemPrompt = `Eres un instructor experto en aviación civil mexicana y en el examen teórico CIAAC para Piloto Comercial.
Conoces a fondo el "Pilot's Handbook of Aeronautical Knowledge" (FAA-H-8083-25B) de la FAA.
Generas preguntas de opción múltiple realistas, en español, con el estilo, vocabulario y nivel de dificultad del examen oficial CIAAC de México.
Cada pregunta debe tener exactamente 4 opciones, solo UNA correcta, una explicación breve y clara que cite el concepto del PHAK, y una dificultad ('fácil', 'medio' o 'difícil').
Cubre los conceptos clave del capítulo. Mezcla niveles de dificultad: ~30% fácil, 50% medio, 20% difícil.`;

    const userPrompt = `Genera exactamente ${count} preguntas tipo CIAAC sobre el contenido del PHAK Capítulo ${chapter_number}: "${chapter_name}".
Las preguntas deben corresponder al material de ese capítulo del PHAK y al programa del examen CIAAC en la materia "${subject}".
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
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                properties: {
                  question_text: { type: "string" },
                  options: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 4,
                    maxItems: 4,
                  },
                  correct_index: { type: "integer", minimum: 0, maximum: 3 },
                  explanation: { type: "string" },
                  difficulty: { type: "string", enum: ["fácil", "medio", "difícil"] },
                },
                required: ["question_text", "options", "correct_index", "explanation", "difficulty"],
                additionalProperties: false,
              },
            },
          },
          required: ["questions"],
          additionalProperties: false,
        },
      },
    }];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
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

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Inténtalo en unos minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Sin créditos de IA. Recarga tu workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResp.text();
      console.error("AI error:", aiResp.status, errText);
      return new Response(JSON.stringify({ error: "Error de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "La IA no devolvió preguntas" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const args = JSON.parse(toolCall.function.arguments);
    const questions: GeneratedQuestion[] = args.questions ?? [];

    return new Response(JSON.stringify({ questions, subject }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("load-phak-chapter error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
