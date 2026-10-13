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
import { findDonation, issueManageToken } from './donations.js';
import { findThread } from './chat.js';
import { findRegistration, TIERS } from './registrations.js';

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


/* ==========================================================================
   Donations
   --------------------------------------------------------------------------
   IMPORTANT, and deliberate: nothing below calls this a receipt, says
   "tax deductible", or carries a registration number. The federation's
   charitable status is unconfirmed, and a confirmation that implies
   deductibility when none applies misleads the donor at tax time.

   >>> If charitable status is confirmed, the CRA-prescribed wording and the
   >>> registration number go here, and the subject/heading can become
   >>> "Official donation receipt". Until then, leave this exactly as it is.
   ========================================================================== */

/** Thank the donor, and give a monthly donor the way to stop giving. */
export async function sendDonationThankYou(donationId) {
  const donation = findDonation(donationId);
  if (!donation || !donation.email) return null;

  const monthly = donation.kind === 'monthly';
  const amount = formatMoney(donation.total_cents, donation.currency);
  const greeting = donation.name ? escapeHtml(donation.name.split(' ')[0]) : 'there';

  /* The manage link is minted here so the raw token exists only for as long as
     it takes to render this email. */
  const manageUrl = monthly
    ? `${config.appUrl}/api/donate/manage/${issueManageToken(donation.id)}`
    : '';

  const covered =
    donation.fee_cents > 0
      ? `<p style="margin:0 0 10px;">You also covered the ${escapeHtml(
          formatMoney(donation.fee_cents, donation.currency)
        )} transaction fee, so the federation receives the full ${escapeHtml(
          formatMoney(donation.amount_cents, donation.currency)
        )}. Thank you.</p>`
      : '';

  return sendMail({
    to: donation.email,
    subject: monthly
      ? `Your monthly gift to Lebanon Hockey is set up`
      : `Thank you for your gift to Lebanon Hockey`,
    kind: monthly ? 'donation-monthly' : 'donation-one-time',
    html: renderEmail({
      heading: monthly ? 'Your monthly gift is set up' : 'Thank you for your gift',
      intro: `Hello ${greeting} &mdash; thank you for supporting Lebanese ice hockey.`,
      bodyHtml:
        `<p style="margin:0 0 10px;"><strong>${escapeHtml(amount)}</strong>${
          monthly ? ' every month' : ''
        }, received ${escapeHtml(String(donation.paid_at || '').slice(0, 10))}.</p>` +
        covered +
        (monthly
          ? '<p style="margin:0 0 10px;">You can change or stop your monthly gift at any time &mdash; no email required, no questions asked.</p>'
          : '') +
        '<p style="margin:0;font-size:13px;color:#6a7178;">This is a confirmation of your payment. It is not an official tax receipt.</p>',
      ctaLabel: monthly ? 'Manage or cancel your monthly gift' : '',
      ctaUrl: manageUrl,
      footNote: monthly
        ? 'Keep this email if you want to stop your gift later - this link is how you do it.'
        : '',
    }),
  });
}

/** Tell the federation a gift arrived. */
export async function sendDonationAdminAlert(donationId) {
  if (!config.mailAdmin) return null;

  const donation = findDonation(donationId);
  if (!donation) return null;

  const who = donation.name || donation.email || 'Someone';
  const amount = formatMoney(donation.total_cents, donation.currency);

  return sendMail({
    to: config.mailAdmin,
    replyTo: donation.email || undefined,
    subject: `${donation.kind === 'monthly' ? 'New monthly donor' : 'Donation'} - ${amount}`,
    kind: 'donation-admin',
    html: renderEmail({
      heading: donation.kind === 'monthly' ? 'New monthly donor' : 'A donation arrived',
      intro: `<strong>${escapeHtml(who)}</strong> gave <strong>${escapeHtml(amount)}</strong>${
        donation.kind === 'monthly' ? ' per month' : ''
      }.`,
      bodyHtml:
        `<p style="margin:0 0 6px;">Email: ${escapeHtml(donation.email || '-')}</p>` +
        (donation.fee_cents > 0
          ? `<p style="margin:0 0 6px;">They covered the ${escapeHtml(
              formatMoney(donation.fee_cents, donation.currency)
            )} fee.</p>`
          : '') +
        (donation.message
          ? `<div style="margin-top:8px;padding:16px 18px;background:#f7f6f4;border-radius:10px;font-size:14px;line-height:1.65;white-space:pre-wrap;color:#0e1114;">${escapeHtml(
              donation.message
            )}</div>`
          : ''),
      ctaLabel: 'Open the admin area',
      ctaUrl: `${config.appUrl}/admin/donations.html`,
    }),
  });
}


/* ==========================================================================
   Chat
   ========================================================================== */

