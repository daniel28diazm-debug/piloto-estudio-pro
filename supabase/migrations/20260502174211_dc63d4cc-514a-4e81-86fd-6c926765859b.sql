-- 1. Add new enum values (cannot be done in a transaction, so use ALTER TYPE)
ALTER TYPE public.subject ADD VALUE IF NOT EXISTS 'Navegación Aérea';
ALTER TYPE public.subject ADD VALUE IF NOT EXISTS 'Reglamentación RAB / Legislación Aeronáutica';
ALTER TYPE public.subject ADD VALUE IF NOT EXISTS 'Performance y Peso y Balance';
ALTER TYPE public.subject ADD VALUE IF NOT EXISTS 'Comunicaciones y ATC';
ALTER TYPE public.subject ADD VALUE IF NOT EXISTS 'Factores Humanos y Fisiología';
ALTER TYPE public.subject ADD VALUE IF NOT EXISTS 'Aerodinámica y Principios de Vuelo';
ALTER TYPE public.subject ADD VALUE IF NOT EXISTS 'Operaciones Aeronáuticas';
ALTER TYPE public.subject ADD VALUE IF NOT EXISTS 'Espacio Aéreo';
ALTER TYPE public.subject ADD VALUE IF NOT EXISTS 'Reglamentación OACI / Anexos';
