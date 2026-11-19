import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { getApp, makeAdmin, ORIGIN, registerUser, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

/** Minimal valid 1x1 transparent PNG binary buffer (67 bytes). */
const VALID_1X1_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
    '0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex',
);

/** Builds a minimal valid JPEG with an embedded APP1 (0xFFE1) EXIF/GPS segment before SOS (0xFFDA). */
function buildJpegWithExifGps(): Buffer {
  const soi = Buffer.from([0xff, 0xd8]);
  const exifPayload = Buffer.from('Exif\x00\x00FAKE_GPS_COORDINATES_16.0544N_108.2022E', 'latin1');
  const app1Len = Buffer.alloc(2);
  app1Len.writeUInt16BE(exifPayload.length + 2, 0);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), app1Len, exifPayload]);

  const app0Payload = Buffer.from('JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00', 'latin1');
  const app0Len = Buffer.alloc(2);
  app0Len.writeUInt16BE(app0Payload.length + 2, 0);
  const app0 = Buffer.concat([Buffer.from([0xff, 0xe0]), app0Len, app0Payload]);

  const sos = Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7f]);
  const eoi = Buffer.from([0xff, 0xd9]);
  return Buffer.concat([soi, app0, app1, sos, eoi]);
}

function signWebhookPayload(payload: object, secret = env.PAYMENT_WEBHOOK_SECRET): string {
  return createHmac('sha256', secret).update(JSON.stringify(payload), 'utf8').digest('hex');
}