/**
 * Tell the federation a visitor is asking something.
 *
 * Most visitors chat anonymously, so there is usually nobody to reply to by
 * email - the answer goes back through the widget. When a visitor did leave an
 * address, it becomes the reply-to, so hitting reply reaches them even after
 * they close the tab.
 */
export async function sendChatNotification(threadId) {
  if (!config.chatNotifyEmail) return null;

  const thread = findThread(threadId);
  if (!thread) return null;

  const recent = db
    .prepare('SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY id DESC LIMIT 6')
    .all(threadId)
    .reverse();

  const who = thread.visitor_name || 'A visitor';
  const transcript = recent
    .map((m) => {
      const label = m.sender === 'admin' ? 'Federation' : who;
      return `<p style="margin:0 0 10px;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(m.body)}</p>`;
    })
    .join('');

  return sendMail({
    to: config.chatNotifyEmail,
    replyTo: thread.visitor_email || undefined,
    subject: `Chat message from ${who}`,
    kind: 'chat-admin',
    html: renderEmail({
      heading: 'Someone is chatting on the site',
      intro: thread.visitor_email
        ? `<strong>${escapeHtml(who)}</strong> &lt;${escapeHtml(thread.visitor_email)}&gt; is asking:`
        : `<strong>${escapeHtml(who)}</strong> is asking (no email given, so reply in the admin area):`,
      bodyHtml: `<div style="margin-top:8px;padding:16px 18px;background:#f7f6f4;border-radius:10px;font-size:14px;line-height:1.65;color:#0e1114;">${transcript}</div>`,
      ctaLabel: 'Open the chat',
      ctaUrl: `${config.appUrl}/admin/chat.html`,
      footNote: thread.visitor_email
        ? 'Replying to this email reaches the visitor directly.'
        : 'This visitor left no email address - answering in the admin area is the only way to reach them.',
    }),
  });
}


/* ==========================================================================
   Membership registrations
   ========================================================================== */

/**
 * Two emails: a confirmation for the applicant, an alert for the federation.
 *
 * Note what the admin alert does NOT contain: no date of birth, no place of
 * birth, no citizenships, no passport-form middle name. Email is not a secure
 * channel and those fields are the most sensitive the site collects - the alert
 * carries a name and a link, and the details stay behind the admin login.
 */
export async function sendRegistrationEmails(registrationId) {
  const row = findRegistration(registrationId);
  if (!row) return null;

  const tier = TIERS[row.tier]?.label || row.tier;
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ') || 'A new member';
  const amount = formatMoney(row.amount_cents, row.currency);
  const unpaid = row.payment_status !== 'paid';

  const applicant = sendMail({
    to: row.email,
    subject: `Your Lebanon Hockey registration - ${tier}`,
    kind: 'registration-applicant',
    html: renderEmail({
      heading: 'We have your registration',
      intro: `Thank you, ${escapeHtml(row.first_name || 'and welcome')}. Your ${escapeHtml(
        tier
      )} registration has been received.`,
      bodyHtml:
        `<p style="margin:0 0 10px;">Membership: <strong>${escapeHtml(tier)}</strong> &mdash; ${escapeHtml(
          amount
        )}</p>` +
        (unpaid
          ? `<p style="margin:0 0 10px;">To complete it, send the fee by Interac e-Transfer or PayPal to
             <strong>support@lebanonhockey.com</strong> and include your name so we can match it to this
             registration.</p>`
          : '<p style="margin:0 0 10px;">Your fee has been received. Nothing else is needed.</p>') +
        '<p style="margin:0;font-size:13px;color:#6a7178;">If anything above is wrong, just reply to this email.</p>',
    }),
  });

  const admin = config.mailAdmin
    ? sendMail({
        to: config.mailAdmin,
        replyTo: row.email,
        subject: `New registration - ${name} (${tier})`,
        kind: 'registration-admin',
        html: renderEmail({
          heading: 'A new registration arrived',
          intro: `<strong>${escapeHtml(name)}</strong> registered as <strong>${escapeHtml(tier)}</strong>.`,
          bodyHtml:
            `<p style="margin:0 0 6px;">Email: ${escapeHtml(row.email)}</p>` +
            (row.phone ? `<p style="margin:0 0 6px;">Phone: ${escapeHtml(row.phone)}</p>` : '') +
            `<p style="margin:0 0 6px;">Fee: ${escapeHtml(amount)} &mdash; ${
              unpaid ? 'not yet paid' : 'paid'
            }</p>` +
            '<p style="margin:10px 0 0;font-size:13px;color:#6a7178;">The eligibility details are in the admin area, not in this email.</p>',
          ctaLabel: 'Open registrations',
          ctaUrl: `${config.appUrl}/admin/registrations.html`,
        }),
      })
    : Promise.resolve(null);

  const [applicantResult, adminResult] = await Promise.all([applicant, admin]);
  return { applicant: applicantResult, admin: adminResult };
}
