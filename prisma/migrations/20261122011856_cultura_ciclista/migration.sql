-- CreateTable
CREATE TABLE "cultura_recursos" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "resena" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "categorias" TEXT[],
    "portadaUrl" TEXT,
    "anio" TEXT,
    "autor" TEXT NOT NULL,
    "extra" TEXT,
    "pais" TEXT,
    "urlExterna" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL DEFAULT 'editorial',
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "destacado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cultura_recursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cultura_favoritos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recursoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cultura_favoritos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cultura_recursos_tipo_idx" ON "cultura_recursos"("tipo");

-- CreateIndex
CREATE INDEX "cultura_recursos_publicado_destacado_idx" ON "cultura_recursos"("publicado", "destacado");

-- CreateIndex
CREATE UNIQUE INDEX "cultura_favoritos_userId_recursoId_key" ON "cultura_favoritos"("userId", "recursoId");

-- AddForeignKey
ALTER TABLE "cultura_favoritos" ADD CONSTRAINT "cultura_favoritos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cultura_favoritos" ADD CONSTRAINT "cultura_favoritos_recursoId_fkey" FOREIGN KEY ("recursoId") REFERENCES "cultura_recursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
