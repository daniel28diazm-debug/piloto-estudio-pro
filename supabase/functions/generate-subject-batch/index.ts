// Generate small batches (≤10) of CIAAC-style multiple-choice questions
// for one of the 12 official subjects. Has explicit AbortController timeout.

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

const MAX_COUNT = 10;
const AI_TIMEOUT_MS = 110_000;

const SUBJECT_OUTLINES: Record<string, string> = {
  "Meteorología":
    "Atmósfera estándar, presión y temperatura, vientos (Coriolis, gradiente, geostrófico), humedad, estabilidad, nubes y precipitación, masas y frentes, tormentas, turbulencia, cizalladura, hielo (estructural, carburador), niebla, METAR/SPECI/TAF, SIGMET/AIRMET, vientos en altura, microexplosiones, vientos de montaña.",
  "Navegación Aérea":
    "Cartas (WAC, sectional, IFR low/high), proyecciones, lat/long, rumbos verdadero/magnético/brújula, variación, desviación, viento y triángulo de velocidades, E6B, navegación a estima, VOR, NDB/ADF, DME, ILS/LOC/GS, RNAV, GPS/WAAS/RAIM, FMS, RNP, husos horarios, UTC.",
  "Reglamentación RAB / Legislación Aeronáutica":
    "Ley de Aviación Civil Mexicana (LASCM), Reglamento (RACM), NOM-DGAC, AIP México, AIC, NOTAM, licencias y habilitaciones piloto comercial, certificado médico clase 1, derechos y obligaciones del PIC, mínimos meteorológicos.",
  "Performance y Peso y Balance":
    "Pesos (vacío, vacío operativo, MTOW, MLW, ZFW, payload), CG y límites, momento, datum, brazo, gráficos de carga, distancias de despegue/aterrizaje, factores (densidad, viento, pendiente, superficie), corrección altitud densidad, POH, consumo, alcance, autonomía, techo, ascenso, V-speeds (Vr, V1, V2, Vmc, Vne, Vno, Va, Vfe, Vso, Vs1, Vx, Vy).",
  "Sistemas de Aeronave":
    "Motor de pistón, magnetos, inducción, carburador vs inyección, hielo en carburador, mezcla, hélice paso fijo y variable, combustible, eléctrico (batería, alternador, bus, breakers), hidráulico, tren de aterrizaje, frenos, presurización, oxígeno, deshielo y antihielo, pitot-estática, vacío, instrumentos giroscópicos, glass cockpit, autopiloto, FADEC, ECAM/EICAS, turbina y turbohélice.",
  "Comunicaciones y ATC":
    "Fraseología OACI español/inglés, alfabeto fonético, dígitos, llamadas iniciales, plan de vuelo presentado y abierto, cambios de frecuencia, transferencia de control, MAYDAY/PAN-PAN, SELCAL, transponder y códigos (1200, 7500, 7600, 7700), ELT, HF/VHF/UHF, ACARS, CPDLC, ATIS, AWOS/ASOS, fallas de comunicación.",
  "Factores Humanos y Fisiología":
    "Fisiología de vuelo, presión y altitud, hipoxia (tipos, síntomas, tratamiento), hiperventilación, gases atrapados, descompresión, oxígeno suplementario, ilusiones visuales y vestibulares, desorientación, vértigo, motion sickness, fatiga, estrés, alcohol/drogas (8 horas), IMSAFE, CRM/MCC, comunicación efectiva, DECIDE, 3P, PAVE, conciencia situacional, automatización, modelo SHELL, queso suizo de Reason.",
  "Procedimientos IFR":
    "Reglas IFR, plan IFR, autorizaciones ATC, SID, ruta, aerovías, STAR, aproximaciones (precisión: ILS, GLS; no precisión: VOR, NDB, LOC, RNAV/LNAV, LPV), missed approach, holdings (entradas), tiempos en holding, cartas Jeppesen y FAA, briefing, MEA, MOCA, MORA, MSA, MDA, DA, fallas IFR, alternados, combustible IFR, EFB.",
  "Aerodinámica y Principios de Vuelo":
    "Sustentación y resistencia, perfil alar, ángulo de ataque, pérdida y recuperación, barrena, número de Reynolds, efecto suelo, controles primarios y secundarios, estabilidad longitudinal/lateral/direccional, factor de carga, maniobras, performance de crucero, máxima resistencia y máxima autonomía, aerodinámica de alta velocidad, número de Mach, ondas de choque.",
  "Operaciones Aeronáuticas":
    "Operaciones en aeropuerto, rodaje y señalización, luces de pista y calle, marcas de pista, wake turbulence y separaciones, operaciones VFR, circuito de tránsito, procedimientos de ruido, operaciones nocturnas, mercancías peligrosas IATA/OACI, briefing pre-vuelo, procedimientos pre y post vuelo, manejo de combustible y reabastecimiento.",
  "Espacio Aéreo":
    "Clases de espacio aéreo OACI A-G, espacio controlado vs no controlado, TMA, CTR, ATZ, áreas restringidas, prohibidas y peligrosas, espacio aéreo mexicano, FAA Class B/C/D/E, requerimientos de transponder, altitudes de transición, FL, separación vertical, RVSM, ADS-B.",
  "Reglamentación OACI / Anexos":
    "Anexos OACI 1-19: Anexo 1 licencias, Anexo 2 reglas del aire, Anexo 3 meteorología, Anexo 4 cartas, Anexo 5 unidades, Anexo 6 operación de aeronaves, Anexo 7 marcas, Anexo 8 aeronavegabilidad, Anexo 9 facilitación, Anexo 10 telecom, Anexo 11 ATS, Anexo 12 SAR, Anexo 13 AIG, Anexo 14 aeródromos, Anexo 15 AIS, Anexo 16 medio ambiente, Anexo 17 seguridad, Anexo 18 mercancías peligrosas, Anexo 19 SMS.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const subject: string = body.subject;
    const requested = Number(body.count ?? MAX_COUNT);
    const count = Math.min(MAX_COUNT, Math.max(1, requested));
    const seed_topic: string | undefined = body.seed_topic;
    const batch_index: number = body.batch_index ?? 0;

    if (!subject) return json({ error: "Falta materia" }, 400);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY no configurado");

    const outline = SUBJECT_OUTLINES[subject] ?? subject;

    const systemPrompt = `Eres un instructor experto en aviación civil mexicana y en el examen teórico CIAAC para Piloto Comercial.
Conoces el temario oficial CIAAC, la guía del sustentante, los anexos OACI, la LASCM, RACM, NOM-DGAC, AIP México y referencias FAA (PHAK, AIM, FAR).
Generas preguntas de opción múltiple realistas y diversas en español con el estilo, vocabulario y dificultad del examen oficial CIAAC.
Cada pregunta: 4 opciones (A-D), solo UNA correcta, explicación breve y clara.
Mezcla niveles: ~25% fácil, 55% medio, 20% difícil. Varía contextos, números y escenarios. NUNCA repitas preguntas.`;

    const userPrompt = `Genera exactamente ${count} preguntas tipo CIAAC para la materia "${subject}" (lote #${batch_index + 1}).
${seed_topic ? `Enfócate principalmente en: ${seed_topic}.\n` : ""}
Temario oficial:
${outline}

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

    return json({ questions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    console.error("generate-subject-batch error:", msg);
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
