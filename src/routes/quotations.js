const express = require('express');
const router = express.Router();
const store = require('../models/mockStore');
const { supabase } = require('../config/db');
const { updateRow, sendUpdateFailure } = require('../utils/dbUpdate');
const { isUUID, resolveBranchId } = require('../utils/normalize');

const QUOTE_STATUSES = ['draft', 'pending_approval', 'approved', 'sent', 'accepted', 'rejected', 'expired'];

const { getBranches } = require('../utils/normalize');

// Map a Supabase quotations row (real schema) to the shape the apps expect.
function mapQuotation(row, branchById = {}, lines = []) {
  const branch = branchById[row.branch_id];
  const subtotal = Number(row.subtotal_aed ?? 0);
  return {
    id: row.id,
    quotation_number: row.number || '',
    version: row.version || 1,
    status: row.status,
    valid_until: row.valid_until,
    customer_id: row.contact_id || null,
    customer_name: row.customer_name || (row.deals && row.deals.name) || '',
    lead_id: row.deals ? row.deals.lead_id : null,
    deal_id: row.deal_id,
    prepared_by: (row.creator && row.creator.full_name) || '',
    terms: row.terms,
    subtotal,
    vat_amount: Number(row.vat_aed ?? 0),
    total_amount: Number(row.total_aed ?? 0),
    pdf_url: row.pdf_path || null,
    is_ai_draft: !!row.ai_drafted,
    branch: branch ? (branch.short_name || branch.code || branch.name) : '',
    items: lines.map((l) => ({
      id: l.id,
      quotation_id: l.quotation_id,
      product_id: l.product_id,
      product_name: l.description,
      description: l.description,
      quantity: Number(l.qty),
      unit_price: Number(l.unit_price || 0),
      discount: Number(l.discount_pct || 0),
      line_total: Number(l.line_total || 0),
      sort_order: l.sort_order,
    })),
    created_at: row.created_at,
  };
}

async function branchIdsFor(branchParam) {
  // Accepts one branch or a comma-separated list; returns null for "no filter".
  if (!branchParam || branchParam === 'All') return null;
  const names = String(branchParam).split(',').map((n) => n.trim()).filter(Boolean);
  const ids = [];
  for (const n of names) {
    const all = await getBranches(supabase);
    const lower = n.toLowerCase();
    const hit = all.find((b) => b.id === n || [b.code, b.name, b.city, b.short_name].some((v) => v && v.toLowerCase() === lower));
    if (hit) ids.push(hit.id);
  }
  return ids; // may be empty => matches nothing
}

// GET /api/quotations - List quotations (optionally ?branch=A,B&status=&search=)
router.get('/', async (req, res) => {
  const { search, status, branch } = req.query;
  if (supabase) {
    try {
      const branches = await getBranches(supabase);
      const branchById = Object.fromEntries(branches.map((b) => [b.id, b]));
      let query = supabase.from('quotations').select('*, deals(name, lead_id)').order('created_at', { ascending: false });
      if (status && status !== 'All') query = query.eq('status', status.toLowerCase());
      if (search) query = query.ilike('number', `%${search}%`);
      const ids = await branchIdsFor(branch);
      if (ids) {
        if (ids.length === 0) return res.json({ success: true, data: [] });
        query = query.in('branch_id', ids);
      }
      const { data, error } = await query;
      if (error) {
        console.error('[Supabase quotation query error]:', error.message);
        return res.status(500).json({ success: false, message: 'Failed to load quotations', details: error.message });
      }
      return res.json({ success: true, data: (data || []).map((r) => mapQuotation(r, branchById)) });
    } catch (e) {
      console.error('[Supabase quotation query error]:', e.message);
      return res.status(500).json({ success: false, message: 'Failed to load quotations', details: e.message });
    }
  }

  let list = [...store.quotations];
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(qItem =>
      (qItem.quotation_number && qItem.quotation_number.toLowerCase().includes(q)) ||
      (qItem.customer_name && qItem.customer_name.toLowerCase().includes(q))
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
    if (!isUUID(id)) return res.status(404).json({ success: false, message: 'Quotation not found' });
    try {
      const branches = await getBranches(supabase);
      const branchById = Object.fromEntries(branches.map((b) => [b.id, b]));
      const { data, error } = await supabase.from('quotations').select('*, deals(name, lead_id)').eq('id', id).maybeSingle();
      if (error) return res.status(500).json({ success: false, message: error.message });
      if (!data) return res.status(404).json({ success: false, message: 'Quotation not found' });
      const { data: lines } = await supabase.from('quotation_lines').select('*').eq('quotation_id', id).order('sort_order');
      return res.json({ success: true, data: mapQuotation(data, branchById, lines || []) });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
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
    client_email: payload.client_email || '',
    deal_id: payload.deal_id,
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
    const result = await updateRow(supabase, 'quotations', id, payload);
    if (result.data) return res.json({ success: true, message: 'Quotation updated successfully', data: result.data });
    return sendUpdateFailure(res, 'Quotation', result);
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
router.post('/:id/submit-approval', async (req, res) => {
  const { id } = req.params;
  if (supabase) {
    const result = await updateRow(supabase, 'quotations', id, { status: 'pending_approval' });
    if (result.data) return res.json({ success: true, message: 'Quotation updated', data: result.data });
    return sendUpdateFailure(res, 'Quotation', result);
  }
  const q = store.quotations.find(item => item.id === id);
  if (!q) return res.status(404).json({ success: false, message: 'Quotation not found' });
  q.status = 'pending_approval';
  return res.json({ success: true, message: 'Submitted for approval', data: q });
});

// POST /api/quotations/:id/approve
router.post('/:id/approve', async (req, res) => {
  const { id } = req.params;
  if (supabase) {
    const result = await updateRow(supabase, 'quotations', id, { status: 'approved' });
    if (result.data) return res.json({ success: true, message: 'Quotation updated', data: result.data });
    return sendUpdateFailure(res, 'Quotation', result);
  }
  const q = store.quotations.find(item => item.id === id);
  if (!q) return res.status(404).json({ success: false, message: 'Quotation not found' });
  q.status = 'approved';
  return res.json({ success: true, message: 'Quotation approved', data: q });
});

// POST /api/quotations/:id/send
router.post('/:id/send', async (req, res) => {
  const { id } = req.params;
  if (supabase) {
    const result = await updateRow(supabase, 'quotations', id, { status: 'sent' });
    if (result.data) return res.json({ success: true, message: 'Quotation updated', data: result.data });
    return sendUpdateFailure(res, 'Quotation', result);
  }
  const q = store.quotations.find(item => item.id === id);
  if (!q) return res.status(404).json({ success: false, message: 'Quotation not found' });
  q.status = 'sent';
  return res.json({ success: true, message: 'Quotation sent to customer', data: q });
});

module.exports = router;
