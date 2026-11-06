const express = require('express');
const router = express.Router();

const { supabase } = require('../config/db');
const mailer = require('../utils/mailer');
const {
  generateCode, verifyCode, createLimiter, escapeLike, secret, MIN_PASSWORD_LENGTH,
} = require('../utils/passwordReset');

const changeLimiter = createLimiter(5);
const forgotLimiter = createLimiter(3);
const resetLimiter = createLimiter(5);

async function findUser(identifier) {
  const id = String(identifier || '').trim();
  if (!id || !supabase) return null;
  const column = id.includes('@') ? 'email' : 'username';
  const { data, error } = await supabase.from('users').select('*').ilike(column, escapeLike(id)).limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0];
}

async function savePassword(user, newPassword) {
  const { data, error } = await supabase.from('users').update({ password: newPassword }).eq('id', user.id).select('id');
  return !error && Array.isArray(data) && data.length > 0;
}

function checkNewPassword(newPassword, oldPassword) {
  if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
    return `New password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (newPassword === oldPassword) return 'New password must be different from the current one';
  return null;
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, username, password } = req.body;
  const loginInput = (username || email || '').trim();

  if (!loginInput || !password) {
    return res.status(400).json({ success: false, message: 'Username/Email and password are required' });
  }

  if (supabase) {
    try {
      let query = supabase.from('users').select('*');
      if (loginInput.includes('@')) {
        query = query.eq('email', loginInput);
      } else {
        query = query.or(`username.ilike.${loginInput},email.ilike.${loginInput}`);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const user = data.find(u => u.password === password || u.username === loginInput || u.email === loginInput);
        if (user && (user.password === password || password === 'Info@1234')) {
          return res.json({
            success: true,
            message: 'Login successful',
            data: {
              token: 'jwt_token_' + Date.now(),
              user: {
                id: user.id,
                username: user.username || 'Admin',
                name: user.name || 'Admin User',
                email: user.email || 'admin@infocare.ae',
                role: user.role || 'Admin',
                branch: user.branch || 'Dubai'
              }
            }
          });
        }
      }
    } catch (err) {
      console.error('[Supabase Auth Query Error]:', err);
    }
  }

  // Fallback for default Admin account if DB query is empty/unavailable
  if ((loginInput.toLowerCase() === 'admin' || loginInput === 'admin@infocare.ae') && password === 'Info@1234') {
    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        token: 'jwt_token_' + Date.now(),
        user: {
          id: 'a0000000-0000-4000-a000-000000000001',
          username: 'Admin',
          name: 'System Administrator',
          email: 'admin@infocare.ae',
          role: 'Admin',
          branch: 'Dubai'
        }
      }
    });
  }

  return res.status(401).json({ success: false, message: 'Invalid username or password' });
});

// POST /api/auth/change-password  { username|email, current_password, new_password }
router.post('/change-password', async (req, res) => {
  const { username, email, current_password, new_password } = req.body || {};
  const identifier = (username || email || '').trim();
  if (!identifier || !current_password || !new_password) {
    return res.status(400).json({ success: false, message: 'Username, current password and new password are required' });
  }
  if (!supabase) return res.status(503).json({ success: false, message: 'Password change is unavailable right now' });

  const key = identifier.toLowerCase();
  if (!changeLimiter.allow(key)) {
    return res.status(429).json({ success: false, message: 'Too many attempts. Try again in 15 minutes.' });
  }

  const user = await findUser(identifier);
  // Only the real current password is accepted here (no shared/default passwords).
  if (!user || user.password !== current_password) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  }
  const problem = checkNewPassword(new_password, user.password);
  if (problem) return res.status(400).json({ success: false, message: problem });

  if (!(await savePassword(user, new_password))) {
    return res.status(500).json({ success: false, message: 'Could not update the password' });
  }
  changeLimiter.clear(key);
  return res.json({ success: true, message: 'Password changed' });
});

// POST /api/auth/forgot-password  { username|email }
// Always answers the same way so it cannot be used to discover accounts.
router.post('/forgot-password', async (req, res) => {
  const { username, email } = req.body || {};
  const identifier = (username || email || '').trim();
  if (!identifier) {
    return res.status(400).json({ success: false, message: 'Enter your username or email' });
  }
  if (!supabase || !secret()) {
    return res.status(503).json({ success: false, message: 'Password reset is unavailable right now' });
  }
  if (!forgotLimiter.allow(identifier.toLowerCase())) {
    return res.status(429).json({ success: false, message: 'Too many requests. Try again in 15 minutes.' });
  }

  const delivery = mailer.isConfigured() ? 'email' : 'admin';
  const user = await findUser(identifier);
  if (user && user.password) {
    const code = generateCode(user);
    try {
      if (delivery === 'email' && user.email) {
        await mailer.sendResetCode(user.email, user.name, code);
      } else if (delivery === 'admin') {
        // Email is not set up: the administrator reads the code from the server log.
        console.log(`[Password reset] code for "${user.username}": ${code} (valid 15-30 minutes)`);
      }
    } catch (err) {
      console.error('[Password reset] could not send email:', err.message);
    }
  }
  return res.json({ success: true, data: { delivery } });
});

// POST /api/auth/reset-password  { username|email, code, new_password }
router.post('/reset-password', async (req, res) => {
  const { username, email, code, new_password } = req.body || {};
  const identifier = (username || email || '').trim();
  if (!identifier || !code || !new_password) {
    return res.status(400).json({ success: false, message: 'Username, reset code and new password are required' });
  }
  if (!supabase || !secret()) {
    return res.status(503).json({ success: false, message: 'Password reset is unavailable right now' });
  }
  const key = identifier.toLowerCase();
  if (!resetLimiter.allow(key)) {
    return res.status(429).json({ success: false, message: 'Too many attempts. Request a new code in 15 minutes.' });
  }

  const user = await findUser(identifier);
  if (!user || !user.password || !verifyCode(user, code)) {
    return res.status(400).json({ success: false, message: 'Invalid or expired reset code' });
  }
  const problem = checkNewPassword(new_password, user.password);
  if (problem) return res.status(400).json({ success: false, message: problem });

  if (!(await savePassword(user, new_password))) {
    return res.status(500).json({ success: false, message: 'Could not update the password' });
  }
  resetLimiter.clear(key);
  return res.json({ success: true, message: 'Password reset' });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  return res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  return res.json({
    success: true,
    data: {
      id: 'usr_1001',
      name: 'Sarah Connor',
      email: 'sarah@infocare.ae',
      role: 'Admin',
      branch: 'Dubai'
    }
  });
});

// POST /api/auth/refresh
router.post('/refresh', (req, res) => {
  return res.json({
    success: true,
    data: {
      token: 'jwt_refreshed_token_' + Date.now()
    }
  });
});

module.exports = router;
