import PDFDocument from 'pdfkit';
import { Invoice } from '../models/Invoice.js';
import { notFound } from '../utils/errors.js';
import { formatINR } from '../utils/money.js';

/**
 * Invoice PDF (Section 31).
 *
 * Everything printed comes from the invoice document itself, never from the
 * live product or party records. That is the whole point of snapshotting: a
 * reprint in 2029 shows the address, the product names and the prices as they
 * were on the day, not as they are now.
 *
 * Tax columns appear only when the invoice was raised with tax enabled, so a
 * tax-free invoice does not print an empty GST column implying zero was
 * charged on a taxable supply.
 */

const GREEN = '#2E7D32';
const DARK = '#1B5E20';
const GOLD = '#F9A825';
const GREY = '#666666';
const LINE = '#DDDDDD';

const M = 40;                 // page margin
const PAGE_W = 595.28;        // A4 width in points
const CONTENT_W = PAGE_W - M * 2;

export async function renderInvoicePdf(invoiceId) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw notFound('Invoice not found.');

  return {
    invoice,
    /**
     * Attach the destination, then finalise. pdfkit writes as it goes, so the
     * pipe has to exist before `end()`; ending first would leave the whole
     * document sitting in the stream's internal buffer and rely on it never
     * overflowing. Building the document here rather than in `renderInvoicePdf`
     * also means a 404 is raised before any header or byte has been sent.
     */
    pipeTo(writable) {
      const doc = buildInvoiceDocument(invoice);
      doc.pipe(writable);
      doc.end();
      return doc;
    },
  };
}

/** Lays out the document but does not finalise it - the caller pipes, then ends. */
export function buildInvoiceDocument(invoice) {
  const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true });
  const taxed = Boolean(invoice.taxEnabled) && invoice.taxTotal > 0;

  header(doc, invoice);
  const partiesBottom = parties(doc, invoice);
  const tableBottom = itemsTable(doc, invoice, taxed, partiesBottom + 16);
  totals(doc, invoice, taxed, tableBottom + 14);
  footer(doc, invoice);

  return doc;
}

function header(doc, invoice) {
  const s = invoice.seller ?? {};

  doc.rect(0, 0, PAGE_W, 6).fill(GREEN);

  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(20).text(s.name ?? 'Nirmala Enterprises', M, 30);

  doc.fillColor(GREY).font('Helvetica').fontSize(8.5);
  const sellerLines = [s.address, [s.phone, s.email].filter(Boolean).join('  |  ')].filter(Boolean);
  let y = doc.y + 1;
  for (const line of sellerLines) {
    doc.text(line, M, y, { width: CONTENT_W * 0.55 });
    y = doc.y;
  }
  if (s.gstin) {
    doc.font('Helvetica-Bold').fillColor(GREY).text(`GSTIN: ${s.gstin}`, M, y);
  }

  // Invoice identity block, right aligned.
  const boxW = 190;
  const boxX = PAGE_W - M - boxW;
  doc.roundedRect(boxX, 28, boxW, 74, 4).fill('#F7F9F5');

  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(15)
    .text(invoice.taxEnabled ? 'TAX INVOICE' : 'INVOICE', boxX + 12, 36, { width: boxW - 24, align: 'right' });

  doc.fontSize(9).fillColor('#333333');
  const meta = [
    ['Invoice No.', invoice.invoiceCode],
    ['Date', new Date(invoice.date).toLocaleDateString('en-IN')],
    ['Sale Ref.', invoice.saleCode ?? '-'],
  ];
  let my = 58;
  for (const [label, value] of meta) {
    doc.font('Helvetica').fillColor(GREY).text(label, boxX + 12, my, { width: 70 });
    doc.font('Helvetica-Bold').fillColor('#222222')
      .text(String(value), boxX + 82, my, { width: boxW - 94, align: 'right' });
    my += 14;
  }

  doc.moveTo(M, 112).lineTo(PAGE_W - M, 112).lineWidth(0.8).strokeColor(LINE).stroke();
}

