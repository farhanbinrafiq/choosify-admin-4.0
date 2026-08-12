/**
 * Idempotent Platform Reference ID backfill across memory + SQL domains.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { backfillChoosifyUserIds } from '../auth/choosifyUserId';
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { commerceStore } from '../commerce/commerceStore';
import { commercePaymentStore } from '../payments/commercePaymentStore';
import { paymentsMemoryBackend, ensurePaymentsMemoryHydrated } from '../payments/commercePaymentMemoryBackend';
import { escrowStore } from '../escrow/escrowStore';
import { ensureEscrowMemoryHydrated } from '../escrow/escrowMemoryBackend';
import { adsStore } from '../ads/adsStore';
import {
  listConversations,
  getConversation,
  saveConversation,
} from '../messaging/conversations/conversationStore';
import {
  ensureCashbookHydrated,
  type CashbookBook,
} from '../cashbook/cashbookStore';
import {
  backfillEntityList,
  ensureReferenceIdSchema,
  type DomainBackfillResult,
} from './referenceIdService';

function cashbookSnapshotPath(): string {
  return (
    process.env.CASHBOOK_MEMORY_SNAPSHOT_PATH?.trim() ||
    join(process.cwd(), '.data', 'cashbook-memory-snapshot.json')
  );
}

async function patchCashbookRef(bookId: string, refId: string): Promise<void> {
  ensureCashbookHydrated();
  const path = cashbookSnapshotPath();
  if (!existsSync(path)) return;
  try {
    const snap = JSON.parse(readFileSync(path, 'utf8')) as {
      version: 1;
      books: CashbookBook[];
      entries: unknown[];
      savedAt?: string;
    };
    const book = (snap.books || []).find((b) => b.id === bookId);
    if (book && !book.cashbookReferenceId) {
      book.cashbookReferenceId = refId;
      snap.savedAt = new Date().toISOString();
      writeFileSync(path, JSON.stringify(snap), 'utf8');
    }
  } catch {
    /* ignore */
  }
}

export type ReferenceBackfillReport = {
  domains: DomainBackfillResult[];
  userBackfill: Awaited<ReturnType<typeof backfillChoosifyUserIds>>;
};

