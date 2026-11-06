const crypto = require('crypto');

const WINDOW_MS = 15 * 60 * 1000;

function secret() {
  return process.env.RESET_SECRET || process.env.SUPABASE_KEY || '';
}

// 6-digit code bound to the user and their current password, so it stops
// working as soon as the password changes. Valid for the current and the
// previous 15-minute window (15-30 minutes).
function codeFor(user, windowIndex) {
  const mac = crypto
    .createHmac('sha256', secret())
    .update(`${user.id}:${windowIndex}:${user.password}`)
    .digest('hex');
  return String(parseInt(mac.slice(0, 8), 16) % 1000000).padStart(6, '0');
}

function currentWindow(now = Date.now()) {
  return Math.floor(now / WINDOW_MS);
}

function generateCode(user, now = Date.now()) {
  return codeFor(user, currentWindow(now));
}

function verifyCode(user, code, now = Date.now()) {
  const given = Buffer.from(String(code || '').trim());
  const w = currentWindow(now);
  return [w, w - 1].some((i) => {
    const expected = Buffer.from(codeFor(user, i));
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
}

// In-memory attempt limiter (one Render instance): `max` hits per window per key.
function createLimiter(max, windowMs = WINDOW_MS) {
  const hits = new Map();
  return {
    allow(key, now = Date.now()) {
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      entry.count += 1;
      return entry.count <= max;
    },
    clear(key) {
      hits.delete(key);
    },
  };
}

// Escape LIKE wildcards so ilike(...) behaves as a case-insensitive equals.
function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (c) => `\\${c}`);
}

const MIN_PASSWORD_LENGTH = 8;

module.exports = { generateCode, verifyCode, createLimiter, escapeLike, secret, MIN_PASSWORD_LENGTH };