function parties(doc, invoice) {
  const b = invoice.buyer ?? {};
  const top = 124;

  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(GREEN).text('BILL TO', M, top);

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#222222').text(b.name ?? '', M, top + 13);

  doc.font('Helvetica').fontSize(9).fillColor(GREY);
  const lines = [
    b.partyCode ? `Code: ${b.partyCode}` : null,
    [b.address, b.village].filter(Boolean).join(', ') || null,
    b.phone ? `Phone: ${b.phone}` : null,
    b.gstin ? `GSTIN: ${b.gstin}` : null,
  ].filter(Boolean);

  let y = top + 28;
  for (const line of lines) {
    doc.text(line, M, y, { width: CONTENT_W * 0.6 });
    y = doc.y + 1;
  }

  // Payment status stamp, so an unpaid copy is obvious at a glance.
  const status = invoice.paymentStatus ?? 'UNPAID';
  const colour = status === 'PAID' ? GREEN : status === 'PARTIAL' ? GOLD : '#D32F2F';
  const stampW = 92;
  doc.roundedRect(PAGE_W - M - stampW, top, stampW, 22, 3).fill(colour);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10)
    .text(status, PAGE_W - M - stampW, top + 6, { width: stampW, align: 'center' });

  return Math.max(y, top + 34);
}

function itemsTable(doc, invoice, taxed, top) {
  /**
   * Column widths are computed from the available width so the layout stays
   * balanced whether or not the tax columns are present, rather than leaving a
   * gap where GST would have been.
   */
  const cols = taxed
    ? [
        { key: 'sn', label: '#', w: 24, align: 'center' },
        { key: 'productName', label: 'Description', w: 168, align: 'left' },
        { key: 'qty', label: 'Qty', w: 54, align: 'right' },
        { key: 'rate', label: 'Rate', w: 60, align: 'right' },
        { key: 'discount', label: 'Disc.', w: 50, align: 'right' },
        { key: 'taxRatePct', label: 'Tax %', w: 42, align: 'right' },
        { key: 'taxAmount', label: 'Tax', w: 55, align: 'right' },
        { key: 'lineTotal', label: 'Amount', w: 62, align: 'right' },
      ]
    : [
        { key: 'sn', label: '#', w: 26, align: 'center' },
        { key: 'productName', label: 'Description', w: 235, align: 'left' },
        { key: 'qty', label: 'Qty', w: 66, align: 'right' },
        { key: 'rate', label: 'Rate', w: 70, align: 'right' },
        { key: 'discount', label: 'Discount', w: 66, align: 'right' },
        { key: 'lineTotal', label: 'Amount', w: 52, align: 'right' },
      ];

  const rowH = 20;
  let y = top;

  const drawHead = () => {
    doc.rect(M, y, CONTENT_W, rowH).fill(GREEN);
    let x = M;
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5);
    for (const c of cols) {
      doc.text(c.label, x + 4, y + 6, { width: c.w - 8, align: c.align });
      x += c.w;
    }
    y += rowH;
  };

  drawHead();

  doc.font('Helvetica').fontSize(9);

  invoice.items.forEach((item, idx) => {
    // New page if the row would cross the reserved footer area.
    if (y + rowH > 700) {
      doc.addPage();
      y = M;
      drawHead();
      doc.font('Helvetica').fontSize(9);
    }

    if (idx % 2 === 1) doc.rect(M, y, CONTENT_W, rowH).fill('#F7F9F5');

    const values = {
      sn: String(idx + 1),
      productName: item.unitSymbol
        ? `${item.productName}  (${item.unitSymbol})`
        : item.productName,
      qty: trimQty(item.qty),
      rate: formatINR(item.rate),
      discount: item.discount ? formatINR(item.discount) : '-',
      taxRatePct: item.taxRatePct ? `${item.taxRatePct}%` : '-',
      taxAmount: item.taxAmount ? formatINR(item.taxAmount) : '-',
      lineTotal: formatINR(item.lineTotal),
    };

    let x = M;
    doc.fillColor('#222222');
    for (const c of cols) {
      doc.text(values[c.key] ?? '', x + 4, y + 6, {
        width: c.w - 8,
        align: c.align,
        ellipsis: true,
        lineBreak: false,
      });
      x += c.w;
    }

    doc.moveTo(M, y + rowH).lineTo(PAGE_W - M, y + rowH).lineWidth(0.4).strokeColor(LINE).stroke();
    y += rowH;
  });

  return y;
}

