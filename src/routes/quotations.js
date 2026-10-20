const express = require('express');
const router = express.Router();
const store = require('../models/mockStore');
const { supabase } = require('../config/db');
const { isUUID, resolveBranchId } = require('../utils/normalize');

const QUOTE_STATUSES = ['draft', 'pending_approval', 'approved', 'sent', 'accepted', 'rejected', 'expired'];

// GET /api/quotations - List quotations
router.get('/', async (req, res) => {
  const { search, status } = req.query;
  if (supabase) {
    try {
      let query = supabase.from('quotations').select('*');
      if (search) query = query.or(`number.ilike.%${search}%,terms.ilike.%${search}%`);
      if (status && status !== 'All') query = query.eq('status', status.toLowerCase());
      const { data, error } = await query;
      if (!error && data && data.length > 0) return res.json({ success: true, data });
    } catch (e) {
      console.warn('[Supabase quotation query error]:', e.message);
    }
  }

  let list = [...store.quotations];
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(qItem =>
      (qItem.quotation_number && qItem.quotation_number.toLowerCase().includes(q)) ||
      (qItem.customer_name && qItem.customer_name.toLowerCase().includes(q)) ||
      (qItem.company && qItem.company.toLowerCase().includes(q))
    );
  }
  if (status && status !== 'All') {
    list = list.filter(qItem => (qItem.status || '').toLowerCase() === status.toLowerCase());
  }
  return res.json({ success: true, data: list });
});

// GET /api/quotations/:id - Quotation details
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (supabase) {
    try {
      const { data, error } = await supabase.from('quotations').select('*').eq('id', id).single();
      if (!error && data) return res.json({ success: true, data });
    } catch (e) {}
  }
  const q = store.quotations.find(item => item.id === id);
  if (!q) return res.status(404).json({ success: false, message: 'Quotation not found' });
  return res.json({ success: true, data: q });
});

// POST /api/quotations - Create quotation
router.post('/', async (req, res) => {
  const payload = req.body;
  const quoteId = payload.id || 'qt_' + Date.now();
  const newQuotation = {
    id: quoteId,
    quotation_number: payload.quotation_number || payload.quoteNumber || ('QT-2026-' + Math.floor(100 + Math.random() * 900)),
    version: 1,
    status: payload.status || 'Draft',
    valid_until: payload.valid_until || new Date(Date.now() + 1296000000).toISOString(),
    customer_id: payload.customer_id,
    customer_name: payload.customer_name || payload.customerName || 'Valued Customer',
    company: payload.company || payload.company_name || payload.customer_name || '',
    lead_id: payload.lead_id,
    prepared_by: payload.prepared_by || 'Field Sales Executive',
    terms: payload.terms || '50% Advance, 50% on completion. Valid 30 days.',
    subtotal: payload.subtotal || payload.total_amount || payload.totalAmount || 0,
    vat_amount: payload.vat_amount || ((payload.total_amount || payload.totalAmount || 0) * 0.05),
    total_amount: payload.total_amount || payload.totalAmount || 0,
    items_count: payload.items_count || payload.itemsCount || 1,
    items: payload.items || [],
    created_at: payload.created_at || new Date().toISOString()
  };

  if (supabase) {
    try {
      // quotations.deal_id is NOT NULL: a quote can only be saved against an existing deal.
      if (!isUUID(payload.deal_id)) {
        console.warn('[Supabase Quotation Insert Skipped]: no deal_id (deals UUID) supplied; saved locally only');
      } else {
        const status = String(newQuotation.status).toLowerCase().replace(/\s+/g, '_');
        const sanitized = {
          branch_id: await resolveBranchId(supabase, payload.branch_id || payload.branch),
          deal_id: payload.deal_id,
          number: newQuotation.quotation_number,
          status: QUOTE_STATUSES.includes(status) ? status : 'draft',
          total_aed: newQuotation.total_amount,
          terms: newQuotation.terms
        };
        const { error } = await supabase.from('quotations').insert([sanitized]);
        if (error) console.error('[Supabase Quotation Insert Error]:', error.code, error.message);
      }
    } catch (e) {
      console.warn('[Supabase Quotation Insert Notice]:', e.message);
    }
  }

  store.quotations.unshift(newQuotation);
  return res.status(201).json({ success: true, message: 'Quotation created successfully', data: newQuotation });
});

// PUT /api/quotations/:id - Update quotation
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const payload = req.body;

  if (supabase) {
    try {
      await supabase.from('quotations').update(payload).eq('id', id);
    } catch (e) {}
  }

  const index = store.quotations.findIndex(q => q.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Quotation not found' });
  store.quotations[index] = { ...store.quotations[index], ...payload };
  return res.json({ success: true, message: 'Quotation updated successfully', data: store.quotations[index] });
});

// DELETE /api/quotations/:id - Delete quotation
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  if (supabase) {
    try {
      await supabase.from('quotations').delete().eq('id', id);
    } catch (e) {}
  }

  const index = store.quotations.findIndex(q => q.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Quotation not found' });
  store.quotations.splice(index, 1);
  return res.json({ success: true, message: 'Quotation deleted successfully' });
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

module.exports = router;
