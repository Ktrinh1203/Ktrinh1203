-- AlterEnum: Add FinTech payment, P2P transfer, and bank payout transaction types
ALTER TYPE "CreditTransactionType" ADD VALUE IF NOT EXISTS 'TOPUP_VND';
ALTER TYPE "CreditTransactionType" ADD VALUE IF NOT EXISTS 'P2P_TRANSFER_OUT';
ALTER TYPE "CreditTransactionType" ADD VALUE IF NOT EXISTS 'P2P_TRANSFER_IN';
ALTER TYPE "CreditTransactionType" ADD VALUE IF NOT EXISTS 'PAYOUT_LOCK';
ALTER TYPE "CreditTransactionType" ADD VALUE IF NOT EXISTS 'PAYOUT_SETTLED';
ALTER TYPE "CreditTransactionType" ADD VALUE IF NOT EXISTS 'PAYOUT_REFUND';

-- CreateEnum
CREATE TYPE "PaymentOrderStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayoutRequestStatus" AS ENUM ('PENDING', 'PAID', 'REJECTED');

-- AlterTable: CreditWallet multi-bucket segregation, receiveCode, bank profile & cryptographic headHash
ALTER TABLE "CreditWallet"
  ADD COLUMN "promoCredits" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "purchasedCredits" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "earnedCredits" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedCredits" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "receiveCode" VARCHAR(32),
  ADD COLUMN "bankBin" VARCHAR(16),
  ADD COLUMN "bankName" VARCHAR(80),
  ADD COLUMN "bankAccountNo" VARCHAR(40),
  ADD COLUMN "bankAccountName" VARCHAR(120),
  ADD COLUMN "headHash" VARCHAR(64);

-- AlterTable: CreditTransaction cryptographic hash chain & bucket metadata
ALTER TABLE "CreditTransaction"
  ADD COLUMN "balanceAfter" INTEGER,
  ADD COLUMN "bucket" VARCHAR(20) NOT NULL DEFAULT 'PROMO',
  ADD COLUMN "prevHash" VARCHAR(64),
  ADD COLUMN "txHash" VARCHAR(64);

-- Backfill existing wallets so balance = promoCredits + purchasedCredits + earnedCredits and receiveCode is unique
UPDATE "CreditWallet"
SET
  "balance" = GREATEST("balance", 0),
  "promoCredits" = GREATEST("balance", 0),
  "purchasedCredits" = 0,
  "earnedCredits" = 0,
  "lockedCredits" = 0,
  "receiveCode" = 'NL-' || UPPER(SUBSTRING(REPLACE("id"::text, '-', ''), 1, 8))
WHERE "receiveCode" IS NULL;

-- Create wallet rows (+250 starter grant) for any existing User missing a wallet
WITH missing_users AS (
  SELECT u."id" AS user_id, gen_random_uuid() AS wallet_id
  FROM "User" u
  LEFT JOIN "CreditWallet" w ON w."userId" = u."id"
  WHERE w."id" IS NULL
),
inserted_wallets AS (
  INSERT INTO "CreditWallet" (
    "id", "userId", "balance", "promoCredits", "purchasedCredits", "earnedCredits",
    "lockedCredits", "totalEarned", "totalSpent", "receiveCode", "createdAt", "updatedAt"
  )
  SELECT
    m.wallet_id,
    m.user_id,
    250,
    250,
    0,
    0,
    0,
    250,
    0,
    'NL-' || UPPER(SUBSTRING(REPLACE(m.wallet_id::text, '-', ''), 1, 8)),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM missing_users m
  RETURNING "id", "userId"
)
INSERT INTO "CreditTransaction" (
  "id", "walletId", "amount", "balanceAfter", "bucket", "type",
  "referenceId", "idempotencyKey", "description", "actorId", "createdAt"
)
SELECT
  gen_random_uuid(),
  iw."id",
  250,
  250,
  'PROMO',
  'STARTER_GRANT',
  iw."userId"::text,
  'starter-grant:' || iw."userId"::text,
  'Cấp Credit khởi đầu hệ sinh thái NeuroLink (+250 Credit)',
  iw."userId",
  CURRENT_TIMESTAMP
FROM inserted_wallets iw
ON CONFLICT ("idempotencyKey") DO NOTHING;

