-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "proofImageUrl" TEXT,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);
