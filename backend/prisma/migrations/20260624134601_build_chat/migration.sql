-- CreateEnum
CREATE TYPE "BuildChatMode" AS ENUM ('BRAINSTORM', 'GRILL', 'IMPECCABLE');

-- CreateEnum
CREATE TYPE "BuildChatRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "BuildChat" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New build chat',
    "mode" "BuildChatMode" NOT NULL DEFAULT 'BRAINSTORM',
    "sessionToken" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuildChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildChatMessage" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "role" "BuildChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "buildId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuildChat_sessionToken_idx" ON "BuildChat"("sessionToken");

-- CreateIndex
CREATE INDEX "BuildChat_userId_idx" ON "BuildChat"("userId");

-- CreateIndex
CREATE INDEX "BuildChatMessage_chatId_idx" ON "BuildChatMessage"("chatId");

-- CreateIndex
CREATE INDEX "BuildChatMessage_buildId_idx" ON "BuildChatMessage"("buildId");

-- AddForeignKey
ALTER TABLE "BuildChat" ADD CONSTRAINT "BuildChat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildChatMessage" ADD CONSTRAINT "BuildChatMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "BuildChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildChatMessage" ADD CONSTRAINT "BuildChatMessage_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "SavedBuild"("id") ON DELETE SET NULL ON UPDATE CASCADE;
