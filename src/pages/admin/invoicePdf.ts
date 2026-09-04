/**
 * Direct .pdf generation for the canonical invoice — consumes the SAME
 * InvoiceViewModel (orderHubModel.buildInvoiceViewModel) the screen and print
 * views render. Zero independent financial calculations: every number here is
 * read off `vm`, never recomputed.
 *
 * jsPDF + jspdf-autotable produce a real vector PDF (selectable text, sharp
 * glyphs, true A4 pages) rather than a canvas/screenshot capture — autoTable's
 * own pagination repeats the item-table header on every page and avoids
 * splitting a row, which is exactly the print-CSS multi-page requirement
 * mirrored here for the direct download.
 *
 * PDF-currency note: jsPDF's standard (non-embedded) fonts are WinAnsi/AFM
 * metrics only — ৳ (U+09F3, Bengali) has no entry, and including it forces
 * jsPDF into a per-character positioning fallback for the WHOLE string (the
 * "6 1 8 , 9 9 0" spacing bug), on top of rendering as a broken glyph. No
 * Unicode/Bengali-capable font is bundled in this project to embed instead, so
 * every PDF monetary value goes through ONE helper, formatPdfMoney(), which
 * renders "BDT 18,990" — plain ASCII, correct glyph widths, normal spacing.
 * The on-screen invoice and print view are untouched and keep showing ৳ — this
 * only affects the generated PDF's own text.
 */
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type { OpsStorefrontOrder } from '../../services/operationsApi';
import type { InvoiceViewModel } from './orderHubModel';

const BRAND = {
  navy: [24, 21, 76] as [number, number, number],
  coral: [239, 60, 35] as [number, number, number],
  orange: [255, 91, 0] as [number, number, number],
  muted: [107, 114, 128] as [number, number, number],
  hairline: [232, 237, 242] as [number, number, number],
};

const PAGE_W = 210; // A4 mm
const MARGIN = 14;

/** The ONE PDF money formatter — every monetary string in the generated PDF
 *  goes through this. Plain ASCII "BDT" prefix (see file header for why). */
function formatPdfMoney(n: number): string {
  return `BDT ${Math.round(n).toLocaleString('en-US')}`;
}

/** `Choosify-Invoice-INV-2B2F-94547.pdf`-style — strips anything unsafe for a filename. */
export function invoicePdfFilename(invoiceNumber: string | null, fallback: string): string {
  const base = (invoiceNumber || fallback || 'invoice').trim();
  const safe = base.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `Choosify-Invoice-${safe || 'document'}.pdf`;
}

/**
 * Renders one "LABEL" (row 1) / "value" (row 2, right-aligned, wraps if it
 * doesn't fit `colWidth`) metadata row and returns the Y the NEXT row should
 * start at. This is the ONLY metadata-row renderer in the file — every row in
 * the Invoice Number / Amount / Order Reference / Invoice Date block goes
 * through it, so there is exactly one place that can ever misalign them.
 *
 * Structural fix for the label/value collision: the old layout put the label
 * and a right-aligned, UNBOUNDED-width value on the same line, so any value
 * wider than the label's reserved gap ran left into the label text. Stacking
 * label above value (both right-aligned to the same column) removes the
 * side-by-side collision entirely, and `splitTextToSize(value, colWidth)`
 * makes long values wrap within the column instead of overflowing it.
 */
function drawMetadataRow(
  doc: jsPDF,
  opts: { xRight: number; y: number; colWidth: number; label: string; value: string; big?: boolean },
): number {
  const { xRight, y, colWidth, label, value, big } = opts;
  const labelSize = 7.5;
  const valueSize = big ? 13 : 9;
  const labelLineH = labelSize * 0.42;
  const valueLineH = valueSize * 0.42;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(labelSize);
  doc.setTextColor(...BRAND.muted);
  doc.text(label.toUpperCase(), xRight, y, { align: 'right' });

  doc.setFont('helvetica', big ? 'bold' : 'normal');
  doc.setFontSize(valueSize);
  doc.setTextColor(...(big ? BRAND.coral : BRAND.navy));

  const lines = doc.splitTextToSize(String(value || '—'), colWidth) as string[];
  let ly = y + labelLineH + 1.6;
  for (const line of lines) {
    doc.text(line, xRight, ly, { align: 'right' });
    ly += valueLineH + 0.8;
  }
  return ly + 2; // gap before the next metadata row
}

export type InvoicePdfInput = {
  vm: InvoiceViewModel;
  order: OpsStorefrontOrder;
  invoiceDate: string;
  /** data: URL for the official Choosify horizontal navy logo — same asset as
   *  screen/print/email. Passed in (not fetched here) so this module stays a
   *  pure builder with no network/DOM access of its own. */
  logoDataUrl?: string | null;
};

