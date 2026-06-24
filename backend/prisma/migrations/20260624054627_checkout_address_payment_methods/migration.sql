-- CreateEnum
CREATE TYPE "FulfillmentType" AS ENUM ('PICKUP', 'DELIVERY');

-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "barangay" TEXT,
ADD COLUMN     "barangayCode" TEXT,
ADD COLUMN     "cityCode" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "provinceCode" TEXT,
ADD COLUMN     "regionCode" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "fulfillmentType" "FulfillmentType" NOT NULL DEFAULT 'DELIVERY';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "paymentMethodId" TEXT;

-- CreateTable
CREATE TABLE "RefRegion" (
    "regCode" TEXT NOT NULL,
    "psgcCode" TEXT NOT NULL,
    "regDesc" TEXT NOT NULL,

    CONSTRAINT "RefRegion_pkey" PRIMARY KEY ("regCode")
);

-- CreateTable
CREATE TABLE "RefProvince" (
    "provCode" TEXT NOT NULL,
    "regCode" TEXT NOT NULL,
    "psgcCode" TEXT NOT NULL,
    "provDesc" TEXT NOT NULL,

    CONSTRAINT "RefProvince_pkey" PRIMARY KEY ("provCode")
);

-- CreateTable
CREATE TABLE "RefCityMun" (
    "citymunCode" TEXT NOT NULL,
    "provCode" TEXT NOT NULL,
    "psgcCode" TEXT NOT NULL,
    "citymunDesc" TEXT NOT NULL,

    CONSTRAINT "RefCityMun_pkey" PRIMARY KEY ("citymunCode")
);

-- CreateTable
CREATE TABLE "RefBarangay" (
    "brgyCode" TEXT NOT NULL,
    "citymunCode" TEXT NOT NULL,
    "provCode" TEXT NOT NULL,
    "regCode" TEXT NOT NULL,
    "brgyDesc" TEXT NOT NULL,

    CONSTRAINT "RefBarangay_pkey" PRIMARY KEY ("brgyCode")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instructions" TEXT,
    "qrImageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RefProvince_regCode_idx" ON "RefProvince"("regCode");

-- CreateIndex
CREATE INDEX "RefCityMun_provCode_idx" ON "RefCityMun"("provCode");

-- CreateIndex
CREATE INDEX "RefBarangay_citymunCode_idx" ON "RefBarangay"("citymunCode");

-- CreateIndex
CREATE INDEX "PaymentMethod_isActive_idx" ON "PaymentMethod"("isActive");

-- CreateIndex
CREATE INDEX "Payment_paymentMethodId_idx" ON "Payment"("paymentMethodId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
