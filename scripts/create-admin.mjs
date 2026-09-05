/**
 * Create or promote an admin account.
 *
 *   npm run create-admin -- --email you@example.com
 *
 * The password is prompted for and never passed as an argument, so it does not
 * end up in shell history or the process list.
 */
import { createInterface } from 'node:readline';
import { db } from '../server/db.js';
import { hashPassword, validatePassword } from '../server/lib/password.js';

const KEY_ETX = String.fromCharCode(3); // Ctrl-C
const KEY_EOT = String.fromCharCode(4); // Ctrl-D
const KEY_DEL = String.fromCharCode(127);

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index > -1 && process.argv[index + 1]) return process.argv[index + 1];
  const inline = process.argv.find((a) => a.startsWith(`--${name}=`));
  return inline ? inline.split('=').slice(1).join('=') : null;
}

/**
 * Input handling.
 *
 * Interactive runs use readline. Piped runs (CI, smoke tests) read stdin to EOF
 * once and answer from that queue - asking readline a second question after the
 * pipe has closed would hang forever.
 */
const interactive = process.stdin.isTTY;
let rl = null;
let piped = null;

function prompt() {
  if (!rl) rl = createInterface({ input: process.stdin, output: process.stdout });
  return rl;
}

async function readPipedLines() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').split(/\r?\n/);
}

async function ask(question) {
  if (interactive) {
    return new Promise((resolve) => {
      prompt().question(question, (answer) => resolve(answer.trim()));
    });
  }

  if (piped === null) piped = await readPipedLines();
  const answer = (piped.shift() ?? '').trim();
  process.stdout.write(`${question}${answer ? '*'.repeat(answer.length) : ''}\n`);
  return answer;
}

function done(code = 0) {
  rl?.close();
  process.exit(code);
}

/**
 * Prompt without echoing. Falls back to a visible prompt where raw mode is not
 * available (for example when input is piped).
 */
function askHidden(question) {
  if (!interactive) return ask(question);

  return new Promise((resolve) => {
    process.stdout.write(question);

    const chars = [];
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const finish = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
      process.stdout.write('\n');
      resolve(chars.join(''));
    };

    function onData(char) {
      if (char === '\n' || char === '\r' || char === KEY_EOT) {
        finish();
        return;
      }
      if (char === KEY_ETX) {
        process.stdout.write('\n');
        done(1);
      }
      if (char === KEY_DEL || char === '\b') {
        if (chars.length) {
          chars.pop();
          process.stdout.write('\b \b');
        }
        return;
      }
      chars.push(char);
      process.stdout.write('*');
    }

    process.stdin.on('data', onData);
  });
}

async function readNewPassword() {
  const password = await askHidden('Password (min 8 characters): ');
  const confirm = await askHidden('Confirm password: ');

  if (password !== confirm) {
    console.error('Passwords do not match.');
    done(1);
  }

  const error = validatePassword(password);
  if (error) {
    console.error(error);
    done(1);
  }

  return password;
}

const email = (arg('email') || (await ask('Admin email: '))).trim().toLowerCase();

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('That is not a valid email address.');
  done(1);
}

const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

if (existing) {
  if (existing.role !== 'admin') {
    db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(existing.id);
    console.log(`\n  ${email} promoted to admin (existing password kept).`);
    console.log('  Sign in at /login.html, then open /admin/\n');
    done(0);
  }

  console.log(`${email} is already an admin.`);
  const reset = (await ask('Set a new password for this account? (y/N) ')).toLowerCase();

  if (reset !== 'y' && reset !== 'yes') {
    console.log('No changes made.');
    done(0);
  }

  const password = await readNewPassword();

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    hashPassword(password),
    existing.id
  );
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);

  console.log(`\n  Password updated for ${email}. Other sessions were signed out.\n`);
  done(0);
}

const firstName = arg('first') ?? (await ask('First name (optional): '));
const lastName = arg('last') ?? (await ask('Last name (optional): '));
const password = await readNewPassword();

db.prepare(
  "INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, 'admin')"
).run(email, hashPassword(password), firstName, lastName);

console.log(`\n  Admin account created: ${email}`);
console.log('  Sign in at /login.html, then open /admin/\n');
done(0);
