import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { PaymentOrder, PayoutRequest } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { AppError, badRequest, conflict, forbidden, notFound, unauthorized } from '../../lib/errors.js';
import { realtimeBus } from '../realtime/realtime.bus.js';
import {
  appendChainedLedgerEntry,
  computeTransferableDeduction,
  formatFullWalletDto,
  lockWalletForUpdate,
  lockWalletsDeterministic,
} from '../rewards/ledger.crypto.js';
import { getOrCreateUserWallet } from '../rewards/rewards.service.js';
import { userSummarySelect } from '../users/users.select.js';
import type {
  BankProfileInput,
  CreatePayoutRequestInput,
  CreateTopupOrderInput,
  ReviewPayoutRequestInput,
  TransferCreditsInput,
} from './payments.schemas.js';
import { buildVietQrImageUrl, buildVietQrPayload, normalizeAsciiLabel } from './vietqr.util.js';

export interface TopupPackage {
  id: string;
  label: string;
  amountVnd: number;
  credits: number;
  bonusCredits: number;
}

export const TOPUP_PACKAGES: readonly TopupPackage[] = [
  { id: 'pkg_50k', label: '50.000đ', amountVnd: 50_000, credits: 50, bonusCredits: 0 },
  { id: 'pkg_100k', label: '100.000đ', amountVnd: 100_000, credits: 105, bonusCredits: 5 },
  { id: 'pkg_200k', label: '200.000đ', amountVnd: 200_000, credits: 220, bonusCredits: 20 },
  { id: 'pkg_500k', label: '500.000đ', amountVnd: 500_000, credits: 575, bonusCredits: 75 },
] as const;

const ORDER_CODE_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DEFAULT_ORDER_TTL_SECONDS = 600;
const MIN_ORDER_TTL_SECONDS = 60;
export const PAYMENT_REMINDER_WINDOW_SECONDS = 60;

export function getOrderTtlSeconds(): number {
  const raw = process.env.PAYMENT_ORDER_TTL_SECONDS;
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_ORDER_TTL_SECONDS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_ORDER_TTL_SECONDS;
  }
  return Math.max(MIN_ORDER_TTL_SECONDS, Math.floor(parsed));
}

export const ORDER_TTL_MS = getOrderTtlSeconds() * 1000;

export function isSandboxTopupEnabled(userRole?: string): boolean {
  if (env.NODE_ENV !== 'production') {
    return true;
  }
  if (process.env.ENABLE_SANDBOX_PAYMENTS === 'true') {
    return true;
  }
  return userRole === 'ADMIN';
}

function generateOrderCode(): string {
  const bytes = randomBytes(8);
  let suffix = '';
  for (let i = 0; i < 8; i += 1) {
    suffix += ORDER_CODE_ALPHABET[bytes[i]! % ORDER_CODE_ALPHABET.length];
  }
  return `NL${suffix}`;
}

