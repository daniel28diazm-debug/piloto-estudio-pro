# Plan de mejoras (8 módulos)

Es un trabajo grande. Lo divido en fases con cambios de schema explícitos. Confírmame para arrancar (o dime si quieres priorizar/recortar fases).

## Fase 0 — Cambios de base de datos (1 migración)

Agregar a `questions`:
- `source TEXT NOT NULL DEFAULT 'pdf'` (valores: `phak`, `ciaac`, `ai_generated`, `web`, `pdf`)
- `reference TEXT` (capítulo PHAK / artículo RAB / Anexo OACI)

Nueva tabla `study_progress` (por usuario+pregunta):
- `user_id`, `question_id`, `times_seen`, `times_correct`, `times_wrong`, `consecutive_correct`, `status` (`new|in_progress|mastered`), `last_seen_at`, `next_review_at`, `ease_factor`, `interval_days`, `repetitions`
- RLS: dueño

Nueva tabla `study_sessions`:
- `user_id`, `started_at`, `ended_at`, `mastered_count`, `review_count`, `pending_question_ids JSONB`
- Para "Continuar donde quedé"

Agregar a `app_settings` se usa para `exam_date`.

Cambio simulador: umbral 70 → **80%**.

## Fase 1 — Modo Estudio inteligente
- Cola con rotación por materia (no repetir materia consecutiva).
- Clasificación: dominada (3 correctas seguidas) → SM-2 lejano; en progreso → vuelve en 1-2; incorrecta → reinserta 2-3 veces en la sesión.
- Persiste `study_progress` tras cada respuesta.
- Resumen final: dominadas hoy, lista a repasar (con respuesta+explicación), pendientes mañana.
- Banner en Dashboard: "Tienes X pendientes — Continuar".

## Fase 2 — Biblioteca con pestañas por fuente
- Tabs: Todas / PHAK / CIAAC / Web / Mis PDFs con contadores.
- Filtra por `source`.

## Fase 3 — Explicaciones + fuente en todas las vistas
- Mostrar `reference` cuando exista.
- Edge Function `enrich-question` que usa Lovable AI para rellenar `reference` y/o `explanation` faltantes (on-demand al ver la pregunta).

## Fase 4 — Dashboard de Progreso ampliado
- Resumen general (vistas/banco, racha, horas, % aciertos, dominadas/progreso/sin ver).
- Tabla + barras por materia con tendencia (compara últimos 7 vs previos 7 días).
- Línea aciertos/día (30d), radar 12 materias, barras estudio/día (14d), pie dominio.
- Top 3 peores materias, top 5 preguntas más falladas, recomendación de materia.
- Proyección con fecha de examen editable (guardada en `app_settings`).

## Fase 5 — Simulador: resultados detallados + 80%
- Aprobado/Reprobado con umbral 80.00%.
- Listas separadas correctas/incorrectas con explicación+fuente.
- Estadísticas por materia.
- Botón "Estudiar mis errores" → study mode cargando esos IDs.

## Fase 6 — Flashcards de las 2,365 preguntas
- Backfill (insert idempotente) `flashcard_reviews` con todas las preguntas del usuario sin tarjeta.
- Filtros: materia, fuente, estado (pendientes hoy / todas / dominadas).
- Compartir SM-2 entre flashcards y estudio (usar `study_progress` también en flashcards).
- Contador "X pendientes hoy".

## Fase 7 — Subida de PDF con detección de materia
- Edge Function `classify-pdf` (Lovable AI Gemini): devuelve materia(s) sugerida(s) con confianza.
- UI confirma/edita antes de generar.
- `generate-questions` ya existente: pasarle materia(s) detectadas; tagear `source='pdf'`.

## Fase 8 — Panel de Acciones Rápidas
En Dashboard (y sidebar en desktop):
- Estudiar ahora (badge con pendientes), Simulacro rápido (20 preguntas), Repasar errores, Flashcards de hoy (badge), Subir PDF, Preguntarle al Tutor.

## Detalles técnicos
- Rotación: round-robin por `subject` sobre el pool barajado.
- SM-2: reusar `src/lib/sm2.ts` para `study_progress` también.
- Tendencia materia: comparar % aciertos de los últimos 7 días vs 7 anteriores.
- Recomendación: materia con menor `% dominio` (mastered/total).
- Racha y horas: derivadas de `question_answers.created_at` (ya existe).
- Tiempo estudiado: aproximar con sesiones (`study_sessions.started_at/ended_at`) + tiempo de exámenes.

## Confirmación que necesito
1. ¿Apruebas crear las tablas/migración de Fase 0?
2. ¿Quieres que ejecute las 8 fases en una sola tanda (mensaje muy largo, puede tardar) o por bloques (Fase 0+1+5 primero, luego 2+3+6, luego 4+7+8)?
3. La columna `source` actualmente no existe; las preguntas ya cargadas se marcarán con un valor por defecto. ¿Marco las existentes como `phak` o las dejo como `pdf`?
