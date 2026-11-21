-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "usernameChangedAt" TIMESTAMP(3),
    "passwordHash" TEXT NOT NULL,
    "selectedPin" TEXT NOT NULL DEFAULT 'clasico',
    "bikeBrand" TEXT,
    "bikeType" TEXT,
    "bikeModel" TEXT,
    "bikeSize" TEXT,
    "bikeColor" TEXT,
    "riderWeightKg" DOUBLE PRECISION,
    "bikeWeightKg" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PasswordReset" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProDelivery" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "via" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Ride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateISO" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "maxKmh" DOUBLE PRECISION NOT NULL,
    "maxInParkKmh" DOUBLE PRECISION,
    "inParkKm" DOUBLE PRECISION,
    "motorized" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT,
    "avgKmh" DOUBLE PRECISION NOT NULL,
    "elapsedSec" DOUBLE PRECISION NOT NULL,
    "gainM" DOUBLE PRECISION NOT NULL,
    "overLimitSec" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RideMetric" (
    "rideId" TEXT NOT NULL,
    "movingSec" DOUBLE PRECISION NOT NULL,
    "peak15sKmh" DOUBLE PRECISION,
    "flatAvgKmh" DOUBLE PRECISION,
    "flatKm" DOUBLE PRECISION,
    "climbGainM" DOUBLE PRECISION,
    "climbSec" DOUBLE PRECISION,
    "vamMh" DOUBLE PRECISION,
    "stopCount" INTEGER,
    "secOver55" DOUBLE PRECISION,
    "over55StreakSec" DOUBLE PRECISION,
    "climb6AvgKmh" DOUBLE PRECISION,
    "estWattsClimb" DOUBLE PRECISION,
    "offRoadKm" DOUBLE PRECISION,
    "netKm" DOUBLE PRECISION,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RideMetric_pkey" PRIMARY KEY ("rideId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CyclistProfile" (
    "userId" TEXT NOT NULL,
    "archetype" TEXT NOT NULL,
    "calibrating" BOOLEAN NOT NULL DEFAULT true,
    "climbing" DOUBLE PRECISION,
    "endurance" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "power" DOUBLE PRECISION,
    "consistency" DOUBLE PRECISION,
    "explorer" DOUBLE PRECISION,
    "validRides" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CyclistProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProfileConfig" (
    "key" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileConfig_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Incident" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "confirmCount" INTEGER NOT NULL DEFAULT 0,
    "resolvedCount" INTEGER NOT NULL DEFAULT 0,
    "lastConfirmAt" TIMESTAMP(3),
    "reportCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Friendship" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "friendId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Achievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Constancia" (
    "id" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Constancia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PushSub" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSub_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RideShare" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RideShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PasswordReset_email_idx" ON "PasswordReset"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProDelivery_paymentId_key" ON "ProDelivery"("paymentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProDelivery_email_idx" ON "ProDelivery"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Ride_userId_dateISO_idx" ON "Ride"("userId", "dateISO");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Incident_lat_lon_idx" ON "Incident"("lat", "lon");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Friendship_userId_friendId_key" ON "Friendship"("userId", "friendId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Achievement_userId_code_key" ON "Achievement"("userId", "code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Constancia_rideId_idx" ON "Constancia"("rideId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PushSub_endpoint_key" ON "PushSub"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RideShare_code_key" ON "RideShare"("code");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Ride" ADD CONSTRAINT "Ride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "RideMetric" ADD CONSTRAINT "RideMetric_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "CyclistProfile" ADD CONSTRAINT "CyclistProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Incident" ADD CONSTRAINT "Incident_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

