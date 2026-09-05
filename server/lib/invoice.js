import PDFDocument from 'pdfkit';
import { createWriteStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { db, rootDir } from '../db.js';
import { formatMoney } from './money.js';

const invoiceDir = join(rootDir, 'invoices');

const BRAND = {
  red: '#c8102e',
  redDark: '#96001f',
  ink: '#0e1114',
  muted: '#6a7178',
  line: '#e6e4e0',
  soft: '#f7f6f4',
};

const ISSUER = {
  name: 'Lebanese Ice Hockey Federation',
  lines: [
    '1418 Victoria Avenue, Suite 110',
    'Greenfield Park, Quebec J4V 1M1, Canada',
    'info@lebanonhockey.com',
  ],
};

export function invoicePath(invoiceNumber) {
  return join(invoiceDir, `${invoiceNumber}.pdf`);
}

/**
 * Ensure an invoice row exists for a paid order and return it.
 */
export function ensureInvoiceRecord(orderId) {
  const existing = db.prepare('SELECT * FROM invoices WHERE order_id = ?').get(orderId);
  if (existing) return existing;

  const year = new Date().getFullYear();
  const countThisYear = db
    .prepare("SELECT COUNT(*) AS n FROM invoices WHERE invoice_number LIKE ?")
    .get(`LIHF-${year}-%`).n;

  const invoiceNumber = `LIHF-${year}-${String(countThisYear + 1).padStart(5, '0')}`;

  db.prepare('INSERT INTO invoices (order_id, invoice_number) VALUES (?, ?)').run(
    orderId,
    invoiceNumber
  );

  return db.prepare('SELECT * FROM invoices WHERE order_id = ?').get(orderId);
}

function loadOrder(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return null;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(orderId);
  return { order, items };
}

/**
 * Render the invoice PDF to disk (idempotent unless force is set) and return
 * the absolute file path.
 */
export async function generateInvoicePdf(orderId, { force = false } = {}) {
  const record = ensureInvoiceRecord(orderId);
  if (!record) return null;

  const path = invoicePath(record.invoice_number);
  if (!force && existsSync(path)) return path;

  const data = loadOrder(orderId);
  if (!data) return null;

  const { order, items } = data;
  const currency = order.currency || 'cad';

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = createWriteStream(path);

    doc.pipe(stream);
    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const left = 50;
    const right = pageWidth - 50;
    const contentWidth = right - left;

    /* --- Header band ---------------------------------------------------- */
    doc.rect(0, 0, pageWidth, 116).fill(BRAND.ink);
    doc.rect(0, 116, pageWidth, 5).fill(BRAND.red);

    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(20)
      .text('LEBANON HOCKEY', left, 38, { characterSpacing: 1.2 });

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#b9bec4')
      .text(ISSUER.name.toUpperCase(), left, 64, { characterSpacing: 0.8 });

    doc
      .font('Helvetica-Bold')
      .fontSize(26)
      .fillColor('#ffffff')
      .text('INVOICE', left, 38, { width: contentWidth, align: 'right' });

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#b9bec4')
      .text(record.invoice_number, left, 70, { width: contentWidth, align: 'right' });

    /* --- Meta ------------------------------------------------------------ */
    let y = 150;

    doc.fillColor(BRAND.muted).font('Helvetica-Bold').fontSize(8);
    doc.text('BILLED TO', left, y, { characterSpacing: 1 });
    doc.text('ORDER', left + contentWidth / 2, y, { characterSpacing: 1 });

    y += 15;
    doc.fillColor(BRAND.ink).font('Helvetica').fontSize(10);

    const billName = order.ship_name || order.email;
    const billLines = [
      billName,
      order.email,
      order.ship_line1,
      order.ship_line2,
      [order.ship_city, order.ship_region, order.ship_postal].filter(Boolean).join(', '),
      order.ship_country,
    ].filter(Boolean);

    billLines.forEach((line, i) => {
      doc.text(line, left, y + i * 14, { width: contentWidth / 2 - 20 });
    });

    const issued = (record.issued_at || order.created_at || '').replace('T', ' ').slice(0, 10);
    const metaLines = [
      ['Order number', order.order_number],
      ['Invoice date', issued],
      ['Status', order.status.toUpperCase()],
      ['Payment', order.stripe_payment_intent ? 'Card via Stripe' : '-'],
    ];

    metaLines.forEach(([label, value], i) => {
      const rowY = y + i * 14;
      doc.fillColor(BRAND.muted).text(`${label}:`, left + contentWidth / 2, rowY, { width: 90 });
      doc
        .fillColor(BRAND.ink)
        .text(String(value), left + contentWidth / 2 + 95, rowY, { width: contentWidth / 2 - 95 });
    });

    y += Math.max(billLines.length, metaLines.length) * 14 + 30;

    /* --- Items table ----------------------------------------------------- */
    const col = {
      item: left + 10,
      qty: left + contentWidth - 200,
      unit: left + contentWidth - 140,
      total: left + contentWidth - 70,
    };

    doc.rect(left, y, contentWidth, 24).fill(BRAND.soft);
    doc.fillColor(BRAND.muted).font('Helvetica-Bold').fontSize(8);
    doc.text('DESCRIPTION', col.item, y + 8, { characterSpacing: 0.8 });
    doc.text('QTY', col.qty, y + 8, { width: 40, align: 'right' });
    doc.text('UNIT', col.unit, y + 8, { width: 60, align: 'right' });
    doc.text('AMOUNT', col.total, y + 8, { width: 60, align: 'right' });

    y += 24;
    doc.font('Helvetica').fontSize(10);

    items.forEach((item) => {
      if (y > doc.page.height - 190) {
        doc.addPage();
        y = 60;
      }

      const label = item.variant_snapshot
        ? `${item.name_snapshot}  (${item.variant_snapshot})`
        : item.name_snapshot;

      doc.fillColor(BRAND.ink).text(label, col.item, y + 8, { width: col.qty - col.item - 12 });
      doc.text(String(item.quantity), col.qty, y + 8, { width: 40, align: 'right' });
      doc.text(formatMoney(item.unit_price_cents, currency), col.unit, y + 8, {
        width: 60,
        align: 'right',
      });
      doc.text(formatMoney(item.line_total_cents, currency), col.total, y + 8, {
        width: 60,
        align: 'right',
      });

      y += 28;
      doc.moveTo(left, y).lineTo(right, y).strokeColor(BRAND.line).lineWidth(1).stroke();
    });

    /* --- Totals ---------------------------------------------------------- */
    y += 16;

    const totals = [
      ['Subtotal', order.subtotal_cents],
      order.discount_cents > 0
        ? [`Discount${order.discount_code ? ` (${order.discount_code})` : ''}`, -order.discount_cents]
        : null,
      ['Shipping', order.shipping_cents],
      order.tax_cents > 0 ? ['Tax', order.tax_cents] : null,
    ].filter(Boolean);

    totals.forEach(([label, value]) => {
      doc.fillColor(BRAND.muted).font('Helvetica').fontSize(10);
      doc.text(label, col.unit - 110, y, { width: 160, align: 'right' });
      doc.fillColor(BRAND.ink);
      doc.text(formatMoney(value, currency), col.total, y, { width: 60, align: 'right' });
      y += 18;
    });

    y += 6;
    doc.rect(col.unit - 110, y, contentWidth - (col.unit - 110 - left), 34).fill(BRAND.red);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11);
    doc.text('TOTAL PAID', col.unit - 100, y + 11, { width: 150, align: 'right' });
    doc.fontSize(13).text(formatMoney(order.total_cents, currency), col.total, y + 10, {
      width: 60,
      align: 'right',
    });

    /* --- Footer ---------------------------------------------------------- */
    const footerY = doc.page.height - 96;
    doc.moveTo(left, footerY).lineTo(right, footerY).strokeColor(BRAND.line).lineWidth(1).stroke();

    doc.font('Helvetica').fontSize(8).fillColor(BRAND.muted);
    ISSUER.lines.forEach((line, i) => {
      doc.text(line, left, footerY + 12 + i * 11);
    });

    doc.text('Thank you for supporting Lebanese ice hockey.', left, footerY + 12, {
      width: contentWidth,
      align: 'right',
    });

    doc.end();
  });

  return path;
}
