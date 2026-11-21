-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'user';

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "modalidad" TEXT NOT NULL,
    "polyline" TEXT NOT NULL,
    "coordsPubVer" INTEGER NOT NULL DEFAULT 1,
    "minLat" DOUBLE PRECISION NOT NULL,
    "maxLat" DOUBLE PRECISION NOT NULL,
    "minLon" DOUBLE PRECISION NOT NULL,
    "maxLon" DOUBLE PRECISION NOT NULL,
    "cells" TEXT[],
    "centerLat" DOUBLE PRECISION NOT NULL,
    "centerLon" DOUBLE PRECISION NOT NULL,
    "distKm" DOUBLE PRECISION NOT NULL,
    "inicioAproxLat" DOUBLE PRECISION,
    "inicioAproxLon" DOUBLE PRECISION,
    "finAproxLat" DOUBLE PRECISION,
    "finAproxLon" DOUBLE PRECISION,
    "proteccion" JSONB,
    "gainM" DOUBLE PRECISION,
    "lossM" DOUBLE PRECISION,
    "minEle" DOUBLE PRECISION,
    "maxEle" DOUBLE PRECISION,
    "eleFuente" TEXT,
    "dificultadFisica" INTEGER NOT NULL,
    "dificultadTecnica" INTEGER NOT NULL,
    "dificultadOrigen" TEXT NOT NULL DEFAULT 'auto',
    "attrs" TEXT[],
    "ultimaRevisionAt" TIMESTAMP(3),
    "estadoVigencia" TEXT NOT NULL DEFAULT 'vigente',
    "status" TEXT NOT NULL DEFAULT 'publicado',
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteVersion" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "v" INTEGER NOT NULL,
    "geometrySnapshot" TEXT NOT NULL,
    "metaSnapshot" JSONB NOT NULL,
    "eleSnapshot" JSONB,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutePoi" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nota" TEXT,

    CONSTRAINT "RoutePoi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutePhoto" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "blobPathname" TEXT,
    "hash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteComment" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteRating" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RouteRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteReport" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'abierta',
    "peso" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "clasificacion" TEXT NOT NULL DEFAULT 'normal',
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteExperience" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "routeVersionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rideId" TEXT,
    "fechaRealizacion" TEXT NOT NULL,
    "comentario" TEXT,
    "condiciones" TEXT[],
    "observacion" TEXT,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperiencePhoto" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "blobPathname" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperiencePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "motivo" TEXT,
    "detalle" JSONB,
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Route_cells_idx" ON "Route" USING GIN ("cells");

-- CreateIndex
CREATE INDEX "Route_status_createdAt_idx" ON "Route"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Route_ownerId_updatedAt_idx" ON "Route"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "RouteVersion_routeId_idx" ON "RouteVersion"("routeId");

-- CreateIndex
CREATE UNIQUE INDEX "RouteVersion_routeId_v_key" ON "RouteVersion"("routeId", "v");

-- CreateIndex
CREATE INDEX "RoutePoi_routeId_orden_idx" ON "RoutePoi"("routeId", "orden");

-- CreateIndex
CREATE INDEX "RoutePhoto_routeId_orden_idx" ON "RoutePhoto"("routeId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "RouteFavorite_userId_routeId_key" ON "RouteFavorite"("userId", "routeId");

-- CreateIndex
CREATE INDEX "RouteComment_routeId_createdAt_idx" ON "RouteComment"("routeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RouteRating_userId_routeId_key" ON "RouteRating"("userId", "routeId");

-- CreateIndex
CREATE INDEX "RouteReport_estado_createdAt_idx" ON "RouteReport"("estado", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RouteReport_routeId_reporterId_motivo_key" ON "RouteReport"("routeId", "reporterId", "motivo");

-- CreateIndex
CREATE INDEX "RouteExperience_routeId_createdAt_idx" ON "RouteExperience"("routeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RouteExperience_userId_routeId_fechaRealizacion_key" ON "RouteExperience"("userId", "routeId", "fechaRealizacion");

-- CreateIndex
CREATE INDEX "ExperiencePhoto_experienceId_idx" ON "ExperiencePhoto"("experienceId");

-- CreateIndex
CREATE INDEX "ModerationLog_targetType_targetId_idx" ON "ModerationLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ModerationLog_createdAt_idx" ON "ModerationLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteVersion" ADD CONSTRAINT "RouteVersion_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutePoi" ADD CONSTRAINT "RoutePoi_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutePhoto" ADD CONSTRAINT "RoutePhoto_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteFavorite" ADD CONSTRAINT "RouteFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteFavorite" ADD CONSTRAINT "RouteFavorite_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteComment" ADD CONSTRAINT "RouteComment_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteComment" ADD CONSTRAINT "RouteComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteRating" ADD CONSTRAINT "RouteRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteRating" ADD CONSTRAINT "RouteRating_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteReport" ADD CONSTRAINT "RouteReport_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteReport" ADD CONSTRAINT "RouteReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteExperience" ADD CONSTRAINT "RouteExperience_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteExperience" ADD CONSTRAINT "RouteExperience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperiencePhoto" ADD CONSTRAINT "ExperiencePhoto_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "RouteExperience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

