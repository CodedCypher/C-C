-- CreateEnum
CREATE TYPE "BuildSource" AS ENUM ('TEXT', 'URL', 'IMAGE');

-- CreateTable
CREATE TABLE "SavedBuild" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceType" "BuildSource" NOT NULL DEFAULT 'TEXT',
    "sourceRef" TEXT,
    "sessionToken" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedBuild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedBuildLine" (
    "id" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "variantId" TEXT,
    "rawLabel" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SavedBuildLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedBuild_sessionToken_idx" ON "SavedBuild"("sessionToken");

-- CreateIndex
CREATE INDEX "SavedBuild_userId_idx" ON "SavedBuild"("userId");

-- CreateIndex
CREATE INDEX "SavedBuildLine_buildId_idx" ON "SavedBuildLine"("buildId");

-- CreateIndex
CREATE INDEX "SavedBuildLine_variantId_idx" ON "SavedBuildLine"("variantId");

-- AddForeignKey
ALTER TABLE "SavedBuild" ADD CONSTRAINT "SavedBuild_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedBuildLine" ADD CONSTRAINT "SavedBuildLine_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "SavedBuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedBuildLine" ADD CONSTRAINT "SavedBuildLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
