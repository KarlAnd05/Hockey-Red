import nodemailer from 'nodemailer';
import { db } from '../db.js';
import { config } from '../config.js';
import { formatMoney } from './money.js';

/* ==========================================================================
   Transport
   --------------------------------------------------------------------------
   Falls back to a console transport when SMTP is not configured, so every
   flow that sends mail stays testable without a mail account and nothing is
   silently lost.
   ========================================================================== */
let transport = null;
let transportKind = null;

function getTransport() {
  if (transport) return { transport, kind: transportKind };

  if (config.smtp.host) {
    transport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
    transportKind = 'smtp';
  } else {
    transport = nodemailer.createTransport({ jsonTransport: true });
    transportKind = 'console';
  }

  return { transport, kind: transportKind };
}

export function mailConfigured() {
  return Boolean(config.smtp.host);
}

/**
 * Send a message and record it.
 *
 * Never throws: a mail outage must not roll back a payment or block a password
 * reset. Failures are logged to the email_log table with the error.
 */
export async function sendMail({ to, subject, html, text, attachments, replyTo, kind, orderId }) {
  const record = (status, error = '') => {
    try {
      db.prepare(
        `INSERT INTO email_log (to_address, subject, kind, order_id, status, error)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(String(to), String(subject), String(kind || ''), orderId ?? null, status, error);
    } catch (e) {
      console.error('[mail] could not write email_log:', e.message);
    }
  };

  if (!to) {
    record('failed', 'no recipient');
    return { ok: false, error: 'no recipient' };
  }

  try {
    const { transport: tx, kind: txKind } = getTransport();

    const info = await tx.sendMail({
      from: config.mailFrom,
      to,
      replyTo,
      subject,
      text: text || stripTags(html),
      html,
      attachments,
    });

    if (txKind === 'console') {
      console.log(
        `\n[mail:console] SMTP not configured - message not delivered\n` +
          `  to      ${to}\n  subject ${subject}\n` +
          (attachments?.length ? `  attach  ${attachments.map((a) => a.filename).join(', ')}\n` : '')
      );
      record('logged');
      return { ok: true, delivered: false, info };
    }

    record('sent');
    return { ok: true, delivered: true, info };
  } catch (error) {
    console.error(`[mail] failed to send "${subject}" to ${to}:`, error.message);
    record('failed', error.message);
    return { ok: false, error: error.message };
  }
}

function stripTags(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|tr|h1|h2|h3|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ==========================================================================
   Branded shell
   --------------------------------------------------------------------------
   Table-based and inline-styled, because email clients are not browsers.
   CASL requires every commercial electronic message to identify the sender and
   give a contact address, so the footer carries both on every message.
   ========================================================================== */
const BRAND = {
  red: '#c8102e',
  ink: '#0e1114',
  inkDeep: '#05070a',
  muted: '#6a7178',
  line: '#e6e4e0',
  soft: '#f7f6f4',
};

const ISSUER = {
  name: 'Lebanese Ice Hockey Federation',
  address: '1418 Victoria Avenue, Suite 110, Greenfield Park, Quebec J4V 1M1, Canada',
  email: 'info@lebanonhockey.com',
};

export function renderEmail({ heading, intro, bodyHtml = '', ctaLabel, ctaUrl, footNote }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.soft};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${BRAND.ink};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.soft};padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(5,7,10,.08);">

      <tr><td style="background:${BRAND.inkDeep};padding:26px 32px;">
        <div style="font-size:19px;font-weight:800;letter-spacing:1.2px;color:#ffffff;">LEBANON HOCKEY</div>
        <div style="font-size:11px;letter-spacing:2px;color:#ff5a6e;margin-top:4px;">${escapeHtml(ISSUER.name.toUpperCase())}</div>
      </td></tr>
      <tr><td style="height:4px;background:${BRAND.red};font-size:0;line-height:0;">&nbsp;</td></tr>

      <tr><td style="padding:32px;">
        <h1 style="margin:0 0 14px;font-size:23px;line-height:1.25;color:${BRAND.inkDeep};">${escapeHtml(heading)}</h1>
        ${intro ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${BRAND.muted};">${intro}</p>` : ''}
        ${bodyHtml}
        ${
          ctaUrl
            ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 6px;">
                 <tr><td style="border-radius:999px;background:${BRAND.red};">
                   <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:14px 30px;font-size:13px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#ffffff;text-decoration:none;">${escapeHtml(ctaLabel || 'Open')}</a>
                 </td></tr>
               </table>
               <p style="margin:14px 0 0;font-size:12px;color:${BRAND.muted};word-break:break-all;">Or paste this link into your browser:<br>${escapeHtml(ctaUrl)}</p>`
            : ''
        }
        ${footNote ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:${BRAND.muted};">${footNote}</p>` : ''}
      </td></tr>

      <tr><td style="padding:20px 32px 28px;border-top:1px solid ${BRAND.line};">
        <p style="margin:0;font-size:11.5px;line-height:1.6;color:${BRAND.muted};">
          ${escapeHtml(ISSUER.name)}<br>
          ${escapeHtml(ISSUER.address)}<br>
          <a href="mailto:${ISSUER.email}" style="color:${BRAND.red};text-decoration:none;">${ISSUER.email}</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

/** Reusable line-items + totals table shared by both order emails. */
export function renderOrderTable(order, items) {
  const currency = order.currency || config.currency;
  const row = (label, value, strong = false, accent = false) => `
    <tr>
      <td style="padding:6px 0;font-size:14px;color:${accent ? BRAND.red : BRAND.muted};">${escapeHtml(label)}</td>
      <td align="right" style="padding:6px 0;font-size:14px;${strong ? `font-weight:800;color:${BRAND.inkDeep};` : `color:${accent ? BRAND.red : BRAND.ink};`}">${escapeHtml(value)}</td>
    </tr>`;

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 4px;">
    <tr>
      <th align="left" style="padding:0 0 8px;border-bottom:2px solid ${BRAND.line};font-size:10.5px;letter-spacing:1.4px;text-transform:uppercase;color:${BRAND.muted};">Item</th>
      <th align="right" style="padding:0 0 8px;border-bottom:2px solid ${BRAND.line};font-size:10.5px;letter-spacing:1.4px;text-transform:uppercase;color:${BRAND.muted};">Amount</th>
    </tr>
    ${items
      .map(
        (item) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid ${BRAND.line};font-size:14px;line-height:1.5;">
          <strong style="color:${BRAND.inkDeep};">${escapeHtml(item.name_snapshot)}</strong>
          <div style="color:${BRAND.muted};font-size:12.5px;">
            ${item.variant_snapshot ? `Size ${escapeHtml(item.variant_snapshot)} &middot; ` : ''}Qty ${item.quantity} &times; ${escapeHtml(formatMoney(item.unit_price_cents, currency))}
          </div>
        </td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid ${BRAND.line};font-size:14px;font-weight:700;color:${BRAND.inkDeep};white-space:nowrap;">
          ${escapeHtml(formatMoney(item.line_total_cents, currency))}
        </td>
      </tr>`
      )
      .join('')}
  </table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 0;">
    ${row('Subtotal', formatMoney(order.subtotal_cents, currency))}
    ${order.discount_cents > 0 ? row(`Discount${order.discount_code ? ` (${order.discount_code})` : ''}`, `-${formatMoney(order.discount_cents, currency)}`, false, true) : ''}
    ${row('Shipping', order.shipping_cents === 0 ? 'Free' : formatMoney(order.shipping_cents, currency))}
    ${order.tax_cents > 0 ? row('Tax', formatMoney(order.tax_cents, currency)) : ''}
    <tr><td colspan="2" style="padding:6px 0 0;border-top:2px solid ${BRAND.line};"></td></tr>
    ${row('Total', formatMoney(order.total_cents, currency), true)}
  </table>`;
}

export function renderAddress(order) {
  const lines = [
    order.ship_name,
    order.ship_line1,
    order.ship_line2,
    [order.ship_city, order.ship_region, order.ship_postal].filter(Boolean).join(', '),
    order.ship_country,
  ].filter(Boolean);

  if (!lines.length) return '';

  return `<div style="margin-top:24px;padding:16px 18px;background:${BRAND.soft};border-radius:10px;">
    <div style="font-size:10.5px;letter-spacing:1.4px;text-transform:uppercase;color:${BRAND.muted};margin-bottom:6px;">Shipping to</div>
    <div style="font-size:14px;line-height:1.6;color:${BRAND.ink};">${lines.map(escapeHtml).join('<br>')}</div>
  </div>`;
}
