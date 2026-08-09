/**
 * Escrow / Settlement / Refund / Return HTTP API — Sprint 8 / IS-010 Sprint 11.
 * Paths under /api/v1/commerce/escrow/* and order-scoped returns/refunds.
 */

import { Router } from 'express';
import { CommerceError } from '../commerce/cartService';
import { authenticateRequest } from '../middleware/auth';
import { Logger } from '../lib/logger';
import { getEscrowPersistenceMode, escrowStore } from './escrowStore';
import {
  applyAdministrativeAdjustment,
  decideReturn,
  getEscrowForActor,
  getSellerBalanceForActor,
  harnessMarkCapturedWithoutEscrow,
  harnessSettleWithoutBalanceCredit,
  harnessSimulateProviderRefundWithoutLocalReverse,
  placeDisputeHold,
  processEscrowRefund,
  reconcileEscrowEffectsForPayment,
  reconcileRefundLocalEffects,
  reconcileSettlementBalanceCredit,
  requestReturn,
  settleEscrowForOrder,
} from './escrowService';
import { commercePaymentStore } from '../payments/commercePaymentStore';

export const escrowRouter = Router();

const requireAuth = [authenticateRequest];

function actorOf(req: {
  userId?: string;
  user?: { uid?: string; role?: string };
  userRole?: string;
}): { userId: string; role?: string } {
  return {
    userId: req.userId || req.user?.uid || '',
    role: req.userRole || req.user?.role,
  };
}

function handleError(res: import('express').Response, error: unknown): void {
  if (error instanceof CommerceError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return;
  }
  Logger.error('Escrow API error', {
    error: error instanceof Error ? error.message : String(error),
  });
  res.status(500).json({
    success: false,
    error: error instanceof Error ? error.message : 'Escrow error',
  });
}

escrowRouter.get('/commerce/escrow/persistence-mode', (_req, res) => {
  res.json({ success: true, data: { mode: getEscrowPersistenceMode() } });
});

escrowRouter.get('/commerce/escrow/:escrowId', ...requireAuth, async (req, res) => {
  try {
    const escrow = await getEscrowForActor(req.params.escrowId, actorOf(req));
    res.json({ success: true, data: escrow });
  } catch (error) {
    handleError(res, error);
  }
});

escrowRouter.get('/commerce/orders/:orderId/escrows', ...requireAuth, async (req, res) => {
  try {
    const actor = actorOf(req);
    const rows = await escrowStore.listEscrowsByOrder(req.params.orderId);
    const visible = [];
    for (const e of rows) {
      try {
        visible.push(await getEscrowForActor(e.escrowId, actor));
      } catch {
        /* skip unauthorized */
      }
    }
    if (!rows.length) {
      res.json({ success: true, data: [] });
      return;
    }
    if (!visible.length) {
      res.status(403).json({ success: false, error: 'Not authorized' });
      return;
    }
    res.json({ success: true, data: visible });
  } catch (error) {
    handleError(res, error);
  }
});

escrowRouter.get(
  '/commerce/sellers/:sellerId/balance',
  ...requireAuth,
  async (req, res) => {
    try {
      const currency = String(req.query.currency || 'BDT');
      const bal = await getSellerBalanceForActor(
        req.params.sellerId,
        currency,
        actorOf(req),
      );
      res.json({ success: true, data: bal });
    } catch (error) {
      handleError(res, error);
    }
  },
);

escrowRouter.get(
  '/commerce/settlements/:settlementId',
  ...requireAuth,
  async (req, res) => {
    try {
      const settlement = await escrowStore.getSettlement(req.params.settlementId);
      if (!settlement) {
        res.status(404).json({ success: false, error: 'Settlement not found' });
        return;
      }
      const escrow = await getEscrowForActor(settlement.escrowId, actorOf(req));
      res.json({ success: true, data: { settlement, escrowId: escrow.escrowId } });
    } catch (error) {
      handleError(res, error);
    }
  },
);

escrowRouter.post('/commerce/escrow/:escrowId/refund', ...requireAuth, async (req, res) => {
  try {
    const amount =
      req.body?.amount === undefined || req.body?.amount === null
        ? undefined
        : Number(req.body.amount);
    const refund = await processEscrowRefund({
      escrowId: req.params.escrowId,
      amount,
      reason: String(req.body?.reason || ''),
      actor: actorOf(req),
      skipProvider: req.body?.skipProvider === true,
    });
    res.json({ success: true, data: refund });
  } catch (error) {
    handleError(res, error);
  }
});

escrowRouter.get('/commerce/refunds/:refundId', ...requireAuth, async (req, res) => {
  try {
    const refund = await escrowStore.getRefund(req.params.refundId);
    if (!refund) {
      res.status(404).json({ success: false, error: 'Refund not found' });
      return;
    }
    await getEscrowForActor(refund.escrowId, actorOf(req));
    res.json({ success: true, data: refund });
  } catch (error) {
    handleError(res, error);
  }
});

escrowRouter.post('/orders/:id/returns', ...requireAuth, async (req, res) => {
  try {
    const row = await requestReturn({
      orderId: req.params.id,
      reason: String(req.body?.reason || ''),
      actor: actorOf(req),
    });
    res.json({ success: true, data: row });
  } catch (error) {
    handleError(res, error);
  }
});

