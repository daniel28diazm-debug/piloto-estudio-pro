// Generate a batch of CIAAC-style multiple-choice questions for a specific materia.
// Used to build the extended bank (target ~5,000 questions) by phase 3 of the loader.

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

// Topic outlines per materia, derived from the official CIAAC syllabus and
// referenced FAA / OACI material. The model uses these to vary questions
// across the bank without repeating themes.
const SUBJECT_OUTLINES: Record<string, string> = {
  "Meteorología":
    "Atmósfera estándar, presión y temperatura, vientos (Coriolis, gradiente, geostrófico), humedad, estabilidad atmosférica, nubes y precipitación, masas de aire y frentes (frío, cálido, ocluido, estacionario), tormentas eléctricas, turbulencia (CAT, mecánica, térmica, en estela), cizalladura del viento, formación de hielo (estructural, carburador), niebla (radiación, advección, frontal), informes METAR/SPECI, pronósticos TAF, SIGMET/AIRMET, cartas de tiempo significativo, vientos en altura, microexplosiones, vientos de montaña.",
  "Navegación":
    "Cartas aeronáuticas (WAC, sectional, IFR low/high), proyecciones (Mercator, Lambert), latitud/longitud, rumbos verdadero/magnético/de la brújula, variación y desviación, viento y triángulo de velocidades, computadora de vuelo E6B, tiempo y combustible, navegación a estima, VOR, NDB/ADF, DME, ILS/LOC/GS, marcadores, RNAV, GPS/WAAS/RAIM, FMS, navegación inercial, RNP, performance based navigation, husos horarios, UTC.",
  "Reglamentación RAB/ICAO":
    "Reglamento de Aviación Brasileño (RAB) — el usuario está en México, así que enfocar en NOM, LASCM, RACM, AIP México, AIC, NOTAM. Anexos OACI 1-19 (licencias, reglas del aire, meteo, cartas, unidades, operación, marcas, aeronavegabilidad, facilitación, telecom, ATS, búsqueda y salvamento, AIG, aeródromos, AIS, medio ambiente, mercancías peligrosas, seguridad, gestión seguridad operacional, aeronaves no tripuladas). Licencias y habilitaciones piloto comercial, requisitos médicos clase 1/2, registro de vuelo, certificado médico, mínimos meteorológicos, derechos y obligaciones del PIC.",
  "Performance y Peso":
    "Definiciones de peso (vacío, vacío operativo, MTOW, MLW, ZFW, payload), centro de gravedad y límites, momento, datum, brazo, gráficos de carga, distancias de despegue y aterrizaje, factores que afectan performance (densidad, viento, pendiente, superficie), corrección por altitud densidad, tablas POH, consumo de combustible, alcance y autonomía, techo de servicio, ascenso (rate of climb, angle of climb), V-speeds (Vr, V1, V2, Vmc, Vne, Vno, Va, Vfe, Vso, Vs1, Vx, Vy), curva de potencia.",
  "Sistemas de Aeronave":
    "Planta motriz (motor de pistón, turbina, turbohélice, jet), encendido (magnetos), inducción, carburador vs inyección, hielo en carburador, mezcla, hélice de paso fijo y variable, sistema de combustible (tanques, bombas, selector, contaminación), sistema eléctrico (batería, alternador, bus, breakers), sistema hidráulico, tren de aterrizaje, frenos, sistema de presurización y oxígeno, deshielo y antihielo, sistema de pitot-estática, vacío, instrumentos giroscópicos, glass cockpit, autopiloto, FADEC, ECAM/EICAS.",
  "Comunicaciones":
    "Fraseología aeronáutica estándar OACI en español e inglés, alfabeto fonético, dígitos, transmisión de números, llamadas iniciales y respuestas, plan de vuelo presentado y abierto, cambios de frecuencia, transferencia de control, MAYDAY y PAN-PAN, SELCAL, transponder y códigos (1200/2000, 7500 secuestro, 7600 falla radio, 7700 emergencia), ELT, comunicaciones HF/VHF/UHF, ACARS, CPDLC, ATIS, AWOS/ASOS, broadcasts, fallas de comunicación procedimientos.",
  "Factores Humanos":
    "Fisiología de vuelo, presión atmosférica y altitud, hipoxia (tipos, síntomas, tratamiento), hiperventilación, gases atrapados (oído, senos, dientes, GI), descompresión, oxígeno suplementario, ilusiones visuales y vestibulares, desorientación espacial, vértigo, motion sickness, fatiga, estrés, alcohol y drogas (8 horas botella-yugo), automedicación, IMSAFE, CRM/MCC, comunicación efectiva, toma de decisiones (DECIDE, 3P), gestión de riesgo (PAVE), conciencia situacional, complacencia, automatización, error humano (modelo SHELL, queso suizo de Reason).",
  "Procedimientos IFR":
    "Reglas IFR vs VFR, plan de vuelo IFR, autorizaciones ATC, procedimientos de salida (SID), ruta, aerovías, llegada (STAR), aproximaciones (precisión: ILS, GLS; no precisión: VOR, NDB, LOC, RNAV/LNAV, LPV), mínimos de aproximación, missed approach, holding patterns (entrada directa, paralela, gota), tiempos en holding, cartas Jeppesen y FAA, briefing de aproximación, transición, altitudes (MEA, MOCA, MORA, MSA, MDA, DA), procedimientos de emergencia IFR, falla de comunicación IFR, alternados (requisitos meteorológicos), combustible IFR, EFB.",
};

const DIFFICULTY_DISTRIBUTION = "Mezcla niveles: ~25% fácil, 55% medio, 20% difícil.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { subject, count = 40, seed_topic, batch_index = 0 } = await req.json();
    if (!subject) {
      return new Response(JSON.stringify({ error: "Falta materia" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY no configurado");

    const outline = SUBJECT_OUTLINES[subject] ?? subject;

    const systemPrompt = `Eres un instructor experto en aviación civil mexicana y en el examen teórico CIAAC para Piloto Comercial.
Conoces a fondo el temario oficial CIAAC, la guía del sustentante, los anexos OACI, el reglamento mexicano (LASCM, RACM, NOM-DGAC), el AIP México y referencias FAA (PHAK, AIM, FAR).
Generas preguntas de opción múltiple realistas y diversas, en español, con el estilo, vocabulario y nivel de dificultad del examen oficial CIAAC de México.
Cada pregunta tiene exactamente 4 opciones (A-D), solo UNA correcta, y una explicación breve y clara que cite el concepto técnico correspondiente.
${DIFFICULTY_DISTRIBUTION}
NUNCA repitas la misma pregunta dos veces. Si recibes un seed_topic úsalo para variar el enfoque.
Cubre TODOS los subtemas del temario, no solo los más obvios.`;

    const userPrompt = `Genera exactamente ${count} preguntas tipo CIAAC para la materia "${subject}" (lote #${batch_index + 1}).
${seed_topic ? `Enfócate principalmente en este subtema: ${seed_topic}.\n` : ""}
Temario oficial de referencia:
${outline}

Devuelve SOLO mediante la herramienta create_questions. No repitas preguntas obvias; varía contextos, números, escenarios.`;

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
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Sin créditos de IA" }), {
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

    return new Response(JSON.stringify({ questions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-subject-batch error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