export function formatPaymentOrderDto(order: PaymentOrder) {
  return {
    id: order.id,
    userId: order.userId,
    orderCode: order.orderCode,
    amountVnd: order.amountVnd,
    creditsToGrant: order.creditsToGrant,
    bonusCredits: order.bonusCredits,
    status: order.status,
    provider: order.provider,
    providerTxId: order.providerTxId,
    qrPayload: order.qrPayload,
    vietQrImageUrl: order.vietQrImageUrl,
    bankBin: env.VIETQR_BANK_BIN,
    bankName: env.VIETQR_BANK_NAME,
    accountNo: env.VIETQR_ACCOUNT_NO,
    accountName: env.VIETQR_ACCOUNT_NAME,
    expiresAt: order.expiresAt,
    paidAt: order.paidAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function getTopupPackagesInfo(userRole?: string) {
  return {
    vndPerCredit: env.VND_PER_CREDIT,
    orderTtlSeconds: getOrderTtlSeconds(),
    reminderWindowSeconds: PAYMENT_REMINDER_WINDOW_SECONDS,
    sandboxEnabled: isSandboxTopupEnabled(userRole),
    serverNow: new Date().toISOString(),
    bankInfo: {
      bankBin: env.VIETQR_BANK_BIN,
      bankName: env.VIETQR_BANK_NAME,
      accountNo: env.VIETQR_ACCOUNT_NO,
      accountName: env.VIETQR_ACCOUNT_NAME,
    },
    packages: TOPUP_PACKAGES,
  };
}

export async function createTopupOrder(userId: string, input: CreateTopupOrderInput) {
  let amountVnd: number;
  let creditsToGrant: number;
  let bonusCredits = 0;

  if (input.packageId) {
    const pkg = TOPUP_PACKAGES.find((p) => p.id === input.packageId);
    if (!pkg) {
      throw badRequest('Gói nạp Credit không tồn tại.');
    }
    amountVnd = pkg.amountVnd;
    creditsToGrant = pkg.credits;
    bonusCredits = pkg.bonusCredits;
  } else {
    amountVnd = input.amountVnd!;
    if (amountVnd % env.VND_PER_CREDIT !== 0) {
      throw badRequest(
        `Số tiền nạp phải chia hết cho ${env.VND_PER_CREDIT.toLocaleString('vi-VN')} VNĐ để quy đổi tròn Credit.`,
      );
    }
    creditsToGrant = Math.floor(amountVnd / env.VND_PER_CREDIT);
    if (creditsToGrant < 1) {
      throw badRequest(`Số tiền nạp phải tối thiểu tương đương 1 Credit (${env.VND_PER_CREDIT} VNĐ).`);
    }
    bonusCredits = 0;
  }

  const orderTtlSeconds = getOrderTtlSeconds();

  const { order, now } = await prisma.$transaction(async (tx) => {
    // Serialize order creation per user so concurrent requests cannot leave multiple PENDING orders
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;

    const txNow = new Date();

    // 1. Expire any overdue PENDING orders of this user
    await tx.paymentOrder.updateMany({
      where: {
        userId,
        status: 'PENDING',
        expiresAt: { lte: txNow },
      },
      data: { status: 'EXPIRED' },
    });

    // 2. Cancel any remaining active PENDING orders so each user holds at most 1 active QR session
    await tx.paymentOrder.updateMany({
      where: {
        userId,
        status: 'PENDING',
      },
      data: { status: 'CANCELLED' },
    });

    let orderCode = generateOrderCode();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const collision = await tx.paymentOrder.findUnique({ where: { orderCode } });
      if (!collision) break;
      orderCode = generateOrderCode();
    }

    const qrPayload = buildVietQrPayload({
      bankBin: env.VIETQR_BANK_BIN,
      accountNo: env.VIETQR_ACCOUNT_NO,
      accountName: env.VIETQR_ACCOUNT_NAME,
      amountVnd,
      addInfo: orderCode,
    });

    const vietQrImageUrl = buildVietQrImageUrl({
      bankBin: env.VIETQR_BANK_BIN,
      accountNo: env.VIETQR_ACCOUNT_NO,
      accountName: env.VIETQR_ACCOUNT_NAME,
      amountVnd,
      addInfo: orderCode,
    });

    const expiresAt = new Date(txNow.getTime() + orderTtlSeconds * 1000);

    const created = await tx.paymentOrder.create({
      data: {
        userId,
        orderCode,
        amountVnd,
        creditsToGrant,
        bonusCredits,
        status: 'PENDING',
        provider: 'VIETQR',
        qrPayload,
        vietQrImageUrl,
        expiresAt,
      },
    });

    return { order: created, now: txNow };
  });

  return {
    order: formatPaymentOrderDto(order),
    serverNow: now.toISOString(),
    orderTtlSeconds,
    reminderWindowSeconds: PAYMENT_REMINDER_WINDOW_SECONDS,
  };
}

export async function listUserTopupOrders(userId: string) {
  const now = new Date();
  await prisma.paymentOrder.updateMany({
    where: {
      userId,
      status: 'PENDING',
      expiresAt: { lte: now },
    },
    data: { status: 'EXPIRED' },
  });

  const orders = await prisma.paymentOrder.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  return {
    orders: orders.map(formatPaymentOrderDto),
    serverNow: new Date().toISOString(),
  };
}

export async function getUserTopupOrderByCode(
  actorId: string,
  actorRole: string,
  orderCodeParam: string,
) {
  const orderCode = orderCodeParam.trim().toUpperCase();

  const order = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<PaymentOrder[]>`
      SELECT * FROM "PaymentOrder" WHERE "orderCode" = ${orderCode} FOR UPDATE
    `;
    const found = rows[0];
    if (!found) {
      throw notFound(`Không tìm thấy đơn nạp ${orderCode}.`);
    }
    if (actorRole !== 'ADMIN' && found.userId !== actorId) {
      throw forbidden('Bạn không có quyền xem đơn nạp này.');
    }

    if (found.status === 'PENDING' && new Date(found.expiresAt).getTime() <= Date.now()) {
      return tx.paymentOrder.update({
        where: { id: found.id },
        data: { status: 'EXPIRED' },
      });
    }

    return found;
  });

  return {
    order: formatPaymentOrderDto(order),
    serverNow: new Date().toISOString(),
    reminderWindowSeconds: PAYMENT_REMINDER_WINDOW_SECONDS,
  };
}

