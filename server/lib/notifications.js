import { existsSync } from 'node:fs';
import { db } from '../db.js';
import { config } from '../config.js';
import { formatMoney } from './money.js';
import {
  sendMail,
  renderEmail,
  renderOrderTable,
  renderAddress,
  escapeHtml,
} from './mail.js';
import { ensureInvoiceRecord, invoicePath } from './invoice.js';

/**
 * The two emails an order produces: one for the customer, one for the shop.
 *
 * Called from markOrderPaid(), which is idempotent, so exactly one pair goes
 * out per order even though the webhook and the confirmation-page poll can
 * both reach it. Errors are swallowed by sendMail so a mail problem can never
 * roll back a completed payment.
 */
export async function sendOrderEmails(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return { customer: null, admin: null };

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(orderId);
  const currency = order.currency || config.currency;

  /* --- Attach the invoice PDF when it exists --- */
  const invoice = ensureInvoiceRecord(orderId);
  const pdfPath = invoice ? invoicePath(invoice.invoice_number) : null;
  const attachments =
    pdfPath && existsSync(pdfPath)
      ? [{ filename: `${invoice.invoice_number}.pdf`, path: pdfPath, contentType: 'application/pdf' }]
      : [];

  const orderTable = renderOrderTable(order, items);
  const address = renderAddress(order);

  /* --- 1. Customer confirmation --- */
  const customerHtml = renderEmail({
    heading: 'Thank you for your order',
    intro:
      `Your order <strong>${escapeHtml(order.order_number)}</strong> is confirmed and we have started preparing it. ` +
      `Your invoice is attached as a PDF.`,
    bodyHtml: orderTable + address,
    ctaLabel: 'View your order',
    ctaUrl: `${config.appUrl}/order-confirmation.html?order=${order.id}`,
    footNote:
      `Need to change or return something? Our <a href="${config.appUrl}/refund-policy.html" style="color:#c8102e;">refund policy</a> ` +
      `gives you 30 days from delivery. Personalized and custom-made items are final sale. ` +
      `Questions: <a href="mailto:info@lebanonhockey.com" style="color:#c8102e;">info@lebanonhockey.com</a>.`,
  });

  const customer = await sendMail({
    to: order.email,
    subject: `Order ${order.order_number} confirmed - Lebanon Hockey`,
    html: customerHtml,
    attachments,
    kind: 'order-customer',
    orderId,
  });

  /* --- 2. Admin notification --- */
  const adminTo = config.mailAdmin;
  let admin = null;

  if (adminTo) {
    const account = order.user_id
      ? db.prepare('SELECT email, first_name, last_name, phone FROM users WHERE id = ?').get(order.user_id)
      : null;

    const details = `
      <div style="margin-top:24px;padding:16px 18px;background:#f7f6f4;border-radius:10px;">
        <div style="font-size:10.5px;letter-spacing:1.4px;text-transform:uppercase;color:#6a7178;margin-bottom:6px;">Customer</div>
        <div style="font-size:14px;line-height:1.6;color:#0e1114;">
          ${escapeHtml(order.ship_name || (account ? `${account.first_name} ${account.last_name}`.trim() : '') || 'Guest')}<br>
          <a href="mailto:${escapeHtml(order.email)}" style="color:#c8102e;">${escapeHtml(order.email)}</a>
          ${account?.phone ? `<br>${escapeHtml(account.phone)}` : ''}
          <br><span style="color:#6a7178;">${account ? 'Registered account' : 'Guest checkout'}</span>
        </div>
      </div>`;

    admin = await sendMail({
      to: adminTo,
      replyTo: order.email,
      subject: `New order ${order.order_number} - ${formatMoney(order.total_cents, currency)}`,
      html: renderEmail({
        heading: `New order: ${order.order_number}`,
        intro: `A new order has been paid for <strong>${escapeHtml(formatMoney(order.total_cents, currency))}</strong>.`,
        bodyHtml: orderTable + details + address,
        ctaLabel: 'Open in admin',
        ctaUrl: `${config.appUrl}/admin/orders.html`,
      }),
      attachments,
      kind: 'order-admin',
      orderId,
    });
  } else {
    console.warn('[mail] MAIL_ADMIN / ADMIN_EMAIL not set - no admin order notification sent.');
  }

  return { customer, admin };
}

/**
 * Password reset link. The caller must have already created the token.
 */
export async function sendPasswordResetEmail(user, resetUrl) {
  return sendMail({
    to: user.email,
    subject: 'Reset your Lebanon Hockey password',
    kind: 'password-reset',
    html: renderEmail({
      heading: 'Reset your password',
      intro:
        `We received a request to reset the password for <strong>${escapeHtml(user.email)}</strong>. ` +
        `This link is valid for one hour and can be used once.`,
      ctaLabel: 'Choose a new password',
      ctaUrl: resetUrl,
      footNote:
        'If you did not ask for this, you can ignore this email — your password will not change, ' +
        'and nobody can use this link without access to your inbox.',
    }),
  });
}

/**
 * Contact form notification to the shop, with the sender set as reply-to.
 */
export async function sendContactNotification(message) {
  if (!config.mailAdmin) return null;

  const name = [message.firstName, message.lastName].filter(Boolean).join(' ') || 'Someone';

  return sendMail({
    to: config.mailAdmin,
    replyTo: message.email,
    subject: `Website enquiry from ${name}`,
    kind: 'contact',
    html: renderEmail({
      heading: 'New website enquiry',
      intro: `<strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(message.email)}&gt; sent a message through the contact form.`,
      bodyHtml: `<div style="margin-top:8px;padding:16px 18px;background:#f7f6f4;border-radius:10px;font-size:14px;line-height:1.65;white-space:pre-wrap;color:#0e1114;">${escapeHtml(message.message)}</div>`,
      footNote: 'Reply directly to this email to answer them.',
    }),
  });
}