escrowRouter.patch('/orders/:id/returns/:returnId', ...requireAuth, async (req, res) => {
  try {
    const decision = String(req.body?.decision || '').trim() as 'approved' | 'rejected';
    if (decision !== 'approved' && decision !== 'rejected') {
      res.status(400).json({ success: false, error: 'decision must be approved|rejected' });
      return;
    }
    const result = await decideReturn({
      returnId: req.params.returnId,
      decision,
      actor: actorOf(req),
      refundAmount:
        req.body?.refundAmount === undefined ? undefined : Number(req.body.refundAmount),
    });
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

escrowRouter.post('/commerce/escrow/:escrowId/dispute-hold', ...requireAuth, async (req, res) => {
  try {
    const escrow = await placeDisputeHold({
      escrowId: req.params.escrowId,
      reason: String(req.body?.reason || ''),
      actor: actorOf(req),
    });
    res.json({ success: true, data: escrow });
  } catch (error) {
    handleError(res, error);
  }
});

escrowRouter.post(
  '/commerce/escrow/:escrowId/admin-adjustment',
  ...requireAuth,
  async (req, res) => {
    try {
      const escrow = await applyAdministrativeAdjustment({
        escrowId: req.params.escrowId,
        note: String(req.body?.note || ''),
        heldAmount:
          req.body?.heldAmount === undefined ? undefined : Number(req.body.heldAmount),
        actor: actorOf(req),
      });
      res.json({ success: true, data: escrow });
    } catch (error) {
      handleError(res, error);
    }
  },
);

/** Seller cannot self-release protected Escrow — Admin settlement trigger for recovery only. */
escrowRouter.post(
  '/commerce/orders/:orderId/settle-escrow',
  ...requireAuth,
  async (req, res) => {
    try {
      const actor = actorOf(req);
      const role = (actor.role || '').toLowerCase();
      if (role !== 'admin' && role !== 'super_admin' && role !== 'superadmin') {
        res.status(403).json({
          success: false,
          error: 'Only Admin may force settlement reconcile; Sellers cannot self-release Escrow',
        });
        return;
      }
      const result = await settleEscrowForOrder(req.params.orderId, actor.userId);
      res.json({ success: true, data: result });
    } catch (error) {
      handleError(res, error);
    }
  },
);

escrowRouter.post('/commerce/escrow/reconcile/payment/:paymentId', ...requireAuth, async (req, res) => {
  try {
    const actor = actorOf(req);
    const role = (actor.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'super_admin' && role !== 'superadmin') {
      res.status(403).json({ success: false, error: 'Admin only' });
      return;
    }
    const payment = await commercePaymentStore.getPayment(req.params.paymentId);
    if (!payment) {
      res.status(404).json({ success: false, error: 'Payment not found' });
      return;
    }
    const result = await reconcileEscrowEffectsForPayment(payment, actor.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

escrowRouter.post(
  '/commerce/escrow/reconcile/settlement/:settlementId',
  ...requireAuth,
  async (req, res) => {
    try {
      const actor = actorOf(req);
      const role = (actor.role || '').toLowerCase();
      if (role !== 'admin' && role !== 'super_admin' && role !== 'superadmin') {
        res.status(403).json({ success: false, error: 'Admin only' });
        return;
      }
      const result = await reconcileSettlementBalanceCredit(
        req.params.settlementId,
        actor.userId,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      handleError(res, error);
    }
  },
);

escrowRouter.post(
  '/commerce/escrow/reconcile/refund/:refundId',
  ...requireAuth,
  async (req, res) => {
    try {
      const actor = actorOf(req);
      const role = (actor.role || '').toLowerCase();
      if (role !== 'admin' && role !== 'super_admin' && role !== 'superadmin') {
        res.status(403).json({ success: false, error: 'Admin only' });
        return;
      }
      const result = await reconcileRefundLocalEffects(req.params.refundId, actor.userId);
      res.json({ success: true, data: result });
    } catch (error) {
      handleError(res, error);
    }
  },
);

/** Harness: Captured without Escrow (crash A). */
escrowRouter.post(
  '/commerce/escrow/harness/mark-captured-without-escrow',
  ...requireAuth,
  async (req, res) => {
    try {
      const payment = await harnessMarkCapturedWithoutEscrow({
        paymentId: String(req.body?.paymentId || ''),
      });
      res.json({ success: true, data: payment });
    } catch (error) {
      handleError(res, error);
    }
  },
);

escrowRouter.post(
  '/commerce/escrow/harness/settle-without-balance',
  ...requireAuth,
  async (req, res) => {
    try {
      const result = await harnessSettleWithoutBalanceCredit({
        escrowId: String(req.body?.escrowId || ''),
        actor: actorOf(req).userId,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      handleError(res, error);
    }
  },
);

escrowRouter.post(
  '/commerce/escrow/harness/provider-refund-without-local',
  ...requireAuth,
  async (req, res) => {
    try {
      const actor = actorOf(req);
      const refund = await harnessSimulateProviderRefundWithoutLocalReverse({
        escrowId: String(req.body?.escrowId || ''),
        amount: Number(req.body?.amount),
        reason: String(req.body?.reason || 'harness'),
        actorUserId: actor.userId,
      });
      res.json({ success: true, data: refund });
    } catch (error) {
      handleError(res, error);
    }
  },
);

escrowRouter.post('/commerce/escrow/_flush', ...requireAuth, async (_req, res) => {
  try {
    escrowStore.flushMemory();
    res.json({ success: true });
  } catch (error) {
    handleError(res, error);
  }
});
