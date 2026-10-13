/**
 * Visitor chat.
 *
 * A thread belongs to a token the visitor's browser holds, not to the lh_sid
 * session. That is deliberate: loginSession() rotates the session token and
 * deletes the old row, and purgeExpiredSessions() drops it at 30 days, so a
 * session-keyed conversation would vanish the moment someone signed in. The
 * token here is a bearer secret - whoever holds it reads that thread - which is
 * the same shape as the guest-order "?session=" trick already used for orders.
 *
 * Only the hash is stored. The raw token lives in the visitor's localStorage.
 */
import { randomBytes, createHash } from 'node:crypto';
import { db } from '../db.js';
import { config } from '../config.js';

const MAX_BODY = 4000;

const hashToken = (token) => createHash('sha256').update(String(token)).digest('hex');

export function createThread() {
  const token = randomBytes(32).toString('hex');
  const info = db
    .prepare("INSERT INTO chat_threads (token_hash, last_message_at) VALUES (?, datetime('now'))")
    .run(hashToken(token));
  return { token, threadId: Number(info.lastInsertRowid) };
}

export function findThreadByToken(token) {
  if (!token) return null;
  return db.prepare('SELECT * FROM chat_threads WHERE token_hash = ?').get(hashToken(token)) || null;
}

export function findThread(id) {
  return db.prepare('SELECT * FROM chat_threads WHERE id = ?').get(Number(id)) || null;
}

/**
 * Append a message. Returns the stored row.
 *
 * The body is stored exactly as typed - escaping belongs at render time, in the
 * page and in the email, so the stored text stays the visitor's own words.
 */
export function addMessage(threadId, sender, body) {
  const text = String(body || '').trim().slice(0, MAX_BODY);
  if (!text) return null;

  const info = db
    .prepare('INSERT INTO chat_messages (thread_id, sender, body) VALUES (?, ?, ?)')
    .run(Number(threadId), sender === 'admin' ? 'admin' : 'visitor', text);

  db.prepare("UPDATE chat_threads SET last_message_at = datetime('now') WHERE id = ?").run(Number(threadId));

  return db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(Number(info.lastInsertRowid));
}

export function messagesSince(threadId, sinceId = 0) {
  return db
    .prepare('SELECT * FROM chat_messages WHERE thread_id = ? AND id > ? ORDER BY id')
    .all(Number(threadId), Number(sinceId) || 0);
}

export function setVisitorDetails(threadId, { name, email }) {
  db.prepare(
    `UPDATE chat_threads
        SET visitor_name = COALESCE(NULLIF(?, ''), visitor_name),
            visitor_email = COALESCE(NULLIF(?, ''), visitor_email)
      WHERE id = ?`
  ).run(
    String(name || '').trim().slice(0, 120),
    String(email || '').trim().toLowerCase().slice(0, 200),
    Number(threadId)
  );
}

export function setThreadStatus(threadId, status) {
  const allowed = ['open', 'closed', 'blocked'];
  if (!allowed.includes(status)) return null;
  db.prepare('UPDATE chat_threads SET status = ? WHERE id = ?').run(status, Number(threadId));
  return findThread(threadId);
}

/**
 * Should this message trigger an email?
 *
 * One notification per message is what was asked for, but a visitor typing four
 * short lines in a row is one arrival, not four. A short window collapses those
 * into a single alert while still telling the federation promptly. Set
 * CHAT_NOTIFY_COALESCE_MINUTES to 0 for literally one email per message.
 */
export function shouldNotify(thread) {
  const minutes = Number(config.chatNotifyCoalesceMinutes) || 0;
  if (minutes <= 0) return true;
  if (!thread.notified_at) return true;

  const last = new Date(`${thread.notified_at}Z`).getTime();
  return Number.isNaN(last) || Date.now() - last > minutes * 60 * 1000;
}

export function markNotified(threadId) {
  db.prepare("UPDATE chat_threads SET notified_at = datetime('now') WHERE id = ?").run(Number(threadId));
}

export function markRead(threadId, sender) {
  db.prepare(
    "UPDATE chat_messages SET read_at = datetime('now') WHERE thread_id = ? AND sender = ? AND read_at IS NULL"
  ).run(Number(threadId), sender);
}

export function serialiseMessage(message) {
  return {
    id: message.id,
    sender: message.sender,
    body: message.body,
    createdAt: message.created_at,
  };
}

/** Thread list for the admin screen, newest activity first. */
export function listThreads() {
  return db
    .prepare(
      `SELECT t.*,
              (SELECT COUNT(*) FROM chat_messages m
                WHERE m.thread_id = t.id AND m.sender = 'visitor' AND m.read_at IS NULL) AS unread,
              (SELECT COUNT(*) FROM chat_messages m WHERE m.thread_id = t.id) AS total,
              (SELECT body FROM chat_messages m WHERE m.thread_id = t.id ORDER BY m.id DESC LIMIT 1) AS preview
         FROM chat_threads t
        ORDER BY (t.last_message_at IS NULL), t.last_message_at DESC
        LIMIT 200`
    )
    .all()
    .map((t) => ({
      id: t.id,
      name: t.visitor_name,
      email: t.visitor_email,
      status: t.status,
      unread: t.unread,
      total: t.total,
      preview: t.preview || '',
      lastMessageAt: t.last_message_at,
      createdAt: t.created_at,
    }));
}
