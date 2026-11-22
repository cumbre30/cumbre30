-- Cultura v4: idioma de la EDICIÓN/VERSIÓN DE REFERENCIA (no el
-- idioma original). Migración aditiva pura (CT-M3): ADD COLUMN con
-- default que clasifica todo el catálogo vigente como 'en' (53 de
-- origen inglés + 11 con edición/versión en inglesa verificada:
-- traducción publicada, doblaje o subtítulos). El idioma original
-- de las obras traducidas se documenta en el campo `extra`.
ALTER TABLE "cultura_recursos" ADD COLUMN "idioma" TEXT NOT NULL DEFAULT 'en';