describe('Adversarial FinTech Ledger, VietQR Payments & Cybersecurity Hardening Suite', () => {
  it('1. Auto-Wallet on Register: atomically provisions 250 promoCredits with valid HMAC-SHA256 GENESIS hash chain', async () => {
    const alice = await registerUser({ username: 'fintech_alice' });

    const walletRes = await alice.get('/api/rewards/wallet').expect(200);
    const { wallet, transactions } = walletRes.body;

    expect(wallet.balance).toBe(250);
    expect(wallet.promoCredits).toBe(250);
    expect(wallet.purchasedCredits).toBe(0);
    expect(wallet.earnedCredits).toBe(0);
    expect(wallet.lockedCredits).toBe(0);
    expect(typeof wallet.receiveCode).toBe('string');
    expect(wallet.receiveCode.startsWith('NL-')).toBe(true);
    expect(typeof wallet.headHash).toBe('string');
    expect(wallet.headHash).toMatch(/^[a-f0-9]{64}$/);

    expect(transactions).toHaveLength(1);
    expect(transactions[0].type).toBe('STARTER_GRANT');
    expect(transactions[0].bucket).toBe('PROMO');
    expect(transactions[0].amount).toBe(250);
    expect(transactions[0].balanceAfter).toBe(250);
    expect(transactions[0].prevHash).toBe('GENESIS');
    expect(transactions[0].txHash).toBe(wallet.headHash);

    const integrity = (await alice.get('/api/rewards/wallet/verify-integrity').expect(200)).body;
    expect(integrity).toEqual({
      valid: true,
      checkedCount: 1,
      headHash: wallet.headHash,
      balanceMatchesLedger: true,
      tamperedTxId: null,
    });
  });

  it('2. VietQR Top-Up + HMAC Webhook Forgery, Underpayment & Replay Idempotency Defense', async () => {
    const buyer = await registerUser({ username: 'vietqr_buyer' });

    const pkgRes = await buyer.get('/api/payments/packages').expect(200);
    expect(pkgRes.body.packages.length).toBeGreaterThanOrEqual(4);

    // Create 50,000 VND top-up order -> 50 Credits
    const orderRes = await buyer.post('/api/payments/topup-orders', { amountVnd: 50000 }).expect(201);
    const order = orderRes.body.order;

    expect(order.orderCode).toMatch(/^NL[A-Z0-9]{8}$/);
    expect(order.amountVnd).toBe(50000);
    expect(order.creditsToGrant).toBe(50);
    expect(order.status).toBe('PENDING');
    expect(order.qrPayload.startsWith('000201')).toBe(true);
    expect(order.qrPayload).toContain('6304');
    expect(order.vietQrImageUrl).toContain('https://img.vietqr.io/image/');
    expect(order.vietQrImageUrl).toContain(encodeURIComponent(order.orderCode));

    const validWebhookBody = {
      gateway: 'MBBank-VietQR',
      transactionId: `FT-${Date.now()}-001`,
      transferAmount: 50000,
      content: `Chuyen khoan ${order.orderCode} nap vi NeuroLink`,
    };

    // Attack 2a: Missing x-payment-signature header -> 401 (also proves public route bypasses CSRF 403)
    await request(getApp())
      .post('/api/payments/webhook/bank-transfer')
      .send(validWebhookBody)
      .expect(401);

    // Attack 2b: Forged HMAC signature -> 401
    await request(getApp())
      .post('/api/payments/webhook/bank-transfer')
      .set('x-payment-signature', signWebhookPayload(validWebhookBody, 'attacker-wrong-secret-key'))
      .send(validWebhookBody)
      .expect(401);

    // Attack 2c: Valid HMAC signature but underpaid amount (10,000 < 50,000 VND) -> rejected (400)
    const underpaidBody = {
      ...validWebhookBody,
      transactionId: `FT-${Date.now()}-UNDER`,
      transferAmount: 10000,
    };
    const underpaidRes = await request(getApp())
      .post('/api/payments/webhook/bank-transfer')
      .set('x-payment-signature', signWebhookPayload(underpaidBody))
      .send(underpaidBody)
      .expect(400);
    expect(underpaidRes.body.error.code).toBe('UNDERPAID_ORDER');

    // Legitimate signed bank webhook -> 200 PAID, credits purchasedCredits
    const paidWebhookRes = await request(getApp())
      .post('/api/payments/webhook/bank-transfer')
      .set('x-payment-signature', signWebhookPayload(validWebhookBody))
      .send(validWebhookBody)
      .expect(200);
    expect(paidWebhookRes.body.received).toBe(true);
    expect(paidWebhookRes.body.idempotentReplay).toBe(false);
    expect(paidWebhookRes.body.order.status).toBe('PAID');

    const walletAfterFirst = (await buyer.get('/api/rewards/wallet').expect(200)).body.wallet;
    expect(walletAfterFirst.purchasedCredits).toBe(50);
    expect(walletAfterFirst.promoCredits).toBe(250);
    expect(walletAfterFirst.balance).toBe(300);

    // Attack 2d: Replay the exact same signed webhook payload a 2nd time -> idempotent, NO double-credit!
    const replayRes = await request(getApp())
      .post('/api/payments/webhook/bank-transfer')
      .set('x-payment-signature', signWebhookPayload(validWebhookBody))
      .send(validWebhookBody)
      .expect(200);
    expect(replayRes.body.idempotentReplay).toBe(true);

    const walletAfterReplay = (await buyer.get('/api/rewards/wallet').expect(200)).body.wallet;
    expect(walletAfterReplay.purchasedCredits).toBe(50);
    expect(walletAfterReplay.balance).toBe(300);

    const ordersList = (await buyer.get('/api/payments/topup-orders').expect(200)).body.orders;
    const updatedOrder = ordersList.find((o: any) => o.orderCode === order.orderCode);
    expect(updatedOrder.status).toBe('PAID');

    const integrity = (await buyer.get('/api/rewards/wallet/verify-integrity').expect(200)).body;
    expect(integrity.valid).toBe(true);
    expect(integrity.checkedCount).toBe(2);
    expect(integrity.balanceMatchesLedger).toBe(true);
  });

  it('3. Parallel Race-Condition / Double-Spending Attack (Promise.all): 6 concurrent 80-credit transfers against 100 purchasedCredits', async () => {
    const admin = await registerUser({ username: 'race_admin' });
    await makeAdmin(admin.user.id);
    const sender = await registerUser({ username: 'race_sender' });
    const recipient = await registerUser({ username: 'race_recipient' });

    // Consume sender's 250 starter promoCredits via general catalog redemption so wallet starts at 0
    const generalReward = (
      await admin
        .post('/api/admin/rewards/catalog', {
          name: 'Gói Báo cáo Phân tích Giấc ngủ Cá nhân',
          description: 'Dành cho mọi thành viên NeuroLink.',
          category: 'OTHER_BENEFIT',
          creditCost: 250,
          stockQuantity: 10,
        })
        .expect(201)
    ).body.reward;
    await sender.post('/api/rewards/redeem', { rewardId: generalReward.id }).expect(201);

    // Top up 100,000 VND custom amount -> 100 purchasedCredits, total balance = 100
    const ordRes = await sender.post('/api/payments/topup-orders', { amountVnd: 100000 }).expect(201);
    await sender
      .post(`/api/payments/topup-orders/${ordRes.body.order.orderCode}/simulate-paid`)
      .expect(200);

    const preRaceWallet = (await sender.get('/api/rewards/wallet').expect(200)).body.wallet;
    expect(preRaceWallet.promoCredits).toBe(0);
    expect(preRaceWallet.purchasedCredits).toBe(100);
    expect(preRaceWallet.balance).toBe(100);

    // Fire 6 simultaneous transfers of 80 credits each via Promise.all
    const attempts = await Promise.all(
      Array.from({ length: 6 }, (_, idx) =>
        sender.post('/api/payments/transfer', {
          recipientCodeOrUsername: recipient.user.username,
          amountCredits: 80,
          note: `Concurrent race transfer #${idx + 1}`,
        }),
      ),
    );

    const successes = attempts.filter((r) => r.status === 200 || r.status === 201);
    const failures = attempts.filter((r) => r.status === 400);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(5);

    const postRaceSender = (await sender.get('/api/rewards/wallet').expect(200)).body.wallet;
    expect(postRaceSender.purchasedCredits).toBe(20);
    expect(postRaceSender.balance).toBe(20);
    expect(postRaceSender.balance).toBeGreaterThanOrEqual(0);

    const postRaceRecipient = (await recipient.get('/api/rewards/wallet').expect(200)).body.wallet;
    expect(postRaceRecipient.earnedCredits).toBe(80);
    expect(postRaceRecipient.balance).toBe(250 + 80);

    expect((await sender.get('/api/rewards/wallet/verify-integrity').expect(200)).body.valid).toBe(true);
    expect((await recipient.get('/api/rewards/wallet/verify-integrity').expect(200)).body.valid).toBe(true);
  });

  it('4. Sybil Promo-Laundering Block: rejects P2P transfer of starter promoCredits with 400 PROMO_NOT_TRANSFERABLE', async () => {
    const sybilAccount = await registerUser({ username: 'sybil_bot_1' });
    const muleAccount = await registerUser({ username: 'sybil_mule' });

    const sybilWalletBefore = (await sybilAccount.get('/api/rewards/wallet').expect(200)).body.wallet;
    expect(sybilWalletBefore.promoCredits).toBe(250);
    expect(sybilWalletBefore.purchasedCredits).toBe(0);
    expect(sybilWalletBefore.earnedCredits).toBe(0);

    const transferAttempt = await sybilAccount
      .post('/api/payments/transfer', {
        recipientCodeOrUsername: muleAccount.user.username,
        amountCredits: 100,
        note: 'Attempt to launder starter promo credits',
      })
      .expect(400);

    expect(transferAttempt.body.error.code).toBe('PROMO_NOT_TRANSFERABLE');

    // Verify zero credits moved
    const sybilWalletAfter = (await sybilAccount.get('/api/rewards/wallet').expect(200)).body.wallet;
    const muleWalletAfter = (await muleAccount.get('/api/rewards/wallet').expect(200)).body.wallet;
    expect(sybilWalletAfter.balance).toBe(250);
    expect(sybilWalletAfter.promoCredits).toBe(250);
    expect(muleWalletAfter.earnedCredits).toBe(0);
    expect(muleWalletAfter.balance).toBe(250);
  });

  it('5. Direct SQL Ledger Tampering Defense: PostgreSQL trigger blocks CreditTransaction mutation/deletion & verify-integrity catches CreditWallet balance tampering', async () => {
    const victim = await registerUser({ username: 'ledger_guard_user' });
    const walletData = (await victim.get('/api/rewards/wallet').expect(200)).body;
    const txId = walletData.transactions[0].id as string;

    // 5a: Direct SQL UPDATE of CreditTransaction.amount MUST be blocked by PostgreSQL immutable trigger
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "CreditTransaction" SET "amount" = 999999 WHERE "id" = '${txId}'::uuid`,
      ),
    ).rejects.toThrow(/IMMUTABLE_LEDGER_VIOLATION/);

    // 5b: Direct SQL DELETE on CreditTransaction MUST be blocked by PostgreSQL immutable trigger
    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM "CreditTransaction" WHERE "id" = '${txId}'::uuid`),
    ).rejects.toThrow(/IMMUTABLE_LEDGER_VIOLATION/);

    // Integrity is still intact because trigger blocked both attacks
    const intactCheck = (await victim.get('/api/rewards/wallet/verify-integrity').expect(200)).body;
    expect(intactCheck.valid).toBe(true);

    // 5c: Direct SQL alteration of CreditWallet.balance is immediately caught by verify-integrity
    await prisma.$executeRawUnsafe(
      `UPDATE "CreditWallet" SET "balance" = 888888 WHERE "userId" = '${victim.user.id}'::uuid`,
    );

    const tamperedCheck = (await victim.get('/api/rewards/wallet/verify-integrity').expect(200)).body;
    expect(tamperedCheck.balanceMatchesLedger).toBe(false);
    expect(tamperedCheck.valid).toBe(false);
  });

  it('6. Magic-Bytes Spoofed Upload Defense & JPEG EXIF/GPS Stripping', async () => {
    const user = await registerUser({ username: 'avatar_sec_user' });

    // 6a: XSS HTML/JS payload disguised as image/png -> REJECTED (400)
    const xssSpoofRes = await user.agent
      .post('/api/users/me/avatar')
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', user.csrfToken)
      .attach('avatar', Buffer.from('<script>alert(1)</script>', 'utf8'), {
        filename: 'evil.png',
        contentType: 'image/png',
      })
      .expect(400);
    expect(xssSpoofRes.body.error.code).toBe('BAD_REQUEST');

    // 6b: PNG header polyglot with embedded <script> tag -> REJECTED (400)
    const polyglotPng = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('fake_chunk<script>fetch("https://evil.test")</script>', 'utf8'),
    ]);
    await user.agent
      .post('/api/users/me/avatar')
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', user.csrfToken)
      .attach('avatar', polyglotPng, {
        filename: 'polyglot.png',
        contentType: 'image/png',
      })
      .expect(400);

    // 6c: Valid 1x1 PNG passes magic-bytes inspection -> 200
    const validPngRes = await user.agent
      .post('/api/users/me/avatar')
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', user.csrfToken)
      .attach('avatar', VALID_1X1_PNG, {
        filename: 'clean_avatar.png',
        contentType: 'image/png',
      })
      .expect(200);
    expect(validPngRes.body.user.avatarUrl).toMatch(/^\/uploads\/.+\.png$/);

    // 6d: Valid JPEG with APP1 EXIF GPS metadata passes AND strips EXIF GPS bytes on disk
    const jpegWithGps = buildJpegWithExifGps();
    expect(jpegWithGps.includes(Buffer.from('FAKE_GPS_COORDINATES'))).toBe(true);

    const validJpegRes = await user.agent
      .post('/api/users/me/avatar')
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', user.csrfToken)
      .attach('avatar', jpegWithGps, {
        filename: 'clinical_photo.jpg',
        contentType: 'image/jpeg',
      })
      .expect(200);

    const savedFilename = path.basename(validJpegRes.body.user.avatarUrl);
    const savedDiskPath = path.resolve(env.UPLOAD_DIR, savedFilename);
    const sanitizedBytes = fs.readFileSync(savedDiskPath);
    expect(sanitizedBytes[0]).toBe(0xff);
    expect(sanitizedBytes[1]).toBe(0xd8);
    expect(sanitizedBytes.includes(Buffer.from('FAKE_GPS_COORDINATES'))).toBe(false);
  });

  it('7. Security Posture Endpoint & Bank Payout Escrow / Settlement Lifecycle', async () => {
    // 7a: Security posture endpoint
    await request(getApp()).get('/api/realtime/security-status').expect(401);

    const admin = await registerUser({ username: 'sec_admin' });
    await makeAdmin(admin.user.id);
    const doctor = await registerUser({ username: 'payout_doctor' });
    const sponsor = await registerUser({ username: 'payout_sponsor' });

    const postureRes = await doctor.get('/api/realtime/security-status').expect(200);
    expect(postureRes.body.status).toBe('hardened');
    expect(postureRes.body.protections).toMatchObject({
      ledgerHashChain: 'HMAC-SHA256',
      rowLevelLocking: 'POSTGRES_FOR_UPDATE',
      uploadInspection: 'MAGIC_BYTES_AND_EXIF_STRIP',
      sessionSecurity: 'SHA256_HTTPONLY_CSRF',
      realtimeTransport: 'SSE_PUSH',
      qeegIsolation: 'SEMAPHORE_CONCURRENCY_GUARD',
    });

    // 7b: Link personal VietQR bank profile & receive code
    const receiveBefore = (await doctor.get('/api/payments/receive-code').expect(200)).body;
    expect(receiveBefore.receiveCode.startsWith('NL-')).toBe(true);
    expect(receiveBefore.vietQrReceiveUrl).toBeNull();

    const bankRes = await doctor
      .patch('/api/payments/bank-profile', {
        bankBin: '970422',
        bankName: 'MB Bank',
        bankAccountNo: '0987654321',
        bankAccountName: 'BS NGUYEN VAN A',
      })
      .expect(200);
    expect(bankRes.body.vietQrReceiveUrl).toContain('https://img.vietqr.io/image/970422-0987654321');

    // Cannot withdraw promoCredits to bank -> 400 INSUFFICIENT_EARNED_CREDITS
    const failPromoPayout = await doctor
      .post('/api/payments/payout-requests', { amountCredits: 100 })
      .expect(400);
    expect(failPromoPayout.body.error.code).toBe('INSUFFICIENT_EARNED_CREDITS');

    // Sponsor tops up 200,000 VND (220 Credits) and transfers 150 Credits to Doctor via receiveCode -> Doctor gets 150 earnedCredits
    const topupOrd = (
      await sponsor.post('/api/payments/topup-orders', { packageId: 'pkg_200k' }).expect(201)
    ).body.order;
    await sponsor.post(`/api/payments/topup-orders/${topupOrd.orderCode}/simulate-paid`).expect(200);
    await sponsor
      .post('/api/payments/transfer', {
        recipientCodeOrUsername: receiveBefore.receiveCode,
        amountCredits: 150,
        note: 'Phí tư vấn ca qEEG',
      })
      .expect(200);

    // Doctor requests payout of 100 earnedCredits -> locks 100 in escrow (earnedCredits: 50, lockedCredits: 100)
    const payoutRes = await doctor
      .post('/api/payments/payout-requests', {
        amountCredits: 100,
        note: 'Rút thù lao tư vấn đợt 1',
      })
      .expect(201);
    const payoutId = payoutRes.body.payout.id;
    expect(payoutRes.body.payout.amountVnd).toBe(100000);
    expect(payoutRes.body.wallet.earnedCredits).toBe(50);
    expect(payoutRes.body.wallet.lockedCredits).toBe(100);

    // Admin settles payout -> PAID, lockedCredits becomes 0, integrity remains 100% valid
    const reviewRes = await admin
      .post(`/api/payments/payout-requests/${payoutId}/review`, {
        decision: 'PAID',
        bankRef: 'FT26322999888',
        adminNote: 'Đã chuyển khoản VietQR 24/7',
      })
      .expect(200);
    expect(reviewRes.body.payout.status).toBe('PAID');
    expect(reviewRes.body.wallet.lockedCredits).toBe(0);

    const docIntegrity = (await doctor.get('/api/rewards/wallet/verify-integrity').expect(200)).body;
    expect(docIntegrity.valid).toBe(true);
    expect(docIntegrity.balanceMatchesLedger).toBe(true);
  });
});
