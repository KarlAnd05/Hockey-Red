/**
 * Visitor chat - the two endpoints the widget talks to.
 *
 * Both are anonymous by design: a visitor starts typing without giving a name,
 * and the thread token in their browser is the only identity involved. The
 * optional email is for the case the widget cannot cover - nobody answered while
 * they were on the site.
 */
import { Router } from 'express';
import { config } from '../config.js';
import { rateLimit } from '../middleware/auth.js';
import {
  createThread,
  findThreadByToken,
  addMessage,
  messagesSince,
  setVisitorDetails,
  shouldNotify,
  markNotified,
  markRead,
  serialiseMessage,
} from '../lib/chat.js';
import { sendChatNotification } from '../lib/notifications.js';

export const chatRouter = Router();

/* Anonymous and public, so it needs its own limiter. The existing rateLimit is
   per-process and keyed on IP, which is the right shape for this. */
const chatLimit = rateLimit({ max: 30, windowMs: 10 * 60 * 1000, key: 'chat' });

/* --------------------------------------------------------------------------
   Send a message (creating the thread on first use)
   -------------------------------------------------------------------------- */
chatRouter.post('/chat', chatLimit, (req, res) => {
  const body = String(req.body?.body || '').trim();
  if (!body) return res.status(400).json({ error: 'Type a message first.' });

  let token = req.body?.token || '';
  let thread = findThreadByToken(token);

  if (!thread) {
    const created = createThread();
    token = created.token;
    thread = findThreadByToken(token);
  }

  if (thread.status === 'blocked') {
    /* Say nothing about being blocked - a spammer learns nothing, and a genuine
       visitor caught by mistake still has the contact form and the email address
       in the footer. */
    return res.json({ token, messages: [] });
  }

  setVisitorDetails(thread.id, { name: req.body?.name, email: req.body?.email });

  const message = addMessage(thread.id, 'visitor', body);

  /* Answer first; the email is best effort and must not make the visitor wait on
     an SMTP round trip. sendMail never throws. */
  res.json({ token, messages: message ? [serialiseMessage(message)] : [] });

  if (message && shouldNotify(thread)) {
    markNotified(thread.id);
    sendChatNotification(thread.id).catch(() => {});
  }
});

/* --------------------------------------------------------------------------
   Poll for replies
   -------------------------------------------------------------------------- */
chatRouter.get('/chat', (req, res) => {
  const thread = findThreadByToken(req.query.token);
  if (!thread) return res.json({ messages: [], status: 'new' });

  const messages = messagesSince(thread.id, req.query.since);

  // The visitor has now seen anything the federation sent.
  if (messages.some((m) => m.sender === 'admin')) markRead(thread.id, 'admin');

  res.json({
    messages: messages.map(serialiseMessage),
    status: thread.status,
    hasEmail: Boolean(thread.visitor_email),
  });
});

/* What the widget shows before anyone has typed. Served rather than hardcoded so
   the federation can change the greeting without a deploy. */
chatRouter.get('/chat/config', (req, res) => {
  res.json({
    greeting: 'Ask us anything about programs, camps, membership or the shop.',
    /* Deliberately not a green "online" dot. Nobody is watching this around the
       clock, and a permanently-green light is a small lie to the visitor. */
    availability: 'We usually reply within a day.',
    notifyConfigured: Boolean(config.chatNotifyEmail),
  });
});
