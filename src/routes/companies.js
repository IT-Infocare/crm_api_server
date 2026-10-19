const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const store = require('../models/mockStore');
const { supabase } = require('../config/db');

const isUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

const defaultCompanies = [
  {
    id: '11111111-2222-3333-4444-555555555555',
    name: 'InfoCare Systems',
    code: 'INFOCARE',
    trade_licence_no: 'CN-1029384',
    industry: 'IT, Security & Surveillance Systems',
    country: 'UAE',
    emirate: 'Dubai',
    city: 'Dubai',
    address: 'Business Bay, Tower B, Office 1204, Dubai, UAE',
    website: 'https://infocaresystems.com',
    phone: '+971 4 321 0000',
    email: 'info@infocaresystems.com',
    tax_number: '100293847500001',
    notes: 'Parent holding company for Middle East and global branch operations.',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    branch_count: 3
  }
];

if (!store.companies) store.companies = defaultCompanies;

// GET /api/companies - List parent companies
router.get('/', async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        // Fetch branch counts
        let branchCounts = {};
        try {
          const { data: bData } = await supabase.from('branches').select('id, company_id');
          if (bData) {
            bData.forEach(b => {
              if (b.company_id) {
                branchCounts[b.company_id] = (branchCounts[b.company_id] || 0) + 1;
              }
            });
          }
        } catch (_) {}

        const mapped = data.map(c => ({
          ...c,
          code: c.code || '',
          trade_licence_no: c.trade_licence_no || '',
          industry: c.industry || 'IT & Solutions',
          country: c.country || 'UAE',
          emirate: c.emirate || 'Dubai',
          city: c.city || 'Dubai',
          address: c.address || '',
          website: c.website || '',
          phone: c.phone || '',
          email: c.email || '',
          tax_number: c.tax_number || c.vat_number || '',
          notes: c.notes || '',
          is_active: c.is_active !== false,
          branch_count: branchCounts[c.id] !== undefined ? branchCounts[c.id] : 0
        }));

        return res.json({ success: true, data: mapped });
      }
    } catch (e) {
      console.error('[Supabase Companies List Error]:', e);
    }
  }

  // Fallback to store
  const branchCounts = {};
  if (store.branches) {
    store.branches.forEach(b => {
      const cId = b.company_id || '11111111-2222-3333-4444-555555555555';
      branchCounts[cId] = (branchCounts[cId] || 0) + 1;
    });
  }

  const enriched = store.companies.map(c => ({
    ...c,
    branch_count: branchCounts[c.id] || c.branch_count || 0
  }));

  return res.json({ success: true, data: enriched });
});

// GET /api/companies/:id - Single company
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  if (supabase) {
    try {
      const { data, error } = await supabase.from('companies').select('*').eq('id', id).single();
      if (!error && data) {
        return res.json({ success: true, data });
      }
    } catch (e) {
      console.error('[Supabase Company Detail Error]:', e);
    }
  }

  const c = store.companies.find(comp => comp.id === id);
  if (c) {
    return res.json({ success: true, data: c });
  }

  return res.status(404).json({ success: false, message: 'Company not found' });
});

// POST /api/companies - Create company
router.post('/', async (req, res) => {
  const payload = req.body;
  const companyId = isUUID(payload.id) ? payload.id : randomUUID();

  const newCompany = {
    id: companyId,
    name: payload.name || 'New Company',
    code: payload.code || (payload.name ? payload.name.toUpperCase().replace(/\s+/g, '_') : 'COMPANY'),
    trade_licence_no: payload.trade_licence_no || payload.tradeLicenceNo || '',
    industry: payload.industry || 'IT & Surveillance Solutions',
    country: payload.country || 'UAE',
    emirate: payload.emirate || 'Dubai',
    city: payload.city || 'Dubai',
    address: payload.address || '',
    website: payload.website || '',
    phone: payload.phone || '',
    email: payload.email || '',
    tax_number: payload.tax_number || payload.trn || payload.vat_number || '',
    notes: payload.notes || '',
    is_active: payload.is_active !== false && payload.isActive !== false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (supabase) {
    let sanitized = { ...newCompany };
    let { data, error } = await supabase.from('companies').insert([sanitized]).select().single();

    let maxRetries = 8;
    while (error && maxRetries > 0) {
      maxRetries--;
      if (error.code === 'PGRST204') {
        const match = /Could not find the '(.+?)' column/.exec(error.message || '');
        if (match && match[1]) {
          delete sanitized[match[1]];
        } else break;
      } else break;

      const retry = await supabase.from('companies').insert([sanitized]).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (!error && data) {
      console.log('[Supabase Company Created]:', data.id);
      return res.status(201).json({ success: true, message: 'Company created successfully', data });
    }
  }

  store.companies.unshift(newCompany);
  return res.status(201).json({ success: true, message: 'Company created successfully', data: newCompany });
});

// PUT /api/companies/:id - Update company
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const payload = req.body;

  const updateData = { updated_at: new Date().toISOString() };
  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.code !== undefined) updateData.code = payload.code;
  if (payload.trade_licence_no !== undefined) updateData.trade_licence_no = payload.trade_licence_no;
  if (payload.tradeLicenceNo !== undefined) updateData.trade_licence_no = payload.tradeLicenceNo;
  if (payload.industry !== undefined) updateData.industry = payload.industry;
  if (payload.country !== undefined) updateData.country = payload.country;
  if (payload.emirate !== undefined) updateData.emirate = payload.emirate;
  if (payload.city !== undefined) updateData.city = payload.city;
  if (payload.address !== undefined) updateData.address = payload.address;
  if (payload.website !== undefined) updateData.website = payload.website;
  if (payload.phone !== undefined) updateData.phone = payload.phone;
  if (payload.email !== undefined) updateData.email = payload.email;
  if (payload.tax_number !== undefined) updateData.tax_number = payload.tax_number;
  if (payload.trn !== undefined) updateData.tax_number = payload.trn;
  if (payload.notes !== undefined) updateData.notes = payload.notes;
  if (payload.is_active !== undefined) updateData.is_active = payload.is_active;

  if (supabase) {
    let sanitized = { ...updateData };
    let { data, error } = await supabase.from('companies').update(sanitized).eq('id', id).select().single();

    let maxRetries = 5;
    while (error && maxRetries > 0) {
      maxRetries--;
      if (error.code === 'PGRST204') {
        const match = /Could not find the '(.+?)' column/.exec(error.message || '');
        if (match && match[1]) {
          delete sanitized[match[1]];
        } else break;
      } else break;

      const retry = await supabase.from('companies').update(sanitized).eq('id', id).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (!error && data) {
      return res.json({ success: true, message: 'Company updated successfully', data });
    }
  }

  const idx = store.companies.findIndex(c => c.id === id);
  if (idx !== -1) {
    store.companies[idx] = { ...store.companies[idx], ...updateData };
    return res.json({ success: true, message: 'Company updated successfully', data: store.companies[idx] });
  }

  return res.status(404).json({ success: false, message: 'Company not found' });
});

// DELETE /api/companies/:id - Delete company
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  if (supabase) {
    const { error } = await supabase.from('companies').delete().eq('id', id);
    if (!error) {
      return res.json({ success: true, message: 'Company deleted successfully' });
    }
  }

  const idx = store.companies.findIndex(c => c.id === id);
  if (idx !== -1) {
    store.companies.splice(idx, 1);
    return res.json({ success: true, message: 'Company deleted successfully' });
  }

  return res.status(404).json({ success: false, message: 'Company not found' });
});

module.exports = router;
