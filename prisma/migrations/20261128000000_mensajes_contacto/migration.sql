-- Contacto corporativo (v1.29.0): mensajes del formulario de
-- contacto de /geo#contacto. Tabla aditiva pura (CREATE TABLE),
-- sin tocar datos existentes.
CREATE TABLE "mensajes_contacto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensajes_contacto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mensajes_contacto_correo_idx" ON "mensajes_contacto"("correo");
CREATE INDEX "mensajes_contacto_createdAt_idx" ON "mensajes_contacto"("createdAt");
