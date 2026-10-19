const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const store = require('../models/mockStore');
const { supabase } = require('../config/db');

const isUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

// GET /api/users - List users
router.get('/', async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('users').select('id, username, name, email, role, branch, phone, created_at');
      if (!error && data && data.length > 0) {
        return res.json({ success: true, data });
      }
    } catch (err) {
      console.error('[Supabase Users List Error]:', err);
    }
  }

  return res.json({ success: true, data: store.users || [] });
});

// POST /api/users - Create user
router.post('/', async (req, res) => {
  const payload = req.body;
  const userId = isUUID(payload.id) ? payload.id : randomUUID();

  const newUser = {
    id: userId,
    username: payload.username || payload.email || `user_${Date.now()}`,
    name: payload.name || payload.username || 'New User',
    email: payload.email || `${payload.username || 'user'}@infocare.ae`,
    password: payload.password || 'Info@1234',
    role: payload.role || 'Sales Representative',
    branch: payload.branch || 'Dubai',
    phone: payload.phone || '',
    created_at: new Date().toISOString(),
  };

  if (supabase) {
    let sanitized = { ...newUser };
    let { data, error } = await supabase.from('users').insert([sanitized]).select('id, username, name, email, role, branch, phone, created_at').single();

    let maxRetries = 5;
    while (error && maxRetries > 0) {
      maxRetries--;
      console.warn('[Supabase User Insert Error]:', error.code, error.message);
      if (error.code === 'PGRST204') {
        const match = /Could not find the '(.+?)' column/.exec(error.message || '');
        if (match && match[1]) {
          delete sanitized[match[1]];
        } else break;
      } else break;

      const retry = await supabase.from('users').insert([sanitized]).select('id, username, name, email, role, branch, phone, created_at').single();
      data = retry.data;
      error = retry.error;
    }

    if (!error && data) {
      console.log('[Supabase User Created Successfully]:', data.id);
      return res.status(201).json({ success: true, message: 'User created successfully in database', data });
    }
  }

  if (!store.users) store.users = [];
  store.users.unshift(newUser);
  return res.status(201).json({ success: true, message: 'User created successfully', data: newUser });
});

// PUT /api/users/:id - Update user
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const payload = req.body;

  if (supabase) {
    const { data, error } = await supabase.from('users').update(payload).eq('id', id).select('id, username, name, email, role, branch, phone, created_at').single();
    if (!error && data) return res.json({ success: true, message: 'User updated successfully', data });
  }

  const index = (store.users || []).findIndex(u => u.id === id);
  if (index !== -1) {
    store.users[index] = { ...store.users[index], ...payload };
    return res.json({ success: true, message: 'User updated successfully', data: store.users[index] });
  }
  return res.status(404).json({ success: false, message: 'User not found' });
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  if (supabase) {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (!error) return res.json({ success: true, message: 'User deleted successfully' });
  }

  const index = (store.users || []).findIndex(u => u.id === id);
  if (index !== -1) {
    store.users.splice(index, 1);
    return res.json({ success: true, message: 'User deleted successfully' });
  }
  return res.status(404).json({ success: false, message: 'User not found' });
});

module.exports = router;
