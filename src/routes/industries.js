const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const store = require('../models/mockStore');
const { supabase } = require('../config/db');

if (!store.industries) store.industries = [];

const clean = (payload) => {
  const out = {};
  if (payload.code !== undefined) out.code = String(payload.code).trim().toUpperCase();
  if (payload.name !== undefined) out.name = String(payload.name).trim();
  if (payload.is_active !== undefined) out.is_active = payload.is_active !== false;
  return out;
};

const fail = (res, error, fallback) => {
  if (error && error.code === '23505') {
    return res.status(409).json({ success: false, message: 'An industry with this code already exists' });
  }
  return res.status(400).json({ success: false, message: (error && error.message) || fallback });
};

// GET /api/industries
router.get('/', async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase.from('industries').select('*').order('name', { ascending: true });
    if (!error) return res.json({ success: true, data: data || [] });
    console.error('[Supabase Industries List Error]:', error.message);
  }
  return res.json({ success: true, data: store.industries });
});

// POST /api/industries
router.post('/', async (req, res) => {
  const row = clean(req.body || {});
  if (!row.code || !row.name) {
    return res.status(400).json({ success: false, message: 'Industry code and name are required' });
  }
  if (row.is_active === undefined) row.is_active = true;

  if (supabase) {
    const { data, error } = await supabase.from('industries').insert([row]).select().single();
    if (error) return fail(res, error, 'Failed to create industry');
    return res.status(201).json({ success: true, message: 'Industry created successfully', data });
  }

  if (store.industries.some((i) => i.code === row.code)) {
    return res.status(409).json({ success: false, message: 'An industry with this code already exists' });
  }
  const created = { id: randomUUID(), ...row, created_at: new Date().toISOString() };
  store.industries.push(created);
  return res.status(201).json({ success: true, message: 'Industry created successfully', data: created });
});

// PUT /api/industries/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const row = clean(req.body || {});
  if (row.code === '' || row.name === '') {
    return res.status(400).json({ success: false, message: 'Industry code and name are required' });
  }

  if (supabase) {
    const { data, error } = await supabase
      .from('industries')
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) return fail(res, error, 'Failed to update industry');
    if (!data) return res.status(404).json({ success: false, message: 'Industry not found' });
    return res.json({ success: true, message: 'Industry updated successfully', data });
  }

  const idx = store.industries.findIndex((i) => i.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Industry not found' });
  store.industries[idx] = { ...store.industries[idx], ...row };
  return res.json({ success: true, message: 'Industry updated successfully', data: store.industries[idx] });
});

// DELETE /api/industries/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  if (supabase) {
    const { error } = await supabase.from('industries').delete().eq('id', id);
    if (error) return fail(res, error, 'Failed to delete industry');
    return res.json({ success: true, message: 'Industry deleted successfully' });
  }

  store.industries = store.industries.filter((i) => i.id !== id);
  return res.json({ success: true, message: 'Industry deleted successfully' });
});

module.exports = router;
