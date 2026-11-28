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

  it('8. Server-Driven TTL, Single Active PENDING Order & Validation Hardening', async () => {
    const buyer = await registerUser({ username: 'ttl_buyer' });

    // Packages metadata includes TTL, reminder window, sandbox flag, and serverNow
    const pkgRes = await buyer.get('/api/payments/packages').expect(200);
    expect(pkgRes.body.orderTtlSeconds).toBe(600);
    expect(pkgRes.body.reminderWindowSeconds).toBe(60);
    expect(pkgRes.body.sandboxEnabled).toBe(true);
    expect(Number.isNaN(Date.parse(pkgRes.body.serverNow))).toBe(false);

    // Reject sending both packageId and amountVnd simultaneously
    await buyer
      .post('/api/payments/topup-orders', { packageId: 'pkg_50k', amountVnd: 50000 })
      .expect(400);

    // Reject amountVnd not divisible by 1000 (VND_PER_CREDIT)
    await buyer.post('/api/payments/topup-orders', { amountVnd: 50500 }).expect(400);

    // Create order #1
    const res1 = await buyer.post('/api/payments/topup-orders', { packageId: 'pkg_50k' }).expect(201);
    const order1 = res1.body.order;
    expect(res1.body.orderTtlSeconds).toBe(600);
    expect(res1.body.reminderWindowSeconds).toBe(60);
    expect(Number.isNaN(Date.parse(res1.body.serverNow))).toBe(false);

    // Verify TTL is ~600s (within reasonable clock skew)
    const ttlDeltaMs = new Date(order1.expiresAt).getTime() - new Date(res1.body.serverNow).getTime();
    expect(ttlDeltaMs).toBeGreaterThanOrEqual(595_000);
    expect(ttlDeltaMs).toBeLessThanOrEqual(605_000);

    // Create order #2 -> automatically cancels order #1 so only 1 PENDING QR exists
    const res2 = await buyer.post('/api/payments/topup-orders', { packageId: 'pkg_100k' }).expect(201);
    const order2 = res2.body.order;
    expect(order2.status).toBe('PENDING');
    expect(order2.orderCode).not.toBe(order1.orderCode);

    const listRes = await buyer.get('/api/payments/topup-orders').expect(200);
    expect(Number.isNaN(Date.parse(listRes.body.serverNow))).toBe(false);
    const dbOrder1 = listRes.body.orders.find((o: any) => o.orderCode === order1.orderCode);
    const dbOrder2 = listRes.body.orders.find((o: any) => o.orderCode === order2.orderCode);
    expect(dbOrder1.status).toBe('CANCELLED');
    expect(dbOrder2.status).toBe('PENDING');
  });

  it('9. Expired Order Security Gate: blocks webhook & simulate-paid (409 PAYMENT_ORDER_EXPIRED), auto-expires DB, zero credit granted', async () => {
    const buyer = await registerUser({ username: 'expired_buyer' });
    const otherUser = await registerUser({ username: 'expired_snooper' });

    const ord1 = (await buyer.post('/api/payments/topup-orders', { amountVnd: 50000 }).expect(201)).body.order;

    // Backdate expiresAt in DB to simulate TTL expiration
    await prisma.paymentOrder.update({
      where: { id: ord1.id },
      data: { expiresAt: new Date(Date.now() - 5_000) },
    });

    // 9a. Bank webhook for expired order -> 409 PAYMENT_ORDER_EXPIRED, DB status becomes EXPIRED, wallet unchanged
    const webhookBody = {
      gateway: 'MBBank-VietQR',
      transactionId: `FT-EXPIRED-${Date.now()}`,
      transferAmount: 50000,
      content: `Nap tien ${ord1.orderCode}`,
    };
    const whRes = await request(getApp())
      .post('/api/payments/webhook/bank-transfer')
      .set('x-payment-signature', signWebhookPayload(webhookBody))
      .send(webhookBody)
      .expect(409);
    expect(whRes.body.error.code).toBe('PAYMENT_ORDER_EXPIRED');

    const dbOrd1AfterWh = await prisma.paymentOrder.findUniqueOrThrow({ where: { id: ord1.id } });
    expect(dbOrd1AfterWh.status).toBe('EXPIRED');

    const walletAfterWh = (await buyer.get('/api/rewards/wallet').expect(200)).body.wallet;
    expect(walletAfterWh.purchasedCredits).toBe(0);
    expect(walletAfterWh.balance).toBe(250);

    // 9b. Create another order and backdate expiresAt -> simulate-paid MUST reject with 409 PAYMENT_ORDER_EXPIRED & mark EXPIRED
    const ord2 = (await buyer.post('/api/payments/topup-orders', { amountVnd: 80000 }).expect(201)).body.order;
    await prisma.paymentOrder.update({
      where: { id: ord2.id },
      data: { expiresAt: new Date(Date.now() - 5_000) },
    });

    const simRes = await buyer
      .post(`/api/payments/topup-orders/${ord2.orderCode}/simulate-paid`)
      .expect(409);
    expect(simRes.body.error.code).toBe('PAYMENT_ORDER_EXPIRED');

    const dbOrd2AfterSim = await prisma.paymentOrder.findUniqueOrThrow({ where: { id: ord2.id } });
    expect(dbOrd2AfterSim.status).toBe('EXPIRED');

    const walletAfterSim = (await buyer.get('/api/rewards/wallet').expect(200)).body.wallet;
    expect(walletAfterSim.purchasedCredits).toBe(0);
    expect(walletAfterSim.balance).toBe(250);

    // 9c. GET /api/payments/topup-orders/:orderCode auto-expires overdue PENDING order & returns serverNow; blocks non-owner
    const ord3 = (await buyer.post('/api/payments/topup-orders', { amountVnd: 60000 }).expect(201)).body.order;
    await prisma.paymentOrder.update({
      where: { id: ord3.id },
      data: { expiresAt: new Date(Date.now() - 5_000) },
    });

    await otherUser.get(`/api/payments/topup-orders/${ord3.orderCode}`).expect(403);

    const getOrd3 = await buyer.get(`/api/payments/topup-orders/${ord3.orderCode}`).expect(200);
    expect(getOrd3.body.order.status).toBe('EXPIRED');
    expect(getOrd3.body.reminderWindowSeconds).toBe(60);
    expect(Number.isNaN(Date.parse(getOrd3.body.serverNow))).toBe(false);
  });

  it('10. Cancel Topup Order Endpoint & Payout Idempotency Key Defense', async () => {
    const buyer = await registerUser({ username: 'cancel_buyer' });
    const snooper = await registerUser({ username: 'cancel_snooper' });

    const ord = (await buyer.post('/api/payments/topup-orders', { packageId: 'pkg_50k' }).expect(201)).body.order;

    // Non-owner cannot cancel
    await snooper.post(`/api/payments/topup-orders/${ord.orderCode}/cancel`).expect(403);

    // Owner cancels PENDING -> CANCELLED
    const cancelRes = await buyer.post(`/api/payments/topup-orders/${ord.orderCode}/cancel`).expect(200);
    expect(cancelRes.body.order.status).toBe('CANCELLED');
    expect(Number.isNaN(Date.parse(cancelRes.body.serverNow))).toBe(false);

    // Idempotent repeat cancel -> stays CANCELLED (200)
    const repeatCancelRes = await buyer
      .post(`/api/payments/topup-orders/${ord.orderCode}/cancel`)
      .expect(200);
    expect(repeatCancelRes.body.order.status).toBe('CANCELLED');

    // Cancelled order cannot be paid via simulate-paid or webhook -> 409 PAYMENT_ORDER_CANCELLED
    const simCancelled = await buyer
      .post(`/api/payments/topup-orders/${ord.orderCode}/simulate-paid`)
      .expect(409);
    expect(simCancelled.body.error.code).toBe('PAYMENT_ORDER_CANCELLED');

    // Paid order cannot be cancelled -> 409 PAYMENT_ORDER_ALREADY_PAID
    const paidOrd = (await buyer.post('/api/payments/topup-orders', { packageId: 'pkg_100k' }).expect(201)).body
      .order;
    await buyer.post(`/api/payments/topup-orders/${paidOrd.orderCode}/simulate-paid`).expect(200);

    const cancelPaidRes = await buyer
      .post(`/api/payments/topup-orders/${paidOrd.orderCode}/cancel`)
      .expect(409);
    expect(cancelPaidRes.body.error.code).toBe('PAYMENT_ORDER_ALREADY_PAID');

    // Payout double-click idempotencyKey test
    const earner = await registerUser({ username: 'payout_idem_earner' });
    await earner
      .patch('/api/payments/bank-profile', {
        bankBin: '970422',
        bankName: 'MB Bank',
        bankAccountNo: '0123456789',
        bankAccountName: 'NGUYEN VAN TEST',
      })
      .expect(200);

    // Transfer 100 transferable credits to earner (buyer has 105 purchasedCredits from pkg_100k)
    await buyer
      .post('/api/payments/transfer', {
        recipientCodeOrUsername: earner.user.username,
        amountCredits: 100,
      })
      .expect(200);

    const idemKey = `payout-click-${Date.now()}`;
    const p1 = await earner
      .post('/api/payments/payout-requests', {
        amountCredits: 60,
        note: 'Double click test',
        idempotencyKey: idemKey,
      })
      .expect(201);
    const p2 = await earner
      .post('/api/payments/payout-requests', {
        amountCredits: 60,
        note: 'Double click test',
        idempotencyKey: idemKey,
      })
      .expect(201);

    expect(p1.body.idempotentReplay).toBe(false);
    expect(p2.body.idempotentReplay).toBe(true);
    expect(p2.body.payout.id).toBe(p1.body.payout.id);
    expect(p2.body.wallet.earnedCredits).toBe(40);
    expect(p2.body.wallet.lockedCredits).toBe(60);

    const payoutsList = (await earner.get('/api/payments/payout-requests').expect(200)).body.payouts;
    expect(payoutsList).toHaveLength(1);
  });
});
