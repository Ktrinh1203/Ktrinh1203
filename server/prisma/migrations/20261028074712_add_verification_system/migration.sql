-- CreateEnum
CREATE TYPE "VerificationRequestStatus" AS ENUM ('PENDING_REVIEW', 'IN_REVIEW', 'ADDITIONAL_INFO_REQUIRED', 'VERIFIED', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "CredentialDocumentType" AS ENUM ('MEDICAL_LICENSE', 'HOSPITAL_STAFF_CARD', 'ACADEMIC_DEGREE', 'INSTITUTION_AFFILIATION', 'ORCID_RECORD', 'OTHER');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'VERIFICATION_UPDATE';

-- AlterTable
ALTER TABLE "ProfessionalProfile" ADD COLUMN     "licenseOrOrcidNumber" VARCHAR(100);

-- CreateTable
CREATE TABLE "VerificationRequest" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "VerificationRequestStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "claimedTitle" VARCHAR(120) NOT NULL,
    "claimedSpecialty" VARCHAR(120) NOT NULL,
    "claimedInstitution" VARCHAR(160),
    "licenseOrOrcidNumber" VARCHAR(100),
    "submissionNotes" VARCHAR(1000),
    "reviewNotes" VARCHAR(1000),
    "rejectionReason" VARCHAR(500),
    "reviewerId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationDocument" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "documentType" "CredentialDocumentType" NOT NULL,
    "storagePath" VARCHAR(500) NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256Hash" CHAR(64) NOT NULL,
    "ocrData" JSONB,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationAuditLog" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "previousState" "VerificationRequestStatus",
    "newState" "VerificationRequestStatus",
    "reason" VARCHAR(1000),
    "ipAddress" VARCHAR(64),
    "userAgent" VARCHAR(300),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationRequest_status_createdAt_idx" ON "VerificationRequest"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "VerificationRequest_userId_idx" ON "VerificationRequest"("userId");

-- CreateIndex
CREATE INDEX "VerificationRequest_profileId_idx" ON "VerificationRequest"("profileId");

-- CreateIndex
CREATE INDEX "VerificationDocument_requestId_idx" ON "VerificationDocument"("requestId");

-- CreateIndex
CREATE INDEX "VerificationAuditLog_requestId_timestamp_idx" ON "VerificationAuditLog"("requestId", "timestamp" DESC);

-- AddForeignKey
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ProfessionalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VerificationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationAuditLog" ADD CONSTRAINT "VerificationAuditLog_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VerificationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationAuditLog" ADD CONSTRAINT "VerificationAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
