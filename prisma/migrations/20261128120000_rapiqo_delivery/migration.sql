-- RAPIQO: auto-entrega de licencias (v1.29.3). Tabla aditiva pura
-- (CREATE TABLE), sin tocar datos existentes.
CREATE TABLE "rapiqo_delivery" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "license" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "via" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rapiqo_delivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rapiqo_delivery_paymentId_key" ON "rapiqo_delivery"("paymentId");
CREATE INDEX "rapiqo_delivery_email_idx" ON "rapiqo_delivery"("email");
