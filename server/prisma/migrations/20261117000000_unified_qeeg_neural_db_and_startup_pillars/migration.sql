-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CONSULTATION_UPDATE';
ALTER TYPE "NotificationType" ADD VALUE 'DATABANK_UPDATE';

-- AlterEnum
ALTER TYPE "CreditTransactionType" ADD VALUE 'CONSULTATION_ESCROW';
ALTER TYPE "CreditTransactionType" ADD VALUE 'CONSULTATION_EARNING';
ALTER TYPE "CreditTransactionType" ADD VALUE 'CONSULTATION_REFUND';
ALTER TYPE "CreditTransactionType" ADD VALUE 'DATABANK_PURCHASE';
ALTER TYPE "CreditTransactionType" ADD VALUE 'DATABANK_ROYALTY';
ALTER TYPE "CreditTransactionType" ADD VALUE 'STARTER_GRANT';

-- CreateEnum
CREATE TYPE "ClinicalCategory" AS ENUM ('VASCULAR_STROKE', 'EPILEPSY_ICU', 'SLEEP_COGNITIVE', 'HARDWARE_BCI');

-- CreateEnum
CREATE TYPE "NeuralLabel" AS ENUM ('CONTROL', 'ISCHEMIC_STROKE', 'HEMORRHAGIC_STROKE', 'EPILEPTIFORM_SLOWING', 'COGNITIVE_FATIGUE');

-- CreateEnum
CREATE TYPE "DatasetSplit" AS ENUM ('TRAIN', 'VALIDATION', 'TEST', 'EXTERNAL_HOLDOUT');