function totals(doc, invoice, taxed, top) {
  const boxW = 220;
  const boxX = PAGE_W - M - boxW;
  let y = top;

  const line = (label, value, opts = {}) => {
    doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.bold ? 10.5 : 9.5)
      .fillColor(opts.bold ? DARK : GREY)
      .text(label, boxX, y, { width: boxW * 0.55 });
    doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fillColor(opts.bold ? DARK : '#222222')
      .text(value, boxX + boxW * 0.55, y, { width: boxW * 0.45, align: 'right' });
    y += opts.bold ? 18 : 14;
  };

  line('Subtotal', formatINR(invoice.subtotal));
  if (invoice.discountTotal > 0) line('Discount', `- ${formatINR(invoice.discountTotal)}`);
  if (taxed) line('Tax', formatINR(invoice.taxTotal));

  doc.moveTo(boxX, y + 2).lineTo(PAGE_W - M, y + 2).lineWidth(0.8).strokeColor(GREEN).stroke();
  y += 8;

  line('Grand Total', formatINR(invoice.grandTotal), { bold: true });

  if (invoice.amountPaid > 0 || invoice.outstanding > 0) {
    line('Paid', formatINR(invoice.amountPaid));
    line('Balance Due', formatINR(invoice.outstanding), { bold: invoice.outstanding > 0 });
  }

  // Amount in words, in the Indian numbering system.
  if (invoice.amountInWords) {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(GREEN)
      .text('AMOUNT IN WORDS', M, top);
    doc.font('Helvetica-Oblique').fontSize(9).fillColor('#222222')
      .text(invoice.amountInWords, M, top + 13, { width: CONTENT_W - boxW - 20 });
  }

  return y;
}

function footer(doc, invoice) {
  const range = doc.bufferedPageRange();

  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const bottom = 780;

    doc.moveTo(M, bottom - 46).lineTo(PAGE_W - M, bottom - 46)
      .lineWidth(0.6).strokeColor(LINE).stroke();

    if (invoice.terms) {
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(GREY).text('TERMS', M, bottom - 40);
      doc.font('Helvetica').fontSize(7.5).fillColor(GREY)
        .text(invoice.terms, M, bottom - 31, { width: CONTENT_W * 0.55 });
    }

    doc.font('Helvetica').fontSize(8).fillColor(GREY)
      .text(`For ${invoice.seller?.name ?? 'Nirmala Enterprises'}`, PAGE_W - M - 160, bottom - 40, {
        width: 160, align: 'right',
      });
    doc.text('Authorised Signatory', PAGE_W - M - 160, bottom - 8, { width: 160, align: 'right' });

    if (invoice.footerNote) {
      doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(GREY)
        .text(invoice.footerNote, M, bottom, { width: CONTENT_W * 0.6 });
    }

    doc.font('Helvetica').fontSize(7).fillColor('#999999')
      .text(`Page ${i - range.start + 1} of ${range.count}`, PAGE_W - M - 90, bottom, {
        width: 90, align: 'right',
      });

    doc.rect(0, 835, PAGE_W, 6).fill(GREEN);
  }
}

/** 12.500 -> "12.5", 12.000 -> "12" - trailing zeros are noise on an invoice. */
function trimQty(qty) {
  const n = Number(qty);
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
}
