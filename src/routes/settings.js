const express = require('express');
const router = express.Router();
const store = require('../models/mockStore');

// GET /api/settings
router.get('/', (req, res) => {
  return res.json({ success: true, data: store.settings });
});

// PUT /api/settings
router.put('/', (req, res) => {
  store.settings = { ...store.settings, ...req.body };
  return res.json({ success: true, message: 'Settings updated', data: store.settings });
});

const { supabase } = require('../config/db');

// GET /api/settings/branches
router.get('/branches', async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('branches').select('*');
      if (!error && data && data.length > 0) {
        const mapped = data.map(b => ({
          ...b,
          short_name: (b.short_name || b.shortName || '').trim() || (b.code === 'RAK' ? 'RAK' : (b.code === 'SHJ' || b.code === 'FZC' ? 'Sharjah' : (b.code === 'DXB' ? 'Dubai' : (b.city || b.code || b.name)))),
        }));
        return res.json({ success: true, data: mapped });
      }
    } catch (e) {}
  }
  return res.json({
    success: true,
    data: store.branches || [
      { id: 'br_01', name: 'Infocare Surveillance Systems LLC Dubai', short_name: 'Dubai', code: 'DXB', is_active: true },
      { id: 'br_02', name: 'Infocare Surveillance Systems LLC — RAK', short_name: 'RAK', code: 'RAK', is_active: true },
      { id: 'br_03', name: 'Infocare Systems FZC', short_name: 'Sharjah', code: 'FZC', is_active: true },
    ]
  });
});

// GET /api/settings/users - List CRM users
router.get('/users', async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('users').select('id, username, name, email, role, branch, phone, created_at');
      if (!error && data && data.length > 0) {
        return res.json({ success: true, data });
      }
    } catch (e) {}
  }
  return res.json({ success: true, data: store.users || [] });
});

module.exports = router;
