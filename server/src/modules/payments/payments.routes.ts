import { Router, type Request } from 'express';
import { z } from 'zod';
import { getAuth, requireAdmin, requireAuth } from '../../middleware/auth.js';
import { financialLimiter } from '../../middleware/rateLimit.js';
import {
  bankProfileSchema,
  createPayoutRequestSchema,
  createTopupOrderSchema,
  orderCodeParamSchema,
  reviewPayoutRequestSchema,
  transferCreditsSchema,
} from './payments.schemas.js';
import * as paymentsService from './payments.service.js';

/**
 * Public bank-transfer webhook router — MUST be mounted BEFORE `csrfProtection` in `app.ts`
 * because external payment gateways authenticate via `x-payment-signature` (HMAC-SHA256)
 * rather than browser session cookies + CSRF headers.
 */
export const paymentsWebhookRouter = Router();

paymentsWebhookRouter.post('/bank-transfer', async (req: Request, res) => {
  const signature = req.header('x-payment-signature') ?? undefined;
  const rawBody = (req as Request & { rawBody?: string }).rawBody;
  const body =
    req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : {};
  const result = await paymentsService.processBankTransferWebhook(body, signature, rawBody);
  res.json(result);
});

/**
 * Authenticated user & admin payments router (`/api/payments/*`).
 */
export const paymentsRouter = Router();

paymentsRouter.use(requireAuth);

paymentsRouter.get('/packages', (req, res) => {
  const auth = getAuth(req);
  res.json(paymentsService.getTopupPackagesInfo(auth.role));
});

paymentsRouter.post('/topup-orders', financialLimiter, async (req, res) => {
  const auth = getAuth(req);
  const input = createTopupOrderSchema.parse(req.body);
  const result = await paymentsService.createTopupOrder(auth.userId, input);
  res.status(201).json(result);
});

paymentsRouter.get('/topup-orders', async (req, res) => {
  const auth = getAuth(req);
  const result = await paymentsService.listUserTopupOrders(auth.userId);
  res.json(result);
});

paymentsRouter.get('/topup-orders/:orderCode', async (req, res) => {
  const auth = getAuth(req);
  const orderCode = orderCodeParamSchema.parse(req.params.orderCode);
  const result = await paymentsService.getUserTopupOrderByCode(auth.userId, auth.role, orderCode);
  res.json(result);
});

paymentsRouter.post('/topup-orders/:orderCode/cancel', financialLimiter, async (req, res) => {
  const auth = getAuth(req);
  const orderCode = orderCodeParamSchema.parse(req.params.orderCode);
  const result = await paymentsService.cancelTopupOrder(auth.userId, auth.role, orderCode);
  res.json(result);
});

paymentsRouter.post('/topup-orders/:orderCode/simulate-paid', financialLimiter, async (req, res) => {
  const auth = getAuth(req);
  const orderCode = orderCodeParamSchema.parse(req.params.orderCode);
  const result = await paymentsService.simulateOrderPaid(auth.userId, auth.role, orderCode);
  res.json(result);
});

paymentsRouter.get('/receive-code', async (req, res) => {
  const auth = getAuth(req);
  const result = await paymentsService.getUserReceiveInfo(auth.userId);
  res.json(result);
});

paymentsRouter.patch('/bank-profile', financialLimiter, async (req, res) => {
  const auth = getAuth(req);
  const input = bankProfileSchema.parse(req.body);
  const result = await paymentsService.updateUserBankProfile(auth.userId, input);
  res.json(result);
});

paymentsRouter.post('/transfer', financialLimiter, async (req, res) => {
  const auth = getAuth(req);
  const input = transferCreditsSchema.parse(req.body);
  const result = await paymentsService.transferCreditsP2P(auth.userId, input);
  res.json(result);
});

paymentsRouter.post('/payout-requests', financialLimiter, async (req, res) => {
  const auth = getAuth(req);
  const input = createPayoutRequestSchema.parse(req.body);
  const result = await paymentsService.createPayoutRequest(auth.userId, input);
  res.status(201).json(result);
});

paymentsRouter.get('/payout-requests', async (req, res) => {
  const auth = getAuth(req);
  const scope = typeof req.query.scope === 'string' ? req.query.scope : undefined;
  const result = await paymentsService.listPayoutRequests(auth.userId, auth.role, scope);
  res.json(result);
});

paymentsRouter.post('/payout-requests/:id/review', requireAdmin, financialLimiter, async (req, res) => {
  const auth = getAuth(req);
  const payoutId = z.string().uuid('ID yêu cầu rút tiền không hợp lệ').parse(req.params.id);
  const input = reviewPayoutRequestSchema.parse(req.body);
  const result = await paymentsService.reviewPayoutRequest(auth.userId, payoutId, input);
  res.json(result);
});
