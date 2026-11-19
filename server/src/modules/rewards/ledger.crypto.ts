import { createHmac, randomUUID } from 'node:crypto';
import type { CreditTransactionType, CreditWallet, Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';

export type CreditBucket = 'PROMO' | 'PURCHASED' | 'EARNED' | 'LOCKED' | 'MIXED';

export interface ChainedHashInput {
  prevHash: string;
  walletId: string;
  type: CreditTransactionType | string;
  bucket: CreditBucket | string;
  amount: number;
  balanceAfter: number;
  referenceId?: string | null;
}

export function computeLedgerTxHash(input: ChainedHashInput): string {
  const canonical = [
    input.prevHash,
    input.walletId,
    input.type,
    input.bucket,
    String(input.amount),
    String(input.balanceAfter),
    input.referenceId ?? '',
  ].join('|');

  return createHmac('sha256', env.LEDGER_HMAC_SECRET).update(canonical, 'utf8').digest('hex');
}

export function buildReceiveCodeFromWalletId(walletId: string): string {
  return `NL-${walletId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

export function formatFullWalletDto(wallet: CreditWallet) {
  return {
    id: wallet.id,
    userId: wallet.userId,
    balance: wallet.balance,
    promoCredits: wallet.promoCredits,
    purchasedCredits: wallet.purchasedCredits,
    earnedCredits: wallet.earnedCredits,
    lockedCredits: wallet.lockedCredits,
    totalEarned: wallet.totalEarned,
    totalSpent: wallet.totalSpent,
    receiveCode: wallet.receiveCode ?? buildReceiveCodeFromWalletId(wallet.id),
    bankBin: wallet.bankBin,
    bankName: wallet.bankName,
    bankAccountNo: wallet.bankAccountNo,
    bankAccountName: wallet.bankAccountName,
    headHash: wallet.headHash,
    updatedAt: wallet.updatedAt,
  };
}

/**
 * Ensures the user has a CreditWallet row and acquires a PostgreSQL row-level
 * exclusive lock (`SELECT ... FOR UPDATE`) inside `tx` so concurrent mutations
 * strictly serialize and can never double-spend.
 */
export async function lockWalletForUpdate(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<CreditWallet> {
  const candidateId = randomUUID();
  const candidateCode = buildReceiveCodeFromWalletId(candidateId);

  await tx.$executeRaw`
    INSERT INTO "CreditWallet" (
      "id", "userId", "balance", "promoCredits", "purchasedCredits", "earnedCredits",
      "lockedCredits", "totalEarned", "totalSpent", "receiveCode", "createdAt", "updatedAt"
    )
    VALUES (
      ${candidateId}::uuid, ${userId}::uuid, 0, 0, 0, 0, 0, 0, 0, ${candidateCode}, NOW(), NOW()
    )
    ON CONFLICT ("userId") DO NOTHING
  `;

  const rows = await tx.$queryRaw<CreditWallet[]>`
    SELECT * FROM "CreditWallet" WHERE "userId" = ${userId}::uuid FOR UPDATE
  `;

  const locked = rows[0];
  if (!locked) {
    throw new AppError(500, 'WALLET_LOCK_FAILED', 'Không thể khóa bản ghi ví Credit để giao dịch.');
  }

  let current = locked;
  if (!current.receiveCode) {
    current = await tx.creditWallet.update({
      where: { id: current.id },
      data: { receiveCode: buildReceiveCodeFromWalletId(current.id) },
    });
  }

  // Seal any legacy unhashed rows once while holding the row lock
  current = await sealLegacyUnchainedRowsInTx(tx, current);
  return current;
}

/**
 * Locks multiple user wallets in deterministic ascending UUID order to prevent
 * PostgreSQL deadlocks during P2P transfers and marketplace purchases.
 */
export async function lockWalletsDeterministic(
  tx: Prisma.TransactionClient,
  userIds: string[],
): Promise<Map<string, CreditWallet>> {
  const uniqueSorted = [...new Set(userIds)].sort((a, b) => a.localeCompare(b));
  const result = new Map<string, CreditWallet>();
  for (const uid of uniqueSorted) {
    const locked = await lockWalletForUpdate(tx, uid);
    result.set(uid, locked);
  }
  return result;
}

/**
 * Computes bucket deductions for internal platform spending (catalog, consultation escrow, databank):
 * spends least-liquid buckets first: promoCredits -> purchasedCredits -> earnedCredits.
 */
export function computeInternalSpendDeduction(
  wallet: Pick<CreditWallet, 'balance' | 'promoCredits' | 'purchasedCredits' | 'earnedCredits'>,
  cost: number,
): {
  nextBalance: number;
  nextPromo: number;
  nextPurchased: number;
  nextEarned: number;
  bucket: CreditBucket;
} {
  if (cost <= 0) {
    return {
      nextBalance: wallet.balance,
      nextPromo: wallet.promoCredits,
      nextPurchased: wallet.purchasedCredits,
      nextEarned: wallet.earnedCredits,
      bucket: 'PROMO',
    };
  }

  const availableBuckets = wallet.promoCredits + wallet.purchasedCredits + wallet.earnedCredits;
  if (wallet.balance < cost || availableBuckets < cost) {
    throw new AppError(
      400,
      'INSUFFICIENT_CREDITS',
      `Số dư Credit không đủ. Cần ${cost} Credit nhưng số dư hiện tại chỉ có ${wallet.balance} Credit.`,
    );
  }

  let remaining = cost;
  const fromPromo = Math.min(wallet.promoCredits, remaining);
  remaining -= fromPromo;

  const fromPurchased = Math.min(wallet.purchasedCredits, remaining);
  remaining -= fromPurchased;

  const fromEarned = Math.min(wallet.earnedCredits, remaining);
  remaining -= fromEarned;

  if (remaining > 0) {
    throw new AppError(
      400,
      'INSUFFICIENT_CREDITS',
      `Số dư Credit khả dụng không đủ để thanh toán ${cost} Credit.`,
    );
  }

  const usedBuckets: CreditBucket[] = [];
  if (fromPromo > 0) usedBuckets.push('PROMO');
  if (fromPurchased > 0) usedBuckets.push('PURCHASED');
  if (fromEarned > 0) usedBuckets.push('EARNED');

  const bucket: CreditBucket = usedBuckets.length === 1 ? usedBuckets[0]! : 'MIXED';

  return {
    nextBalance: wallet.balance - cost,
    nextPromo: wallet.promoCredits - fromPromo,
    nextPurchased: wallet.purchasedCredits - fromPurchased,
    nextEarned: wallet.earnedCredits - fromEarned,
    bucket,
  };
}

/**
 * Computes bucket deductions for P2P transfers:
 * STRICTLY forbids spending `promoCredits` (Sybil promo-laundering protection).
 * Deducts from `purchasedCredits` first, then `earnedCredits`.
 */
export function computeTransferableDeduction(
  wallet: Pick<CreditWallet, 'balance' | 'promoCredits' | 'purchasedCredits' | 'earnedCredits'>,
  amountCredits: number,
): {
  nextBalance: number;
  nextPromo: number;
  nextPurchased: number;
  nextEarned: number;
  bucket: CreditBucket;
} {
  const transferable = wallet.purchasedCredits + wallet.earnedCredits;

  if (transferable < amountCredits) {
    if (wallet.promoCredits > 0 && wallet.balance >= amountCredits) {
      throw new AppError(
        400,
        'PROMO_NOT_TRANSFERABLE',
        `Credit khuyến mãi (${wallet.promoCredits} Credit) chỉ sử dụng cho dịch vụ nội bộ trên NeuroLink, không được phép chuyển khoản P2P hoặc rút tiền mặt. Số dư có thể chuyển hiện tại: ${transferable} Credit.`,
      );
    }
    throw new AppError(
      400,
      'INSUFFICIENT_TRANSFERABLE_CREDITS',
      `Số dư Credit có thể chuyển không đủ. Cần ${amountCredits} Credit nhưng hiện có ${transferable} Credit khả dụng để chuyển.`,
    );
  }

  if (wallet.balance < amountCredits) {
    throw new AppError(
      400,
      'INSUFFICIENT_CREDITS',
      `Số dư Credit không đủ để chuyển ${amountCredits} Credit.`,
    );
  }

  const fromPurchased = Math.min(wallet.purchasedCredits, amountCredits);
  const fromEarned = amountCredits - fromPurchased;

  const bucket: CreditBucket =
    fromPurchased > 0 && fromEarned > 0 ? 'MIXED' : fromPurchased > 0 ? 'PURCHASED' : 'EARNED';

  return {
    nextBalance: wallet.balance - amountCredits,
    nextPromo: wallet.promoCredits,
    nextPurchased: wallet.purchasedCredits - fromPurchased,
    nextEarned: wallet.earnedCredits - fromEarned,
    bucket,
  };
}

export interface AppendChainedLedgerParams {
  wallet: CreditWallet;
  amount: number;
  balanceAfter: number;
  bucket: CreditBucket;
  type: CreditTransactionType;
  description: string;
  referenceId?: string | null;
  idempotencyKey?: string | null;
  actorId?: string | null;
  contributionId?: string | null;
  redemptionId?: string | null;
}

/**
 * Appends an immutable HMAC-SHA256 hash-chained `CreditTransaction` and advances `wallet.headHash`.
 * Ensures monotonic `createdAt` (+1ms on millisecond tie) so `ORDER BY createdAt` always matches chain order.
 */
export async function appendChainedLedgerEntry(
  tx: Prisma.TransactionClient,
  params: AppendChainedLedgerParams,
) {
  const lastTx = await tx.creditTransaction.findFirst({
    where: { walletId: params.wallet.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { createdAt: true, txHash: true },
  });

  const prevHash = params.wallet.headHash ?? lastTx?.txHash ?? 'GENESIS';
  const txHash = computeLedgerTxHash({
    prevHash,
    walletId: params.wallet.id,
    type: params.type,
    bucket: params.bucket,
    amount: params.amount,
    balanceAfter: params.balanceAfter,
    referenceId: params.referenceId ?? null,
  });

  const nowMs = Date.now();
  const minNextMs = lastTx ? lastTx.createdAt.getTime() + 1 : nowMs;
  const createdAt = new Date(Math.max(nowMs, minNextMs));

  const transaction = await tx.creditTransaction.create({
    data: {
      walletId: params.wallet.id,
      amount: params.amount,
      balanceAfter: params.balanceAfter,
      bucket: params.bucket,
      type: params.type,
      referenceId: params.referenceId ?? null,
      idempotencyKey: params.idempotencyKey ?? null,
      description: params.description,
      prevHash,
      txHash,
      actorId: params.actorId ?? null,
      contributionId: params.contributionId ?? null,
      redemptionId: params.redemptionId ?? null,
      createdAt,
    },
  });

  const updatedWallet = await tx.creditWallet.update({
    where: { id: params.wallet.id },
    data: { headHash: txHash },
  });

  return { transaction, wallet: updatedWallet, txHash, prevHash };
}

/**
 * One-time helper that seals legacy pre-migration `CreditTransaction` rows where `txHash IS NULL`.
 * Never alters rows that already have a `txHash` (which are also protected by PostgreSQL trigger).
 */
async function sealLegacyUnchainedRowsInTx(
  tx: Prisma.TransactionClient,
  wallet: CreditWallet,
): Promise<CreditWallet> {
  const unhashedCount = await tx.creditTransaction.count({
    where: { walletId: wallet.id, txHash: null },
  });

  if (unhashedCount === 0) {
    return wallet;
  }

  const allTxs = await tx.creditTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  let runningBalance = 0;
  let prevHash = 'GENESIS';

  for (const row of allTxs) {
    runningBalance += row.amount;
    if (row.txHash !== null && row.prevHash !== null) {
      prevHash = row.txHash;
      continue;
    }

    const effectiveBalanceAfter = row.balanceAfter ?? runningBalance;
    const effectiveBucket = row.bucket || 'PROMO';
    const computedHash = computeLedgerTxHash({
      prevHash,
      walletId: wallet.id,
      type: row.type,
      bucket: effectiveBucket,
      amount: row.amount,
      balanceAfter: effectiveBalanceAfter,
      referenceId: row.referenceId,
    });

    await tx.creditTransaction.update({
      where: { id: row.id },
      data: {
        balanceAfter: effectiveBalanceAfter,
        bucket: effectiveBucket,
        prevHash,
        txHash: computedHash,
      },
    });

    prevHash = computedHash;
  }

  return tx.creditWallet.update({
    where: { id: wallet.id },
    data: { headHash: prevHash },
  });
}

/**
 * Recomputes every `txHash` from `GENESIS` in chronological order and verifies
 * bucket conservation (`wallet.balance === promoCredits + purchasedCredits + earnedCredits`)
 * as well as ledger sum conservation against tampering.
 */
export async function verifyWalletIntegrity(userId: string) {
  await prisma.$transaction(async (tx) => {
    await lockWalletForUpdate(tx, userId);
  });

  const wallet = await prisma.creditWallet.findUniqueOrThrow({
    where: { userId },
  });

  const txs = await prisma.creditTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  const bucketSum = wallet.promoCredits + wallet.purchasedCredits + wallet.earnedCredits;
  const bucketsNonNegative =
    wallet.balance >= 0 &&
    wallet.promoCredits >= 0 &&
    wallet.purchasedCredits >= 0 &&
    wallet.earnedCredits >= 0 &&
    wallet.lockedCredits >= 0;

  let expectedPrevHash = 'GENESIS';
  let runningLedgerBalance = 0;
  let tamperedTxId: string | null = null;

  for (const row of txs) {
    runningLedgerBalance += row.amount;
    const expectedBalanceAfter = row.balanceAfter ?? runningLedgerBalance;
    const expectedHash = computeLedgerTxHash({
      prevHash: expectedPrevHash,
      walletId: wallet.id,
      type: row.type,
      bucket: row.bucket,
      amount: row.amount,
      balanceAfter: expectedBalanceAfter,
      referenceId: row.referenceId,
    });

    if (
      row.prevHash !== expectedPrevHash ||
      row.txHash !== expectedHash ||
      (row.balanceAfter !== null && row.balanceAfter !== runningLedgerBalance)
    ) {
      tamperedTxId = row.id;
      break;
    }

    expectedPrevHash = expectedHash;
  }

  const headMatches =
    txs.length === 0 ? wallet.headHash === null : wallet.headHash === expectedPrevHash;
  const ledgerSumMatchesBalance =
    txs.length === 0 ? wallet.balance === 0 : runningLedgerBalance === wallet.balance;
  const balanceMatchesLedger =
    bucketsNonNegative && wallet.balance === bucketSum && ledgerSumMatchesBalance;

  const valid = tamperedTxId === null && headMatches && balanceMatchesLedger;

  return {
    valid,
    checkedCount: txs.length,
    headHash: wallet.headHash,
    balanceMatchesLedger,
    tamperedTxId,
  };
}