export async function cancelTopupOrder(
  actorId: string,
  actorRole: string,
  orderCodeParam: string,
) {
  const orderCode = orderCodeParam.trim().toUpperCase();

  const outcome = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<PaymentOrder[]>`
      SELECT * FROM "PaymentOrder" WHERE "orderCode" = ${orderCode} FOR UPDATE
    `;
    const found = rows[0];
    if (!found) {
      throw notFound(`Không tìm thấy đơn nạp ${orderCode}.`);
    }
    if (actorRole !== 'ADMIN' && found.userId !== actorId) {
      throw forbidden('Bạn không có quyền hủy đơn nạp này.');
    }

    if (found.status === 'PAID') {
      return { kind: 'ALREADY_PAID' as const, order: found };
    }

    if (found.status === 'CANCELLED' || found.status === 'EXPIRED') {
      return { kind: 'DONE' as const, order: found };
    }

    const nextStatus = new Date(found.expiresAt).getTime() <= Date.now() ? 'EXPIRED' : 'CANCELLED';
    const updated = await tx.paymentOrder.update({
      where: { id: found.id },
      data: { status: nextStatus },
    });
    return { kind: 'DONE' as const, order: updated };
  });

  if (outcome.kind === 'ALREADY_PAID') {
    throw conflict('Đơn đã thanh toán thành công, không thể hủy.', 'PAYMENT_ORDER_ALREADY_PAID');
  }

  return {
    order: formatPaymentOrderDto(outcome.order),
    serverNow: new Date().toISOString(),
  };
}

export function computeWebhookSignature(serializedBody: string): string {
  return createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET)
    .update(serializedBody, 'utf8')
    .digest('hex');
}

