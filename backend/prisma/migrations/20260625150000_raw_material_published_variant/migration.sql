-- AlterTable
ALTER TABLE "RawMaterial" ADD COLUMN "publishedVariantId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "RawMaterial_publishedVariantId_key" ON "RawMaterial"("publishedVariantId");

-- AddForeignKey
ALTER TABLE "RawMaterial" ADD CONSTRAINT "RawMaterial_publishedVariantId_fkey" FOREIGN KEY ("publishedVariantId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