/** Builds the finished jsPDF document. Caller decides save vs. blob vs. preview. */
export function buildInvoicePdf({ vm, order, invoiceDate, logoDataUrl }: InvoicePdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const sub = vm.subOrder;

  // ── Header (page 1 only) ──
  let y = MARGIN;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', MARGIN, y, 44.75, 10, undefined, 'FAST');
    } catch {
      /* fall through to text wordmark if the image can't be decoded */
    }
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text('CHOOSIFY MARKETPLACE', MARGIN, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('choosify.bd', MARGIN, y + 21);
  doc.text('support@choosify.bd', MARGIN, y + 25);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.navy);
  doc.text('BUSINESS ADDRESS', PAGE_W - MARGIN, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text('Uttara, Dhaka - 1230, Bangladesh', PAGE_W - MARGIN, y + 5, { align: 'right' });
  doc.setTextColor(...BRAND.muted);
  doc.text('Trade License: TR-2026-REG-1099', PAGE_W - MARGIN, y + 9.5, { align: 'right' });

  y += 32;
  doc.setDrawColor(...BRAND.hairline);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  // ── Billed To (left column) / Invoice meta (right column) ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text('BILLED TO', MARGIN, y);
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.navy);
  doc.text(order.shipping?.fullName || 'Buyer', MARGIN, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 70);
  const addrLine = `${order.shipping?.address || '—'}${order.shipping?.region ? `, ${order.shipping.region}` : ''}`;
  const billedToColWidth = 95;
  const addrLines = doc.splitTextToSize(addrLine, billedToColWidth) as string[];
  const addrLineH = 8.5 * 0.42; // matches the metadata renderer's line-height convention
  addrLines.forEach((line, i) => doc.text(line, MARGIN, y + 12 + i * addrLineH));
  const phoneY = y + 12 + addrLines.length * addrLineH + 2.5; // moves down for a wrapped address
  doc.text(`Phone: ${order.shipping?.phone || '—'}`, MARGIN, phoneY);

  // Right-hand metadata column — one renderer, four rows, dynamic height.
  const metaX = PAGE_W - MARGIN; // right edge every metadata value aligns to
  const metaColWidth = 85; // reserved width for label+value wrapping
  let my = y;
  my = drawMetadataRow(doc, { xRight: metaX, y: my, colWidth: metaColWidth, label: 'Invoice Number', value: vm.invoiceNumber ? `#${vm.invoiceNumber}` : '—' });
  my = drawMetadataRow(doc, { xRight: metaX, y: my, colWidth: metaColWidth, label: 'Invoice Amount', value: formatPdfMoney(vm.grandTotal), big: true });
  my = drawMetadataRow(doc, { xRight: metaX, y: my, colWidth: metaColWidth, label: 'Order Reference', value: order.orderId });
  my = drawMetadataRow(doc, { xRight: metaX, y: my, colWidth: metaColWidth, label: 'Invoice Date', value: invoiceDate });

  // Both columns may have grown to different heights (a long "Billed To"
  // address vs. a long Order Reference) — the divider goes below whichever is
  // taller so nothing from either column is cut off.
  const billedToBottom = phoneY + 3;
  y = Math.max(billedToBottom, my) + 4;
  doc.setDrawColor(...BRAND.hairline);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;

  // ── Sold by strip — wraps a long business name instead of colliding with
  //    the "MARKETPLACE SELLER" chip on the right. ──
  const soldByLabel = 'SOLD BY';
  const sellerName = sub?.sellerBusinessName || 'Choosify Marketplace Seller';
  const chipText = 'MARKETPLACE SELLER';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const chipWidth = doc.getTextWidth(chipText) + 8;
  const sellerNameMaxWidth = PAGE_W - MARGIN * 2 - 8 - chipWidth - 6; // leave room for the chip
  doc.setFontSize(9.5);
  const sellerNameLines = doc.splitTextToSize(sellerName, sellerNameMaxWidth) as string[];
  const stripH = Math.max(12, 4.5 + sellerNameLines.length * 4.2 + 2);

  doc.setFillColor(248, 248, 248);
  doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, stripH, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...BRAND.muted);
  doc.text(soldByLabel, MARGIN + 4, y + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 30, 40);
  sellerNameLines.forEach((line, i) => doc.text(line, MARGIN + 4, y + 9.5 + i * 4.2));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...BRAND.orange);
  doc.text(chipText, PAGE_W - MARGIN - 4, y + 7.5, { align: 'right' });
  y += stripH + 6;

  // ── Items table — autoTable owns pagination: repeats the header row on
  //    every new page, avoids splitting a row across pages, wraps long text.
  //    Rate/Amount columns are sized for up to 8-digit values (e.g. "BDT
  //    12,345,678") without clipping or crowding the Item column. ──
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, bottom: 26 },
    head: [['Item', 'Qty', 'Rate', 'Amount']],
    body: vm.lines.map((line) => [
      [line.title, line.serviceCategory, line.variantLabel, line.variantSku ? `SKU ${line.variantSku}` : '']
        .filter(Boolean)
        .join('\n'),
      String(line.qty),
      formatPdfMoney(line.unitPrice),
      formatPdfMoney(line.lineTotal),
    ]),
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 3, textColor: [30, 30, 40], lineColor: BRAND.hairline, lineWidth: 0.1, overflow: 'linebreak' },
    headStyles: { fillColor: [255, 255, 255], textColor: BRAND.muted, fontStyle: 'bold', fontSize: 7.5, lineWidth: { bottom: 0.3 }, lineColor: [200, 200, 210] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 14, halign: 'right' },
      2: { cellWidth: 32, halign: 'right' },
      3: { cellWidth: 34, halign: 'right', fontStyle: 'bold' },
    },
    rowPageBreak: 'avoid', // never split a single item row across two pages
    didDrawPage: (data) => {
      // Small continuation identifier on pages after the first — full
      // branding/address stays page-1-only to avoid wasting space. This is
      // NOT a page-number renderer — see the single canonical one below.
      if (data.pageNumber > 1) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...BRAND.muted);
        doc.text(`Invoice #${vm.invoiceNumber || '—'} - Order ${order.orderId}`, MARGIN, 10);
      }
    },
  });

  // ── Summary + closing block — kept together; if there isn't room on the
  //    page the table ended on, the whole block moves to a fresh page rather
  //    than being squeezed or overlapping the (single) page-number line. ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sy = (doc as any).lastAutoTable.finalY + 8;
  const pageH = doc.internal.pageSize.getHeight();
  const CLOSING_BLOCK_H = 68; // summary + payment badge + divider + thank-you
  if (sy > pageH - CLOSING_BLOCK_H) {
    doc.addPage();
    sy = MARGIN;
  }

  const sumX = PAGE_W - MARGIN;
  const sumLabelX = sumX - 60; // widened so 7-8 digit totals never crowd the label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.muted);
  doc.text('Subtotal:', sumLabelX, sy);
  doc.setTextColor(30, 30, 40);
  doc.text(formatPdfMoney(vm.itemsSubtotal), sumX, sy, { align: 'right' });
  sy += 6;
  doc.setTextColor(...BRAND.muted);
  doc.text('Delivery Fee:', sumLabelX, sy);
  doc.setTextColor(30, 30, 40);
  doc.text(formatPdfMoney(vm.deliveryTotal), sumX, sy, { align: 'right' });
  sy += 4;
  doc.setDrawColor(...BRAND.hairline);
  doc.line(sumLabelX, sy, sumX, sy);
  sy += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.coral);
  doc.text('Total:', sumLabelX, sy);
  doc.text(formatPdfMoney(vm.grandTotal), sumX, sy, { align: 'right' });
  sy += 8;

  doc.setFillColor(...BRAND.navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const badgeW = doc.getTextWidth(vm.paymentMethodLabel.toUpperCase()) + 8;
  doc.roundedRect(sumX - badgeW, sy - 3.5, badgeW, 6, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(vm.paymentMethodLabel.toUpperCase(), sumX - badgeW / 2, sy, { align: 'center' });
  sy += 6.5; // fixed gap so the badge and the status line below never touch
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...BRAND.muted);
  const statusLines = doc.splitTextToSize(vm.paymentStatusLabel, 90) as string[];
  statusLines.forEach((line, i) => doc.text(line, sumX, sy + i * 3.6, { align: 'right' }));
  sy += statusLines.length * 3.6 + 8;

  doc.setDrawColor(...BRAND.coral);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, sy, PAGE_W - MARGIN, sy);
  sy += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BRAND.navy);
  doc.text('Thanks for shopping with Choosify.', MARGIN, sy);
  sy += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...BRAND.muted);
  doc.text('This is a system-generated invoice - no signature required. Powered by Choosify.bd', MARGIN, sy);

  // ── The SINGLE canonical page-number renderer. Nothing else in this file
  //    writes "Page …" text — the old duplicate came from autoTable's
  //    didDrawPage ALSO stamping "Page N" at this same position; that call
  //    is gone (see didDrawPage above), so this loop is the only source now. ──
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...BRAND.muted);
    doc.text(`Page ${p} of ${totalPages}`, PAGE_W - MARGIN, pageH - 8, { align: 'right' });
  }

  return doc;
}
