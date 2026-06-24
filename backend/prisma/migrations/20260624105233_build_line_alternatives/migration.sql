-- AlterTable
ALTER TABLE "SavedBuildLine" ADD COLUMN     "alternativeVariantIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
