-- Comentarios públicos de productos (v1.29.5): casilla dentro del
-- modal «Ver detalles» de /geo (Cumbre30 y RAPIQO). Tabla aditiva
-- pura (CREATE TABLE), sin tocar datos existentes.
CREATE TABLE "comentarios" (
    "id" TEXT NOT NULL,
    "producto" TEXT NOT NULL,
    "evaluacion" INTEGER NOT NULL,
    "comentario" TEXT NOT NULL,
    "nombre" TEXT NOT NULL DEFAULT 'Anónimo',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comentarios_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "comentarios_producto_createdAt_idx" ON "comentarios"("producto", "createdAt");
