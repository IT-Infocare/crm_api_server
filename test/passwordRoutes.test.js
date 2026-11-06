const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const express = require('express');

// In-memory stand-in for the Supabase `users` table.
const users = [
  { id: 'u1', username: 'Admin', name: 'Admin', email: 'admin@infocare.ae', password: 'Info@1234' },
  { id: 'u2', username: 'sam', name: 'Sam', email: 'sam@infocare.ae', password: 'old-password' },
];

function table() {
  const state = { filter: null, patch: null, selectAfterUpdate: false };
  const builder = {
    select(cols) {
      if (state.patch) state.selectAfterUpdate = true;
      return builder;
    },
    ilike(col, val) {
      const needle = val.replace(/\\(.)/g, '$1').toLowerCase();
      state.filter = (u) => String(u[col]).toLowerCase() === needle;
      return builder;
    },
    eq(col, val) {
      state.filter = (u) => u[col] === val;
      return builder;
    },
    limit() {
      return builder;
    },
    update(patch) {
      state.patch = patch;
      return builder;
    },
    then(resolve) {
      const rows = users.filter(state.filter || (() => true));
      if (state.patch) rows.forEach((u) => Object.assign(u, state.patch));
      resolve({ data: rows.map((u) => ({ ...u })), error: null });
    },
  };
  return builder;
}

const dbPath = require.resolve(path.join('..', 'src', 'config', 'db'));
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { supabase: { from: table }, hasSupabase: () => true } };
process.env.RESET_SECRET = 'test-secret';
delete process.env.SMTP_HOST;

const logs = [];
const origLog = console.log;
console.log = (...a) => { logs.push(a.join(' ')); };

const authRoutes = require('../src/routes/auth');
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

let server;
let base;
test.before(async () => {
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}/api/auth`;
});
test.after(() => { console.log = origLog; server.close(); });

const post = async (p, body) => {
  const res = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};

test('change-password rejects a wrong current password and keeps the old one', async () => {
  const r = await post('/change-password', { username: 'sam', current_password: 'nope', new_password: 'new-password-1' });
  assert.strictEqual(r.status, 401);
  assert.strictEqual(users[1].password, 'old-password');
});

test('change-password does not accept the shared default password as "current"', async () => {
  const r = await post('/change-password', { username: 'sam', current_password: 'Info@1234', new_password: 'new-password-1' });
  assert.strictEqual(r.status, 401);
});

test('change-password enforces length and difference', async () => {
  assert.strictEqual((await post('/change-password', { username: 'sam', current_password: 'old-password', new_password: 'short' })).status, 400);
  assert.strictEqual((await post('/change-password', { username: 'sam', current_password: 'old-password', new_password: 'old-password' })).status, 400);
});

test('change-password succeeds and login-style lookup is case-insensitive', async () => {
  const r = await post('/change-password', { username: 'SAM', current_password: 'old-password', new_password: 'new-password-1' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(users[1].password, 'new-password-1');
});

test('forgot-password logs a code for the admin when email is not configured, and answers the same for unknown users', async () => {
  const known = await post('/forgot-password', { username: 'sam' });
  const unknown = await post('/forgot-password', { username: 'ghost' });
  assert.deepStrictEqual(known.body, unknown.body);
  assert.strictEqual(known.body.data.delivery, 'admin');
  assert.ok(logs.some((l) => l.includes('[Password reset] code for "sam"')));
  assert.ok(!JSON.stringify(known.body).match(/\d{6}/));
});

test('reset-password needs the right code, then works once', async () => {
  const code = logs.filter((l) => l.includes('code for "sam"')).pop().match(/: (\d{6})/)[1];
  assert.strictEqual((await post('/reset-password', { username: 'sam', code: '000000' === code ? '111111' : '000000', new_password: 'reset-pass-99' })).status, 400);
  const ok = await post('/reset-password', { username: 'sam', code, new_password: 'reset-pass-99' });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(users[1].password, 'reset-pass-99');
  // The password changed, so the same code is now dead.
  assert.strictEqual((await post('/reset-password', { username: 'sam', code, new_password: 'another-pass-1' })).status, 400);
});

test('reset-password locks out after repeated wrong codes', async () => {
  let last;
  for (let i = 0; i < 7; i++) last = await post('/reset-password', { username: 'Admin', code: '123456', new_password: 'whatever-123' });
  assert.strictEqual(last.status, 429);
  assert.strictEqual(users[0].password, 'Info@1234');
});