function safeCompareHexSignature(providedHex: string, expectedHex: string): boolean {
  if (!/^[0-9a-fA-F]{64}$/.test(providedHex)) {
    return false;
  }
  const a = Buffer.from(providedHex.toLowerCase(), 'hex');
  const b = Buffer.from(expectedHex.toLowerCase(), 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifyWebhookSignatureOrThrow(
  signatureHeader: string | undefined,
  body: unknown,
  rawBody?: string,
): void {
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    throw unauthorized('Thiếu chữ ký xác thực webhook (x-payment-signature)');
  }

  const trimmed = signatureHeader.trim().replace(/^sha256=/i, '');
  const canonicalJsonSig = computeWebhookSignature(JSON.stringify(body ?? {}));

  const matchesCanonical = safeCompareHexSignature(trimmed, canonicalJsonSig);
  const matchesRaw =
    typeof rawBody === 'string' && rawBody.length > 0
      ? safeCompareHexSignature(trimmed, computeWebhookSignature(rawBody))
      : false;

  if (!matchesCanonical && !matchesRaw) {
    throw unauthorized('Chữ ký HMAC-SHA256 của webhook không hợp lệ');
  }
}

export async function processBankTransferWebhook(
  body: Record<string, unknown>,
  signatureHeader: string | undefined,
  rawBody?: string,
) {
  verifyWebhookSignatureOrThrow(signatureHeader, body, rawBody);

  const textCandidates = [
    body.content,
    body.description,
    body.addInfo,
    body.orderCode,
  ]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join(' ');

  const codeMatch = textCandidates.match(/NL[A-Z0-9]{8}/i);
  if (!codeMatch) {
    throw badRequest('Không tìm thấy mã đơn nạp NeuroLink (NL...) trong nội dung chuyển khoản.');
  }
  const orderCode = codeMatch[0].toUpperCase();

  const rawAmount = body.transferAmount ?? body.amountVnd ?? body.amount;
  const transferAmount = typeof rawAmount === 'number' ? rawAmount : Number(rawAmount);
  if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
    throw badRequest('Số tiền giao dịch ngân hàng (transferAmount) không hợp lệ.');
  }

  const rawProviderTx =
    body.providerTxId ?? body.transactionId ?? body.referenceCode ?? body.id ?? null;
  const providerTxId =
    rawProviderTx !== null && rawProviderTx !== undefined && String(rawProviderTx).trim().length > 0
      ? String(rawProviderTx).trim().slice(0, 120)
      : null;

  const outcome = await prisma.$transaction(async (tx) => {
    const orderRows = await tx.$queryRaw<PaymentOrder[]>`
      SELECT * FROM "PaymentOrder" WHERE "orderCode" = ${orderCode} FOR UPDATE
    `;
    const order = orderRows[0];
    if (!order) {
      throw notFound(`Không tìm thấy đơn nạp với mã ${orderCode}.`);
    }

    // Idempotent replay defense: already marked PAID -> no double credit
    if (order.status === 'PAID') {
      const existingWallet = await lockWalletForUpdate(tx, order.userId);
      return {
        kind: 'PROCESSED' as const,
        newlyPaid: false,
        order,
        wallet: existingWallet,
      };
    }

    // Critical expiry & cancellation guard: persist EXPIRED state inside tx and reject outside tx (so DB update is not rolled back)
    if (order.status === 'PENDING' && new Date(order.expiresAt).getTime() <= Date.now()) {
      const expiredOrder = await tx.paymentOrder.update({
        where: { id: order.id },
        data: { status: 'EXPIRED' },
      });
      return {
        kind: 'EXPIRED' as const,
        order: expiredOrder,
      };
    }

    if (order.status === 'EXPIRED') {
      return {
        kind: 'EXPIRED' as const,
        order,
      };
    }

    if (order.status === 'CANCELLED') {
      return {
        kind: 'CANCELLED' as const,
        order,
      };
    }

    if (providerTxId) {
      const duplicateProvider = await tx.paymentOrder.findUnique({
        where: { providerTxId },
      });
      if (duplicateProvider) {
        if (duplicateProvider.id === order.id) {
          const existingWallet = await lockWalletForUpdate(tx, order.userId);
          return {
            kind: 'PROCESSED' as const,
            newlyPaid: false,
            order: duplicateProvider,
            wallet: existingWallet,
          };
        }
        throw conflict('Mã giao dịch ngân hàng này đã được đối soát cho một đơn nạp khác.', 'DUPLICATE_PROVIDER_TX');
      }
    }

    if (transferAmount < order.amountVnd) {
      throw new AppError(
        400,
        'UNDERPAID_ORDER',
        `Số tiền chuyển khoản (${transferAmount} VNĐ) nhỏ hơn giá trị đơn nạp (${order.amountVnd} VNĐ).`,
      );
    }

    const lockedWallet = await lockWalletForUpdate(tx, order.userId);
    const idempotencyKey = `topup-order:${order.id}`;
    const existingLedgerTx = await tx.creditTransaction.findUnique({
      where: { idempotencyKey },
    });

    if (existingLedgerTx) {
      const paidOrder = await tx.paymentOrder.update({
        where: { id: order.id },
        data: { status: 'PAID', paidAt: order.paidAt ?? new Date() },
      });
      return {
        kind: 'PROCESSED' as const,
        newlyPaid: false,
        order: paidOrder,
        wallet: lockedWallet,
      };
    }

    const effectiveProviderTxId = providerTxId ?? `VIETQR-${order.orderCode}-${order.id.slice(0, 8)}`;
    const updatedOrder = await tx.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        providerTxId: effectiveProviderTxId,
      },
    });

    const nextBalance = lockedWallet.balance + order.creditsToGrant;
    const updatedWallet = await tx.creditWallet.update({
      where: { id: lockedWallet.id },
      data: {
        balance: nextBalance,
        purchasedCredits: lockedWallet.purchasedCredits + order.creditsToGrant,
        totalEarned: lockedWallet.totalEarned + order.creditsToGrant,
      },
    });

    const { wallet: sealedWallet } = await appendChainedLedgerEntry(tx, {
      wallet: updatedWallet,
      amount: order.creditsToGrant,
      balanceAfter: nextBalance,
      bucket: 'PURCHASED',
      type: 'TOPUP_VND',
      referenceId: order.orderCode,
      idempotencyKey,
      description: `Nạp Credit qua VietQR #${order.orderCode} (${order.amountVnd.toLocaleString('vi-VN')}đ -> +${order.creditsToGrant} Credit)`,
      actorId: order.userId,
    });

    await tx.notification.create({
      data: {
        recipientId: order.userId,
        actorId: order.userId,
        type: 'REWARD_UPDATE',
        dedupeKey: `topup-paid:${order.id}`,
      },
    });

    return {
      kind: 'PROCESSED' as const,
      newlyPaid: true,
      order: updatedOrder,
      wallet: sealedWallet,
    };
  });

  if (outcome.kind === 'EXPIRED') {
    throw conflict(
      'Đơn nạp đã hết hạn thanh toán. Vui lòng tạo mã QR mới.',
      'PAYMENT_ORDER_EXPIRED',
    );
  }

  if (outcome.kind === 'CANCELLED') {
    throw conflict(
      `Đơn nạp ${orderCode} đã bị hủy. Vui lòng tạo mã QR mới.`,
      'PAYMENT_ORDER_CANCELLED',
    );
  }

  if (outcome.newlyPaid) {
    realtimeBus.emitToUser(outcome.order.userId, 'payment:paid', {
      orderCode: outcome.order.orderCode,
      creditsGranted: outcome.order.creditsToGrant,
      newBalance: outcome.wallet.balance,
    });
    realtimeBus.emitToUser(outcome.order.userId, 'wallet:updated', {
      balance: outcome.wallet.balance,
    });
  }

  return {
    received: true,
    idempotentReplay: !outcome.newlyPaid,
    order: formatPaymentOrderDto(outcome.order),
    wallet: formatFullWalletDto(outcome.wallet),
  };
}