-- Unique index & non-negative bucket CHECK constraint on CreditWallet
CREATE UNIQUE INDEX "CreditWallet_receiveCode_key" ON "CreditWallet"("receiveCode");

ALTER TABLE "CreditWallet"
  ADD CONSTRAINT "credit_wallet_non_negative_buckets"
  CHECK (
    "balance" >= 0
    AND "promoCredits" >= 0
    AND "purchasedCredits" >= 0
    AND "earnedCredits" >= 0
    AND "lockedCredits" >= 0
  );

-- CreateTable: PaymentOrder
CREATE TABLE "PaymentOrder" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "orderCode" VARCHAR(32) NOT NULL,
    "amountVnd" INTEGER NOT NULL,
    "creditsToGrant" INTEGER NOT NULL,
    "bonusCredits" INTEGER NOT NULL DEFAULT 0,
    "status" "PaymentOrderStatus" NOT NULL DEFAULT 'PENDING',
    "provider" VARCHAR(32) NOT NULL DEFAULT 'VIETQR',
    "providerTxId" VARCHAR(120),
    "qrPayload" VARCHAR(1000) NOT NULL,
    "vietQrImageUrl" VARCHAR(1000) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_order_positive_amounts" CHECK ("amountVnd" > 0 AND "creditsToGrant" > 0 AND "bonusCredits" >= 0)
);

-- CreateTable: PayoutRequest
CREATE TABLE "PayoutRequest" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "amountCredits" INTEGER NOT NULL,
    "amountVnd" INTEGER NOT NULL,
    "bankBin" VARCHAR(16) NOT NULL,
    "bankName" VARCHAR(80) NOT NULL,
    "bankAccountNo" VARCHAR(40) NOT NULL,
    "bankAccountName" VARCHAR(120) NOT NULL,
    "payoutVietQrUrl" VARCHAR(1000) NOT NULL,
    "status" "PayoutRequestStatus" NOT NULL DEFAULT 'PENDING',
    "bankRef" VARCHAR(120),
    "note" VARCHAR(500),
    "adminNote" VARCHAR(500),
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payout_request_positive_amounts" CHECK ("amountCredits" > 0 AND "amountVnd" > 0)
);

-- Indexes & Foreign Keys for PaymentOrder & PayoutRequest
CREATE UNIQUE INDEX "PaymentOrder_orderCode_key" ON "PaymentOrder"("orderCode");
CREATE UNIQUE INDEX "PaymentOrder_providerTxId_key" ON "PaymentOrder"("providerTxId");
CREATE INDEX "PaymentOrder_userId_createdAt_idx" ON "PaymentOrder"("userId", "createdAt" DESC);
CREATE INDEX "PaymentOrder_status_expiresAt_idx" ON "PaymentOrder"("status", "expiresAt");

CREATE INDEX "PayoutRequest_userId_createdAt_idx" ON "PayoutRequest"("userId", "createdAt" DESC);
CREATE INDEX "PayoutRequest_status_createdAt_idx" ON "PayoutRequest"("status", "createdAt" DESC);

ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Immutable Append-Only Cryptographic Ledger Trigger on CreditTransaction
CREATE OR REPLACE FUNCTION enforce_immutable_credit_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'IMMUTABLE_LEDGER_VIOLATION: CreditTransaction rows cannot be deleted';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW."amount" IS DISTINCT FROM OLD."amount"
       OR NEW."walletId" IS DISTINCT FROM OLD."walletId"
       OR NEW."type" IS DISTINCT FROM OLD."type"
       OR (OLD."txHash" IS NOT NULL AND NEW."txHash" IS DISTINCT FROM OLD."txHash")
       OR (OLD."prevHash" IS NOT NULL AND NEW."prevHash" IS DISTINCT FROM OLD."prevHash")
    THEN
      RAISE EXCEPTION 'IMMUTABLE_LEDGER_VIOLATION: CreditTransaction financial and cryptographic fields cannot be mutated';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_credit_transaction ON "CreditTransaction";
CREATE TRIGGER trg_immutable_credit_transaction
BEFORE UPDATE OR DELETE ON "CreditTransaction"
FOR EACH ROW
EXECUTE FUNCTION enforce_immutable_credit_transaction();
