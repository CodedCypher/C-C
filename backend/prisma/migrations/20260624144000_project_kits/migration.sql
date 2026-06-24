-- AlterTable
ALTER TABLE "Variant" ADD COLUMN     "isProjectKit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kitPosition" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "kitPublished" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: the storefront kit list previously surfaced EVERY BUILT variant with
-- an active BOM. Now it filters on isProjectKit + kitPublished, so flag the
-- existing kits (BUILT + active BOM) as published so they keep showing.
UPDATE "Variant" v
SET "isProjectKit" = true, "kitPublished" = true
WHERE v."sourcingType" = 'BUILT'
  AND v."deletedAt" IS NULL
  AND EXISTS (
    SELECT 1 FROM "BillOfMaterials" b
    WHERE b."variantId" = v."id" AND b."isActive" = true
  );