export async function simulateOrderPaid(
  actorId: string,
  actorRole: string,
  orderCodeParam: string,
) {
  if (!isSandboxTopupEnabled(actorRole)) {
    throw forbidden('Chức năng giả lập thanh toán chỉ khả dụng trong môi trường Sandbox/Dev hoặc cho Quản trị viên.');
  }

  const orderCode = orderCodeParam.trim().toUpperCase();

  const precheck = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<PaymentOrder[]>`
      SELECT * FROM "PaymentOrder" WHERE "orderCode" = ${orderCode} FOR UPDATE
    `;
    const order = rows[0];
    if (!order) {
      throw notFound(`Không tìm thấy đơn nạp ${orderCode}.`);
    }
    if (actorRole !== 'ADMIN' && order.userId !== actorId) {
      throw forbidden('Bạn chỉ có thể xác nhận thử đơn nạp của chính mình.');
    }

    if (order.status === 'PAID') {
      const existingWallet = await lockWalletForUpdate(tx, order.userId);
      return { kind: 'PAID' as const, order, wallet: existingWallet };
    }

    if (order.status === 'CANCELLED') {
      return { kind: 'CANCELLED' as const, order };
    }

    if (order.status === 'EXPIRED') {
      return { kind: 'EXPIRED' as const, order };
    }

    if (order.status === 'PENDING' && new Date(order.expiresAt).getTime() <= Date.now()) {
      const expiredOrder = await tx.paymentOrder.update({
        where: { id: order.id },
        data: { status: 'EXPIRED' },
      });
      return { kind: 'EXPIRED' as const, order: expiredOrder };
    }

    return { kind: 'READY' as const, order };
  });

  if (precheck.kind === 'PAID') {
    return {
      order: formatPaymentOrderDto(precheck.order),
      wallet: formatFullWalletDto(precheck.wallet),
    };
  }

  if (precheck.kind === 'CANCELLED') {
    throw conflict(
      `Đơn nạp ${orderCode} đã bị hủy. Vui lòng tạo mã QR mới.`,
      'PAYMENT_ORDER_CANCELLED',
    );
  }

  if (precheck.kind === 'EXPIRED') {
    throw conflict(
      'Đơn nạp đã hết hạn thanh toán. Vui lòng tạo mã QR mới.',
      'PAYMENT_ORDER_EXPIRED',
    );
  }

  const simulatedPayload = {
    content: `SANDBOX VIETQR ${precheck.order.orderCode}`,
    transferAmount: precheck.order.amountVnd,
    providerTxId: `SANDBOX-${precheck.order.orderCode}`,
  };
  const signature = computeWebhookSignature(JSON.stringify(simulatedPayload));

  const processed = await processBankTransferWebhook(simulatedPayload, signature);
  return {
    order: processed.order,
    wallet: processed.wallet,
  };
}

function computeUserVietQrReceiveUrl(wallet: {
  receiveCode: string | null;
  bankBin: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
}): string | null {
  if (!wallet.bankBin || !wallet.bankAccountNo || !wallet.bankAccountName) {
    return null;
  }
  return buildVietQrImageUrl({
    bankBin: wallet.bankBin,
    accountNo: wallet.bankAccountNo,
    accountName: wallet.bankAccountName,
    addInfo: wallet.receiveCode ?? undefined,
  });
}

export async function getUserReceiveInfo(userId: string) {
  const [user, wallet] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, username: true, displayName: true },
    }),
    getOrCreateUserWallet(userId),
  ]);

  const formatted = formatFullWalletDto(wallet);
  const receiveCode = formatted.receiveCode;

  return {
    receiveCode,
    username: user.username,
    displayName: user.displayName,
    qrPayload: `NEUROLINK_PAY:${receiveCode}`,
    bankProfile: {
      bankBin: wallet.bankBin,
      bankName: wallet.bankName,
      bankAccountNo: wallet.bankAccountNo,
      bankAccountName: wallet.bankAccountName,
    },
    vietQrReceiveUrl: computeUserVietQrReceiveUrl(wallet),
  };
}

export async function updateUserBankProfile(userId: string, input: BankProfileInput) {
  const normalizedHolder = normalizeAsciiLabel(input.bankAccountName, 120) || input.bankAccountName.trim().toUpperCase();

  const updated = await prisma.$transaction(async (tx) => {
    const locked = await lockWalletForUpdate(tx, userId);
    return tx.creditWallet.update({
      where: { id: locked.id },
      data: {
        bankBin: input.bankBin.trim(),
        bankName: input.bankName.trim(),
        bankAccountNo: input.bankAccountNo.trim(),
        bankAccountName: normalizedHolder,
      },
    });
  });

  return {
    wallet: formatFullWalletDto(updated),
    vietQrReceiveUrl: computeUserVietQrReceiveUrl(updated),
  };
}

