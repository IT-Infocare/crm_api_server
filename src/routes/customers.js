const express = require('express');
const router = express.Router();
const store = require('../models/mockStore');
const { supabase } = require('../config/db');

// GET /api/customers - List customers
router.get('/', async (req, res) => {
  const { search, branch } = req.query;

  if (supabase) {
    try {
      let query = supabase.from('customers').select('*');
      if (search) query = query.or(`name.ilike.%${search}%,company_name.ilike.%${search}%`);
      if (branch && branch !== 'All') query = query.eq('branch', branch);
      const { data, error } = await query;
      if (!error && data) {
        if (data.length > 0 || process.env.ENABLE_MOCK_FALLBACK !== 'true') {
          return res.json({ success: true, data });
        }
      }
    } catch (e) {
      console.error('Supabase customer query error:', e);
    }
  }

  var list = [...store.customers];
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(c => c.name.toLowerCase().includes(q) || (c.company_name && c.company_name.toLowerCase().includes(q)));
  }
  if (branch && branch !== 'All') {
    list = list.filter(c => c.branch === branch);
  }
  return res.json({ success: true, data: list });
});

// GET /api/customers/:id - Customer details
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (supabase) {
    const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
    if (!error && data) return res.json({ success: true, data });
  }
  const cust = store.customers.find(c => c.id === id);
  if (!cust) return res.status(404).json({ success: false, message: 'Customer not found' });
  return res.json({ success: true, data: cust });
});

const { randomUUID } = require('crypto');
const isUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

// POST /api/customers - Create customer
router.post('/', async (req, res) => {
  const payload = req.body;
  const custId = isUUID(payload.id) ? payload.id : randomUUID();

  const newCustomer = {
    id: custId,
    name: payload.name || payload.contact_name || 'New Customer',
    company_name: payload.company_name || '',
    email: payload.email || '',
    phone: payload.phone || '',
    whatsapp_number: payload.whatsapp_number || payload.phone || '',
    branch: payload.branch || 'Dubai',
    emirate: payload.emirate || 'Dubai',
    address: payload.address || '',
    total_revenue: parseFloat(payload.total_revenue) || 0,
    total_deals: parseInt(payload.total_deals, 10) || 0,
    created_at: payload.created_at || new Date().toISOString(),
  };

  if (supabase) {
    let sanitized = { ...newCustomer };
    let { data, error } = await supabase.from('customers').insert([sanitized]).select().single();

    let maxRetries = 10;
    while (error && maxRetries > 0) {
      maxRetries--;
      console.warn('[Supabase Customer Insert Notice]:', error.code, error.message);
      if (error.code === 'PGRST204') {
        const match = /Could not find the '(.+?)' column/.exec(error.message || '');
        if (match && match[1]) {
          delete sanitized[match[1]];
        } else break;
      } else break;

      const retry = await supabase.from('customers').insert([sanitized]).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (!error && data) {
      console.log('[Supabase Customer Inserted Successfully]:', data.id);
      return res.status(201).json({ success: true, message: 'Customer created successfully', data });
    }
  }

  store.customers.unshift(newCustomer);
  return res.status(201).json({ success: true, message: 'Customer created successfully', data: newCustomer });
});

// PUT /api/customers/:id - Update customer
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const payload = req.body;

  if (supabase) {
    const { data, error } = await supabase.from('customers').update(payload).eq('id', id).select().single();
    if (!error && data) return res.json({ success: true, message: 'Customer updated successfully', data });
  }

  const index = store.customers.findIndex(c => c.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Customer not found' });
  store.customers[index] = { ...store.customers[index], ...payload };
  return res.json({ success: true, message: 'Customer updated successfully', data: store.customers[index] });
});

// DELETE /api/customers/:id - Delete customer
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  if (supabase) {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (!error) return res.json({ success: true, message: 'Customer deleted successfully' });
  }

  const index = store.customers.findIndex(c => c.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Customer not found' });
  store.customers.splice(index, 1);
  return res.json({ success: true, message: 'Customer deleted successfully' });
});

module.exports = router;