-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('OPEN', 'CLAIMED', 'ANSWERED', 'ACCEPTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkBlockType" AS ENUM ('DEEP_WORK', 'LIGHT_ADMIN', 'NEURO_RECOVERY', 'SLEEP_TARGET', 'CLINICAL_CHECK');

-- CreateTable
CREATE TABLE "NeuralTrainingSample" (
    "id" UUID NOT NULL,
    "datasetId" VARCHAR(80),
    "uploaderId" UUID NOT NULL,
    "subjectCode" VARCHAR(60) NOT NULL,
    "clinicalCategory" "ClinicalCategory" NOT NULL,
    "groundTruthLabel" "NeuralLabel" NOT NULL,
    "split" "DatasetSplit" NOT NULL DEFAULT 'TRAIN',
    "samplingRateHz" INTEGER NOT NULL DEFAULT 500,
    "channelsCount" INTEGER NOT NULL DEFAULT 6,
    "montage" VARCHAR(200) NOT NULL,
    "signalQualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    "dar" DOUBLE PRECISION NOT NULL,
    "bsi" DOUBLE PRECISION NOT NULL,
    "tar" DOUBLE PRECISION NOT NULL,
    "pri" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "wpli" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "tpaLockoutTriggered" BOOLEAN NOT NULL DEFAULT false,
    "spectralBandsJson" TEXT NOT NULL,
    "featureVectorJson" TEXT NOT NULL,
    "waveformPreviewJson" TEXT NOT NULL,
    "verifiedById" UUID,
    "deidentifiedConfirmed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NeuralTrainingSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataBankListing" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "datasetId" VARCHAR(80),
    "title" VARCHAR(220) NOT NULL,
    "summary" VARCHAR(2000) NOT NULL,
    "clinicalCategory" "ClinicalCategory" NOT NULL,
    "methodologyNote" TEXT NOT NULL,
    "sampleCount" INTEGER NOT NULL DEFAULT 1,
    "channelsSpec" VARCHAR(160) NOT NULL,
    "samplingRateHz" INTEGER NOT NULL DEFAULT 500,
    "priceCredits" INTEGER NOT NULL DEFAULT 0,
    "downloadsCount" INTEGER NOT NULL DEFAULT 0,
    "previewMetricsJson" TEXT NOT NULL,
    "payloadCsvJson" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataBankListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataBankPurchase" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "buyerId" UUID NOT NULL,
    "creditsPaid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataBankPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationTicket" (
    "id" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "claimedById" UUID,
    "datasetId" VARCHAR(80),
    "neuralSampleId" UUID,
    "title" VARCHAR(200) NOT NULL,
    "symptomSummary" VARCHAR(2000) NOT NULL,
    "clinicalCategory" "ClinicalCategory" NOT NULL,
    "bountyCredits" INTEGER NOT NULL DEFAULT 50,
    "urgentRedFlag" BOOLEAN NOT NULL DEFAULT false,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'OPEN',
    "acceptedReplyId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationReply" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "responderId" UUID NOT NULL,
    "responderTier" VARCHAR(60) NOT NULL,
    "waveAnalysisText" TEXT NOT NULL,
    "clinicalGuidanceText" TEXT NOT NULL,
    "recommendedFollowUp" VARCHAR(500) NOT NULL,
    "rating" INTEGER,
    "isAccepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthCheckIn" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "neuralSampleId" UUID,
    "recordedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "focusScore" INTEGER NOT NULL,
    "fatigueIndexTar" DOUBLE PRECISION NOT NULL,
    "hemisphericBsi" DOUBLE PRECISION NOT NULL,
    "alphaPeakHz" DOUBLE PRECISION NOT NULL,
    "sleepHours" DOUBLE PRECISION NOT NULL,
    "stressLevel" INTEGER NOT NULL,
    "notes" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkingPlanBlock" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "dayOfWeek" VARCHAR(24) NOT NULL,
    "timeSlot" VARCHAR(40) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "blockType" "WorkBlockType" NOT NULL,
    "eegRationale" VARCHAR(500) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkingPlanBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NeuralTrainingSample_clinicalCategory_groundTruthLabel_idx" ON "NeuralTrainingSample"("clinicalCategory", "groundTruthLabel");
CREATE INDEX "NeuralTrainingSample_split_createdAt_idx" ON "NeuralTrainingSample"("split", "createdAt" DESC);
CREATE INDEX "NeuralTrainingSample_uploaderId_idx" ON "NeuralTrainingSample"("uploaderId");

-- CreateIndex
CREATE INDEX "DataBankListing_clinicalCategory_status_createdAt_idx" ON "DataBankListing"("clinicalCategory", "status", "createdAt" DESC);
CREATE INDEX "DataBankListing_authorId_idx" ON "DataBankListing"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "DataBankPurchase_listingId_buyerId_key" ON "DataBankPurchase"("listingId", "buyerId");
CREATE INDEX "DataBankPurchase_buyerId_idx" ON "DataBankPurchase"("buyerId");

-- CreateIndex
CREATE INDEX "ConsultationTicket_status_clinicalCategory_createdAt_idx" ON "ConsultationTicket"("status", "clinicalCategory", "createdAt" DESC);
CREATE INDEX "ConsultationTicket_requesterId_idx" ON "ConsultationTicket"("requesterId");
CREATE INDEX "ConsultationTicket_claimedById_idx" ON "ConsultationTicket"("claimedById");

-- CreateIndex
CREATE INDEX "ConsultationReply_ticketId_createdAt_idx" ON "ConsultationReply"("ticketId", "createdAt");
CREATE INDEX "ConsultationReply_responderId_idx" ON "ConsultationReply"("responderId");

-- CreateIndex
CREATE INDEX "HealthCheckIn_userId_recordedDate_idx" ON "HealthCheckIn"("userId", "recordedDate" DESC);

-- CreateIndex
CREATE INDEX "WorkingPlanBlock_userId_dayOfWeek_idx" ON "WorkingPlanBlock"("userId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "NeuralTrainingSample" ADD CONSTRAINT "NeuralTrainingSample_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NeuralTrainingSample" ADD CONSTRAINT "NeuralTrainingSample_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DataBankListing" ADD CONSTRAINT "DataBankListing_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DataBankPurchase" ADD CONSTRAINT "DataBankPurchase_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "DataBankListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataBankPurchase" ADD CONSTRAINT "DataBankPurchase_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConsultationTicket" ADD CONSTRAINT "ConsultationTicket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsultationTicket" ADD CONSTRAINT "ConsultationTicket_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsultationTicket" ADD CONSTRAINT "ConsultationTicket_neuralSampleId_fkey" FOREIGN KEY ("neuralSampleId") REFERENCES "NeuralTrainingSample"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConsultationReply" ADD CONSTRAINT "ConsultationReply_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ConsultationTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsultationReply" ADD CONSTRAINT "ConsultationReply_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HealthCheckIn" ADD CONSTRAINT "HealthCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkingPlanBlock" ADD CONSTRAINT "WorkingPlanBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
