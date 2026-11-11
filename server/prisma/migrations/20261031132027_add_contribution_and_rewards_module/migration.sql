-- CreateEnum
CREATE TYPE "ContributionCategory" AS ENUM ('HEALTHCARE_EDUCATION', 'RESEARCH_CONTRIBUTION', 'EXPERT_QA', 'RESEARCH_DISCUSSION', 'EDUCATIONAL_RESOURCE');

-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_REVISION', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('CONTRIBUTION_REWARD', 'REWARD_REDEMPTION', 'ADMIN_ADJUSTMENT', 'REWARD_REVERSAL', 'REFUND');

-- CreateEnum
CREATE TYPE "RewardCategory" AS ENUM ('MONETARY_REWARD', 'PROFESSIONAL_COURSE', 'CONFERENCE_ACCESS', 'ACADEMIC_RESOURCE', 'MENTORING', 'PROFESSIONAL_EVENT', 'OTHER_BENEFIT');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PROCESSING', 'FULFILLED', 'CANCELLED', 'REFUNDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'CONTRIBUTION_UPDATE';
ALTER TYPE "NotificationType" ADD VALUE 'REWARD_UPDATE';

-- CreateTable
CREATE TABLE "Contribution" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "category" "ContributionCategory" NOT NULL,
    "status" "ContributionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "summary" VARCHAR(1000) NOT NULL,
    "awardCredits" INTEGER DEFAULT 0,
    "currentReviewerId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributionReview" (
    "id" UUID NOT NULL,
    "contributionId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "scoreAccuracy" INTEGER NOT NULL DEFAULT 1,
    "scoreRelevance" INTEGER NOT NULL DEFAULT 1,
    "scoreUsefulness" INTEGER NOT NULL DEFAULT 1,
    "scoreOriginality" INTEGER NOT NULL DEFAULT 1,
    "scoreImpact" INTEGER NOT NULL DEFAULT 1,
    "scoreOverall" DECIMAL(3,2) NOT NULL,
    "awardedCredits" INTEGER NOT NULL DEFAULT 0,
    "decision" "ContributionStatus" NOT NULL,
    "feedback" VARCHAR(1500) NOT NULL,
    "supportingEvidence" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContributionReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditWallet" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "totalEarned" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "referenceId" VARCHAR(100),
    "idempotencyKey" VARCHAR(120),
    "description" VARCHAR(500) NOT NULL,
    "actorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contributionId" UUID,
    "redemptionId" UUID,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardCatalog" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "category" "RewardCategory" NOT NULL,
    "creditCost" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stockQuantity" INTEGER,
    "redeemedCount" INTEGER NOT NULL DEFAULT 0,
    "eligibilityReq" VARCHAR(500),
    "terms" VARCHAR(2000),
    "imageUrl" VARCHAR(500),
    "isMonetary" BOOLEAN NOT NULL DEFAULT false,
    "payoutEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardRedemption" (
    "id" UUID NOT NULL,
    "rewardId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "creditCost" INTEGER NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'REQUESTED',
    "userNote" VARCHAR(1000),
    "adminNote" VARCHAR(1000),
    "fulfillmentInfo" VARCHAR(1500),
    "reviewerId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contribution_userId_status_idx" ON "Contribution"("userId", "status");

-- CreateIndex
CREATE INDEX "Contribution_postId_idx" ON "Contribution"("postId");

-- CreateIndex
CREATE INDEX "Contribution_status_createdAt_idx" ON "Contribution"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Contribution_category_idx" ON "Contribution"("category");

-- CreateIndex
CREATE INDEX "ContributionReview_contributionId_createdAt_idx" ON "ContributionReview"("contributionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ContributionReview_reviewerId_idx" ON "ContributionReview"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditWallet_userId_key" ON "CreditWallet"("userId");

-- CreateIndex
CREATE INDEX "CreditWallet_userId_idx" ON "CreditWallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditTransaction_idempotencyKey_key" ON "CreditTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CreditTransaction_walletId_createdAt_idx" ON "CreditTransaction"("walletId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CreditTransaction_type_idx" ON "CreditTransaction"("type");

-- CreateIndex
CREATE INDEX "RewardCatalog_category_isActive_idx" ON "RewardCatalog"("category", "isActive");

-- CreateIndex
CREATE INDEX "RewardRedemption_userId_status_idx" ON "RewardRedemption"("userId", "status");

-- CreateIndex
CREATE INDEX "RewardRedemption_status_createdAt_idx" ON "RewardRedemption"("status", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_currentReviewerId_fkey" FOREIGN KEY ("currentReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionReview" ADD CONSTRAINT "ContributionReview_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "Contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionReview" ADD CONSTRAINT "ContributionReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditWallet" ADD CONSTRAINT "CreditWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CreditWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "Contribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "RewardRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "RewardCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
