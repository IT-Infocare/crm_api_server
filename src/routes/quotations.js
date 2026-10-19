const express = require('express');
const router = express.Router();
const store = require('../models/mockStore');
const { supabase } = require('../config/db');

// GET /api/quotations - List quotations
router.get('/', async (req, res) => {
  const { search, status } = req.query;
  if (supabase) {
    try {
      let query = supabase.from('quotations').select('*, quotation_items(*)');
      if (search) query = query.or(`quotation_number.ilike.%${search}%,customer_name.ilike.%${search}%`);
      if (status && status !== 'All') query = query.eq('status', status);
      const { data, error } = await query;
      if (!error && data) return res.json({ success: true, data });
    } catch (e) {
      console.error('Supabase quotation query error:', e);
    }
  }

  var list = [...store.quotations];
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(qItem =>
      qItem.quotation_number.toLowerCase().includes(q) ||
      (qItem.customer_name && qItem.customer_name.toLowerCase().includes(q))
    );
  }
  if (status && status !== 'All') {
    list = list.filter(qItem => qItem.status === status);
  }
  return res.json({ success: true, data: list });
});

// GET /api/quotations/:id - Quotation details
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const q = store.quotations.find(item => item.id === id);
  if (!q) return res.status(404).json({ success: false, message: 'Quotation not found' });
  return res.json({ success: true, data: q });
});

// POST /api/quotations - Create quotation
router.post('/', (req, res) => {
  const payload = req.body;
  const newQuotation = {
    id: `qt_${Date.now()}`,
    quotation_number: payload.quotation_number || `QT-2026-${Math.floor(100 + Math.random() * 900)}`,
    version: 1,
    status: payload.status || 'draft',
    valid_until: payload.valid_until || new Date(Date.now() + 1296000000).toISOString(),
    customer_id: payload.customer_id,
    customer_name: payload.customer_name || 'Valued Customer',
    lead_id: payload.lead_id,
    prepared_by: payload.prepared_by || 'Sarah Connor',
    terms: payload.terms || '50% Advance, 50% on completion.',
    subtotal: payload.subtotal || 0,
    vat_amount: payload.vat_amount || 0,
    total_amount: payload.total_amount || 0,
    items: payload.items || [],
    created_at: new Date().toISOString()
  };

  store.quotations.unshift(newQuotation);
  return res.status(201).json({ success: true, message: 'Quotation created successfully', data: newQuotation });
});

// PUT /api/quotations/:id - Update quotation
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const index = store.quotations.findIndex(q => q.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Quotation not found' });
  store.quotations[index] = { ...store.quotations[index], ...req.body };
  return res.json({ success: true, message: 'Quotation updated', data: store.quotations[index] });
});

// DELETE /api/quotations/:id - Delete quotation
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const index = store.quotations.findIndex(q => q.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Quotation not found' });
  store.quotations.splice(index, 1);
  return res.json({ success: true, message: 'Quotation deleted' });
});

// POST /api/quotations/:id/submit-approval
router.post('/:id/submit-approval', (req, res) => {
  const { id } = req.params;
  const q = store.quotations.find(item => item.id === id);
  if (!q) return res.status(404).json({ success: false, message: 'Quotation not found' });
  q.status = 'pending_approval';
  return res.json({ success: true, message: 'Submitted for approval', data: q });
});

// POST /api/quotations/:id/approve
router.post('/:id/approve', (req, res) => {
  const { id } = req.params;
  const q = store.quotations.find(item => item.id === id);
  if (!q) return res.status(404).json({ success: false, message: 'Quotation not found' });
  q.status = 'approved';
  return res.json({ success: true, message: 'Quotation approved', data: q });
});

// POST /api/quotations/:id/send
router.post('/:id/send', (req, res) => {
  const { id } = req.params;
  const q = store.quotations.find(item => item.id === id);
  if (!q) return res.status(404).json({ success: false, message: 'Quotation not found' });
  q.status = 'sent';
  return res.json({ success: true, message: 'Quotation sent to customer', data: q });
});

// POST /api/quotations/:id/regenerate-ai-draft
router.post('/:id/regenerate-ai-draft', (req, res) => {
  const { id } = req.params;
  const q = store.quotations.find(item => item.id === id);
  if (!q) return res.status(404).json({ success: false, message: 'Quotation not found' });
  q.is_ai_draft = true;
  q.terms = 'AI Generated Terms: Payment due within 15 days upon completion.';
  return res.json({ success: true, message: 'AI draft regenerated', data: q });
});

module.exports = router;