export async function transferCreditsP2P(senderId: string, input: TransferCreditsInput) {
  const rawTarget = input.recipientCodeOrUsername
    .trim()
    .replace(/^NEUROLINK_PAY:/i, '')
    .replace(/^@/, '')
    .trim();

  // Resolve recipient by receiveCode (NL-...) or username
  let recipientUserId: string | null = null;
  let recipientUsername = '';

  const walletByCode = await prisma.creditWallet.findFirst({
    where: { receiveCode: { equals: rawTarget, mode: 'insensitive' } },
    include: { user: { select: { id: true, username: true, status: true } } },
  });

  if (walletByCode) {
    if (walletByCode.user.status !== 'ACTIVE') {
      throw badRequest('Tài khoản người nhận hiện không hoạt động.');
    }
    recipientUserId = walletByCode.user.id;
    recipientUsername = walletByCode.user.username;
  } else {
    const userByUsername = await prisma.user.findUnique({
      where: { username: rawTarget.toLowerCase() },
      select: { id: true, username: true, status: true },
    });
    if (userByUsername) {
      if (userByUsername.status !== 'ACTIVE') {
        throw badRequest('Tài khoản người nhận hiện không hoạt động.');
      }
      recipientUserId = userByUsername.id;
      recipientUsername = userByUsername.username;
    }
  }

  if (!recipientUserId) {
    throw notFound('Không tìm thấy người nhận với mã nhận tiền hoặc username đã nhập.');
  }

  if (recipientUserId === senderId) {
    throw badRequest('Không thể tự chuyển Credit cho chính mình.');
  }

  const senderUser = await prisma.user.findUniqueOrThrow({
    where: { id: senderId },
    select: { username: true },
  });

  const targetId = recipientUserId;
  const outIdempotencyKey = input.idempotencyKey
    ? `p2p-out:${senderId}:${input.idempotencyKey}`
    : null;

  const result = await prisma.$transaction(async (tx) => {
    // Lock BOTH wallets in deterministic ascending UUID order to guarantee zero deadlocks
    const lockedMap = await lockWalletsDeterministic(tx, [senderId, targetId]);
    const senderLocked = lockedMap.get(senderId)!;
    const recipientLocked = lockedMap.get(targetId)!;

    if (outIdempotencyKey) {
      const existingOut = await tx.creditTransaction.findUnique({
        where: { idempotencyKey: outIdempotencyKey },
      });
      if (existingOut) {
        return {
          idempotentReplay: true,
          transferId: existingOut.referenceId ?? existingOut.id,
          senderWallet: senderLocked,
          recipientWallet: recipientLocked,
        };
      }
    }

    // Enforce anti-Sybil promo rule: ONLY purchasedCredits and earnedCredits can be transferred
    const deduction = computeTransferableDeduction(senderLocked, input.amountCredits);
    const transferId = randomUUID();
    const noteSuffix = input.note ? ` · Ghi chú: ${input.note}` : '';

    const senderUpdated = await tx.creditWallet.update({
      where: { id: senderLocked.id },
      data: {
        balance: deduction.nextBalance,
        promoCredits: deduction.nextPromo,
        purchasedCredits: deduction.nextPurchased,
        earnedCredits: deduction.nextEarned,
        totalSpent: { increment: input.amountCredits },
      },
    });

    const { wallet: senderSealed } = await appendChainedLedgerEntry(tx, {
      wallet: senderUpdated,
      amount: -input.amountCredits,
      balanceAfter: deduction.nextBalance,
      bucket: deduction.bucket,
      type: 'P2P_TRANSFER_OUT',
      referenceId: transferId,
      idempotencyKey: outIdempotencyKey ?? `p2p-out:${transferId}`,
      description: `Chuyển ${input.amountCredits} Credit tới @${recipientUsername}${noteSuffix}`,
      actorId: senderId,
    });

    const nextRecipientBalance = recipientLocked.balance + input.amountCredits;
    const recipientUpdated = await tx.creditWallet.update({
      where: { id: recipientLocked.id },
      data: {
        balance: nextRecipientBalance,
        earnedCredits: recipientLocked.earnedCredits + input.amountCredits,
        totalEarned: recipientLocked.totalEarned + input.amountCredits,
      },
    });

    const { wallet: recipientSealed } = await appendChainedLedgerEntry(tx, {
      wallet: recipientUpdated,
      amount: input.amountCredits,
      balanceAfter: nextRecipientBalance,
      bucket: 'EARNED',
      type: 'P2P_TRANSFER_IN',
      referenceId: transferId,
      idempotencyKey: `p2p-in:${transferId}`,
      description: `Nhận ${input.amountCredits} Credit từ @${senderUser.username}${noteSuffix}`,
      actorId: senderId,
    });

    await tx.notification.create({
      data: {
        recipientId: targetId,
        actorId: senderId,
        type: 'REWARD_UPDATE',
        dedupeKey: `p2p-transfer:${transferId}`,
      },
    });

    return {
      idempotentReplay: false,
      transferId,
      senderWallet: senderSealed,
      recipientWallet: recipientSealed,
    };
  });

  if (!result.idempotentReplay) {
    realtimeBus.emitToUser(senderId, 'wallet:updated', {
      transferId: result.transferId,
      balance: result.senderWallet.balance,
    });
    realtimeBus.emitToUser(targetId, 'wallet:updated', {
      transferId: result.transferId,
      balance: result.recipientWallet.balance,
      receivedCredits: input.amountCredits,
    });
  }

  return {
    transferId: result.transferId,
    senderWallet: formatFullWalletDto(result.senderWallet),
  };
}