export async function backfillAllReferenceIds(): Promise<ReferenceBackfillReport> {
  await ensureReferenceIdSchema();
  const domains: DomainBackfillResult[] = [];

  const userBackfill = await backfillChoosifyUserIds();
  domains.push({
    entityType: 'user',
    total: userBackfill.totalUsers,
    alreadyHadId: userBackfill.alreadyHadId,
    assigned: userBackfill.assigned,
    duplicates: userBackfill.duplicatesDetected,
  });

  const brands = await catalogStore.listBrands();
  domains.push(
    await backfillEntityList({
      entityType: 'brand',
      rows: brands.map((b) => ({
        internalId: b.id,
        createdAt: b.createdAt,
        current: b.brandReferenceId,
      })),
      apply: async (id, ref) => {
        const b = await catalogStore.getBrand(id);
        if (b && !b.brandReferenceId) {
          await catalogStore.upsertBrand({ ...b, brandReferenceId: ref });
        }
      },
    }),
  );

  const products = await catalogStore.listProducts();
  domains.push(
    await backfillEntityList({
      entityType: 'product',
      rows: products.map((p) => ({
        internalId: p.id,
        createdAt: (p as { createdAt?: string }).createdAt,
        current: p.productReferenceId,
      })),
      apply: async (id, ref) => {
        const p = await catalogStore.getProduct(id);
        if (p && !p.productReferenceId) {
          await catalogStore.upsertProduct({ ...p, productReferenceId: ref });
        }
      },
    }),
  );

  const guides = await catalogStore.listGuides();
  domains.push(
    await backfillEntityList({
      entityType: 'content',
      rows: guides.map((g) => ({
        internalId: g.id,
        createdAt: g.publishedAt || g.updatedAt,
        current: g.contentReferenceId,
      })),
      apply: async (id, ref) => {
        const g = await catalogStore.getGuide(id);
        if (g && !g.contentReferenceId) {
          await catalogStore.upsertGuide({ ...g, contentReferenceId: ref });
        }
      },
    }),
  );

  const orders = await commerceStore.listOrders();
  domains.push(
    await backfillEntityList({
      entityType: 'order',
      rows: orders.map((o) => ({
        internalId: o.id,
        createdAt: o.createdAt,
        current: o.orderReferenceId,
      })),
      apply: async (id, ref) => {
        const o = await commerceStore.getOrder(id);
        if (o && !o.orderReferenceId) {
          await commerceStore.upsertOrder({ ...o, orderReferenceId: ref });
        }
      },
    }),
  );
  domains.push(
    await backfillEntityList({
      entityType: 'invoice',
      rows: orders.map((o) => ({
        internalId: o.id,
        createdAt: o.createdAt,
        current: o.invoiceReferenceId,
      })),
      apply: async (id, ref) => {
        const o = await commerceStore.getOrder(id);
        if (o && !o.invoiceReferenceId) {
          await commerceStore.upsertOrder({ ...o, invoiceReferenceId: ref });
        }
      },
    }),
  );

  ensurePaymentsMemoryHydrated();
  const payments = paymentsMemoryBackend.listPayments();
  domains.push(
    await backfillEntityList({
      entityType: 'payment',
      rows: payments.map((p) => ({
        internalId: p.paymentId,
        createdAt: p.createdAt,
        current: p.paymentReferenceId,
      })),
      apply: async (id, ref) => {
        const p = await commercePaymentStore.getPayment(id);
        if (p && !p.paymentReferenceId) {
          await commercePaymentStore.upsertPayment({ ...p, paymentReferenceId: ref });
        }
      },
    }),
  );

  ensureEscrowMemoryHydrated();
  let escrowRows: Array<{ escrowId: string; createdAt: string; escrowReferenceId?: string }> = [];
  let refundRows: Array<{ refundId: string; createdAt: string; refundReferenceId?: string }> = [];
  let returnRows: Array<{ returnId: string; createdAt: string; returnReferenceId?: string }> = [];
  try {
    const path = join(process.cwd(), '.data', 'escrow-memory-snapshot.json');
    if (existsSync(path)) {
      const snap = JSON.parse(readFileSync(path, 'utf8')) as {
        escrows?: typeof escrowRows;
        refunds?: typeof refundRows;
        returns?: typeof returnRows;
      };
      if (snap.escrows?.length) escrowRows = snap.escrows;
      if (snap.refunds?.length) refundRows = snap.refunds;
      if (snap.returns?.length) returnRows = snap.returns;
    }
  } catch {
    /* ignore */
  }

  domains.push(
    await backfillEntityList({
      entityType: 'escrow',
      rows: escrowRows.map((e) => ({
        internalId: e.escrowId,
        createdAt: e.createdAt,
        current: e.escrowReferenceId,
      })),
      apply: async (id, ref) => {
        const e = await escrowStore.getEscrow(id);
        if (e && !e.escrowReferenceId) {
          await escrowStore.upsertEscrow({ ...e, escrowReferenceId: ref });
        }
      },
    }),
  );
  domains.push(
    await backfillEntityList({
      entityType: 'refund',
      rows: refundRows.map((e) => ({
        internalId: e.refundId,
        createdAt: e.createdAt,
        current: e.refundReferenceId,
      })),
      apply: async (id, ref) => {
        const e = await escrowStore.getRefund(id);
        if (e && !e.refundReferenceId) {
          await escrowStore.upsertRefund({ ...e, refundReferenceId: ref });
        }
      },
    }),
  );
  domains.push(
    await backfillEntityList({
      entityType: 'return',
      rows: returnRows.map((e) => ({
        internalId: e.returnId,
        createdAt: e.createdAt,
        current: e.returnReferenceId,
      })),
      apply: async (id, ref) => {
        const e = await escrowStore.getReturn(id);
        if (e && !e.returnReferenceId) {
          await escrowStore.upsertReturn({ ...e, returnReferenceId: ref });
        }
      },
    }),
  );

  const ads = await adsStore.listAds();
  domains.push(
    await backfillEntityList({
      entityType: 'deal',
      rows: ads
        .filter((a) => a.kind === 'deal')
        .map((a) => ({
          internalId: a.id,
          createdAt: a.createdAt,
          current: a.dealReferenceId,
        })),
      apply: async (id, ref) => {
        const a = await adsStore.getAd(id);
        if (a && !a.dealReferenceId) {
          await adsStore.upsertAd({ ...a, dealReferenceId: ref });
        }
      },
    }),
  );
  domains.push(
    await backfillEntityList({
      entityType: 'advertisement',
      rows: ads
        .filter((a) => a.kind !== 'deal')
        .map((a) => ({
          internalId: a.id,
          createdAt: a.createdAt,
          current: a.advertisementReferenceId,
        })),
      apply: async (id, ref) => {
        const a = await adsStore.getAd(id);
        if (a && !a.advertisementReferenceId) {
          await adsStore.upsertAd({ ...a, advertisementReferenceId: ref });
        }
      },
    }),
  );

  const convos = await listConversations();
  domains.push(
    await backfillEntityList({
      entityType: 'conversation',
      rows: convos.map((c) => ({
        internalId: c.id,
        createdAt: c.createdAt,
        current: c.conversationReferenceId,
      })),
      apply: async (id, ref) => {
        const c = await getConversation(id);
        if (c && !c.conversationReferenceId) {
          await saveConversation({ ...c, conversationReferenceId: ref });
        }
      },
    }),
  );

  ensureCashbookHydrated();
  let books: CashbookBook[] = [];
  try {
    const path = cashbookSnapshotPath();
    if (existsSync(path)) {
      const snap = JSON.parse(readFileSync(path, 'utf8')) as { books?: CashbookBook[] };
      books = snap.books || [];
    }
  } catch {
    books = [];
  }
  domains.push(
    await backfillEntityList({
      entityType: 'cashbook',
      rows: books.map((b) => ({
        internalId: b.id,
        createdAt: b.createdAt,
        current: b.cashbookReferenceId,
      })),
      apply: async (id, ref) => {
        await patchCashbookRef(id, ref);
      },
    }),
  );

  return { domains, userBackfill };
}