export async function createPayoutRequest(userId: string, input: CreatePayoutRequestInput) {
  const customIdempotencyKey = input.idempotencyKey
    ? `payout-lock:${createHash('sha256').update(`${userId}:${input.idempotencyKey}`).digest('hex')}`
    : null;

  const result = await prisma.$transaction(async (tx) => {
    const locked = await lockWalletForUpdate(tx, userId);

    if (customIdempotencyKey) {
      const existingLockTx = await tx.creditTransaction.findUnique({
        where: { idempotencyKey: customIdempotencyKey },
      });
      if (existingLockTx?.referenceId) {
        const existingPayout = await tx.payoutRequest.findUnique({
          where: { id: existingLockTx.referenceId },
        });
        if (existingPayout && existingPayout.userId === userId) {
          return {
            idempotentReplay: true,
            payout: existingPayout,
            wallet: locked,
          };
        }
      }
    }

    const bankBin = input.bankBin?.trim() || locked.bankBin;
    const bankName = input.bankName?.trim() || locked.bankName;
    const bankAccountNo = input.bankAccountNo?.trim() || locked.bankAccountNo;
    const bankAccountName = input.bankAccountName
      ? normalizeAsciiLabel(input.bankAccountName, 120) || input.bankAccountName.trim().toUpperCase()
      : locked.bankAccountName;

    if (!bankBin || !bankName || !bankAccountNo || !bankAccountName) {
      throw new AppError(
        400,
        'BANK_PROFILE_REQUIRED',
        'Vui lòng liên kết thông tin ngân hàng nhận tiền VietQR trước khi tạo yêu cầu rút tiền.',
      );
    }

    if (locked.earnedCredits < input.amountCredits || locked.balance < input.amountCredits) {
      throw new AppError(
        400,
        'INSUFFICIENT_EARNED_CREDITS',
        `Chỉ Credit thu nhập (tư vấn, tác quyền dữ liệu, nhận chuyển khoản) mới được rút về ngân hàng. Số dư Credit thu nhập hiện tại: ${locked.earnedCredits} Credit (cần ${input.amountCredits} Credit).`,
      );
    }

    const payoutId = randomUUID();
    const amountVnd = input.amountCredits * env.VND_PER_CREDIT;
    const payoutRef = `NLPAYOUT${payoutId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
    const payoutVietQrUrl = buildVietQrImageUrl({
      bankBin,
      accountNo: bankAccountNo,
      accountName: bankAccountName,
      amountVnd,
      addInfo: payoutRef,
    });

    const nextBalance = locked.balance - input.amountCredits;
    const updatedWallet = await tx.creditWallet.update({
      where: { id: locked.id },
      data: {
        balance: nextBalance,
        earnedCredits: locked.earnedCredits - input.amountCredits,
        lockedCredits: locked.lockedCredits + input.amountCredits,
        totalSpent: locked.totalSpent + input.amountCredits,
        bankBin,
        bankName,
        bankAccountNo,
        bankAccountName,
      },
    });

    const payout = await tx.payoutRequest.create({
      data: {
        id: payoutId,
        userId,
        amountCredits: input.amountCredits,
        amountVnd,
        bankBin,
        bankName,
        bankAccountNo,
        bankAccountName,
        payoutVietQrUrl,
        status: 'PENDING',
        note: input.note || null,
      },
    });

    const { wallet: sealedWallet } = await appendChainedLedgerEntry(tx, {
      wallet: updatedWallet,
      amount: -input.amountCredits,
      balanceAfter: nextBalance,
      bucket: 'EARNED',
      type: 'PAYOUT_LOCK',
      referenceId: payout.id,
      idempotencyKey: customIdempotencyKey ?? `payout-lock:${payout.id}`,
      description: `Khóa ký quỹ rút tiền ngân hàng ${bankName} (${amountVnd.toLocaleString('vi-VN')}đ · -${input.amountCredits} Credit)`,
      actorId: userId,
    });

    return { idempotentReplay: false, payout, wallet: sealedWallet };
  });

  if (!result.idempotentReplay) {
    realtimeBus.emitToUser(userId, 'wallet:updated', { balance: result.wallet.balance });
  }
  return {
    payout: result.payout,
    wallet: formatFullWalletDto(result.wallet),
    idempotentReplay: result.idempotentReplay,
  };
}

export async function listPayoutRequests(userId: string, role: string, scope?: string) {
  if (role === 'ADMIN' && scope === 'all') {
    const payouts = await prisma.payoutRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: userSummarySelect },
        reviewedBy: { select: { id: true, username: true, displayName: true } },
      },
    });
    return { payouts };
  }

  const payouts = await prisma.payoutRequest.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return { payouts };
}

export async function reviewPayoutRequest(
  adminId: string,
  payoutId: string,
  input: ReviewPayoutRequestInput,
) {
  const normalizedDecision =
    input.decision ??
    (input.action === 'APPROVE' || input.action === 'PAID' ? 'PAID' : 'REJECTED');

  const result = await prisma.$transaction(async (tx) => {
    const payoutRows = await tx.$queryRaw<PayoutRequest[]>`
      SELECT * FROM "PayoutRequest" WHERE "id" = ${payoutId}::uuid FOR UPDATE
    `;
    const payout = payoutRows[0];
    if (!payout) {
      throw notFound('Yêu cầu rút tiền không tồn tại.');
    }
    if (payout.status !== 'PENDING') {
      throw badRequest('Yêu cầu rút tiền này đã được xử lý trước đó.');
    }

    const lockedWallet = await lockWalletForUpdate(tx, payout.userId);
    let finalWallet = lockedWallet;

    if (normalizedDecision === 'PAID') {
      const updatedWallet = await tx.creditWallet.update({
        where: { id: lockedWallet.id },
        data: {
          lockedCredits: Math.max(0, lockedWallet.lockedCredits - payout.amountCredits),
        },
      });

      const { wallet: sealed } = await appendChainedLedgerEntry(tx, {
        wallet: updatedWallet,
        amount: 0,
        balanceAfter: updatedWallet.balance,
        bucket: 'LOCKED',
        type: 'PAYOUT_SETTLED',
        referenceId: payout.id,
        idempotencyKey: `payout-settled:${payout.id}`,
        description: `Đã giải ngân ${payout.amountVnd.toLocaleString('vi-VN')}đ về ${payout.bankName} (${payout.bankAccountNo})`,
        actorId: adminId,
      });
      finalWallet = sealed;
    } else {
      const nextBalance = lockedWallet.balance + payout.amountCredits;
      const updatedWallet = await tx.creditWallet.update({
        where: { id: lockedWallet.id },
        data: {
          balance: nextBalance,
          earnedCredits: lockedWallet.earnedCredits + payout.amountCredits,
          lockedCredits: Math.max(0, lockedWallet.lockedCredits - payout.amountCredits),
          totalSpent: Math.max(0, lockedWallet.totalSpent - payout.amountCredits),
        },
      });

      const { wallet: sealed } = await appendChainedLedgerEntry(tx, {
        wallet: updatedWallet,
        amount: payout.amountCredits,
        balanceAfter: nextBalance,
        bucket: 'EARNED',
        type: 'PAYOUT_REFUND',
        referenceId: payout.id,
        idempotencyKey: `payout-refund:${payout.id}`,
        description: `Hoàn trả ${payout.amountCredits} Credit thu nhập do từ chối yêu cầu rút tiền${input.adminNote ? `: ${input.adminNote}` : ''}`,
        actorId: adminId,
      });
      finalWallet = sealed;
    }

    const updatedPayout = await tx.payoutRequest.update({
      where: { id: payout.id },
      data: {
        status: normalizedDecision,
        bankRef: input.bankRef || null,
        adminNote: input.adminNote || null,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });

    await tx.notification.create({
      data: {
        recipientId: payout.userId,
        actorId: adminId,
        type: 'REWARD_UPDATE',
        dedupeKey: `payout-review:${payout.id}:${normalizedDecision}`,
      },
    });

    return { payout: updatedPayout, wallet: finalWallet };
  });

  realtimeBus.emitToUser(result.payout.userId, 'wallet:updated', {
    payoutId: result.payout.id,
    status: result.payout.status,
    balance: result.wallet.balance,
  });

  return {
    payout: result.payout,
    wallet: formatFullWalletDto(result.wallet),
  };
}
