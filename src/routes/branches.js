const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const store = require('../models/mockStore');
const { supabase } = require('../config/db');

const isUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

const defaultCompanyId = '11111111-2222-3333-4444-555555555555';

const defaultBranches = [
  {
    id: '3eca26c2-6156-4a1c-972b-75d9bf8d2329',
    company_id: defaultCompanyId,
    company_name: 'InfoCare Systems',
    name: 'Infocare Surveillance Systems LLC Dubai',
    short_name: 'INFOCARE DXB',
    code: 'DXB',
    logo_url: '',
    manager: 'Anand',
    country: 'UAE',
    city: 'Dubai',
    currency: 'AED',
    vat_percent: 5.0,
    website: 'https://infocare.ae',
    po_box: 'P.O. Box 12345, Dubai',
    timezone: 'Asia/Dubai',
    phone: '+971 4 345 6789',
    mobile: '+971 50 111 2223',
    email: 'dubai@infocaresystems.com',
    location: 'Deira, Dubai',
    tr_number: '104271902900003',
    address: 'Office 1204, Emirates Tower, Deira, Dubai, UAE',
    is_active: true
  },
  {
    id: '8bfa9d6b-78e1-4419-aec2-670481aa1c75',
    company_id: defaultCompanyId,
    company_name: 'InfoCare Systems',
    name: 'Infocare Surveillance Systems LLC — RAK',
    short_name: 'INFOCARE RAK',
    code: 'RAK',
    logo_url: '',
    manager: 'Manoj',
    country: 'UAE',
    city: 'RAK',
    currency: 'AED',
    vat_percent: 5.0,
    website: 'https://infocare.ae',
    po_box: 'P.O. Box 6789, RAK',
    timezone: 'Asia/Dubai',
    phone: '+971 7 222 0000',
    mobile: '+971 55 333 4444',
    email: 'rak@infocare.ae',
    location: 'Ras Al Khaimah, UAE',
    tr_number: '100293847500004',
    address: 'Al Hamra Industrial Zone, Plot 44, RAK, UAE',
    is_active: true
  },
  {
    id: '58a0094b-70cd-43be-acf9-4b322edb487c',
    company_id: defaultCompanyId,
    company_name: 'InfoCare Systems',
    name: 'Infocare Systems FZC',
    short_name: 'INFOCARE FZC',
    code: 'FZC',
    logo_url: '',
    manager: 'Dileep',
    country: 'UAE',
    city: 'Sharjah',
    currency: 'AED',
    vat_percent: 5.0,
    website: 'https://infocare.ae',
    po_box: 'P.O. Box 4500, Sharjah',
    timezone: 'Asia/Dubai',
    phone: '+971 6 555 0000',
    mobile: '+971 52 888 9999',
    email: 'sharjah@infocare.ae',
    location: 'Sharjah, UAE',
    tr_number: '100293847500005',
    address: 'Al Majaz 3, Corniche Road, Crystal Tower, Suite 501, Sharjah, UAE',
    is_active: true
  },
];

if (!store.branches) store.branches = defaultBranches;

// GET /api/branches - List branches
router.get('/', async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('branches').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        const mapped = data.map(b => ({
          ...b,
          company_id: b.company_id || defaultCompanyId,
          company_name: b.company_name || 'InfoCare Systems',
          short_name: b.short_name || b.shortName || (b.code === 'KER' ? 'Kerala' : (b.code === 'RAK' ? 'RAK' : (b.code === 'IRQ' ? 'Iraq' : (b.code === 'SHJ' ? 'Sharjah' : (b.code === 'DXB' ? 'Dubai' : (b.city || b.code || b.name)))))),
          logo_url: b.logo_url || b.logo || '',
          manager: b.manager || b.branch_manager || b.contact_person || '',
          country: b.country || (b.code === 'KER' ? 'India' : (b.code === 'IRQ' ? 'Iraq' : 'UAE')),
          city: b.city || (b.code === 'KER' ? 'Kochi' : (b.code === 'RAK' ? 'Ras Al Khaimah' : (b.code === 'SHJ' ? 'Sharjah' : (b.code === 'IRQ' ? 'Baghdad' : 'Dubai')))),
          currency: b.currency || (b.code === 'KER' ? 'INR' : (b.code === 'IRQ' ? 'USD' : 'AED')),
          vat_percent: b.vat_percent !== undefined ? b.vat_percent : (b.code === 'KER' ? 18.0 : (b.code === 'IRQ' ? 0.0 : 5.0)),
          website: b.website || b.website_url || '',
          po_box: b.po_box || b.postal_code || '',
          timezone: b.timezone || b.time_zone || (b.code === 'KER' || b.name?.includes('Kerala') ? 'Asia/Kolkata' : (b.code === 'IRQ' ? 'Asia/Baghdad' : 'Asia/Dubai')),
          phone: b.phone || b.telephone || '',
          mobile: b.mobile || b.mobile_number || '',
          email: b.email || b.email_address || '',
          location: b.location || '',
          tr_number: b.tr_number || b.trn || '',
          address: b.address || '',
        }));
        return res.json({ success: true, data: mapped });
      }
    } catch (e) {
      console.error('[Supabase Branches List Error]:', e);
    }
  }
  return res.json({ success: true, data: store.branches });
});

// POST /api/branches - Create branch
router.post('/', async (req, res) => {
  const payload = req.body;
  const branchId = isUUID(payload.id) ? payload.id : randomUUID();

  const tz = payload.timezone || payload.time_zone || 'Asia/Dubai';
  const newBranch = {
    id: branchId,
    company_id: payload.company_id || payload.companyId || defaultCompanyId,
    name: payload.name || 'New Branch',
    short_name: payload.short_name || payload.shortName || payload.code || payload.name || 'Branch',
    code: payload.code || payload.name || 'BR',
    logo_url: payload.logo_url || payload.logo || '',
    manager: payload.manager || payload.branch_manager || payload.contact_person || '',
    country: payload.country || 'UAE',
    city: payload.city || 'Dubai',
    currency: payload.currency || 'AED',
    vat_percent: payload.vat_percent !== undefined ? parseFloat(payload.vat_percent) : 5.0,
    website: payload.website || payload.website_url || '',
    po_box: payload.po_box || payload.postal_code || '',
    timezone: tz,
    time_zone: tz,
    phone: payload.phone || payload.telephone || '',
    mobile: payload.mobile || payload.mobile_number || '',
    email: payload.email || payload.email_address || '',
    location: payload.location || '',
    tr_number: payload.tr_number || payload.trn || '',
    address: payload.address || '',
    is_active: payload.is_active !== false && payload.isActive !== false,
    created_at: new Date().toISOString()
  };

  if (supabase) {
    let sanitized = { ...newBranch };
    let { data, error } = await supabase.from('branches').insert([sanitized]).select().single();

    let maxRetries = 8;
    while (error && maxRetries > 0) {
      maxRetries--;
      if (error.code === 'PGRST204') {
        const match = /Could not find the '(.+?)' column/.exec(error.message || '');
        if (match && match[1]) {
          delete sanitized[match[1]];
        } else break;
      } else break;

      const retry = await supabase.from('branches').insert([sanitized]).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (!error && data) {
      console.log('[Supabase Branch Created]:', data.id);
      return res.status(201).json({ success: true, message: 'Branch created successfully', data: { ...data, timezone: tz } });
    }
  }

  store.branches.unshift(newBranch);
  return res.status(201).json({ success: true, message: 'Branch created successfully', data: newBranch });
});

// PUT /api/branches/:id - Update branch
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const payload = req.body;

  const updateData = {};
  if (payload.company_id !== undefined) updateData.company_id = payload.company_id;
  if (payload.companyId !== undefined) updateData.company_id = payload.companyId;
  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.short_name !== undefined) updateData.short_name = payload.short_name;
  if (payload.shortName !== undefined) updateData.short_name = payload.shortName;
  if (payload.code !== undefined) updateData.code = payload.code;
  if (payload.logo_url !== undefined) updateData.logo_url = payload.logo_url;
  if (payload.logo !== undefined) updateData.logo_url = payload.logo;
  if (payload.manager !== undefined) updateData.manager = payload.manager;
  if (payload.country !== undefined) updateData.country = payload.country;
  if (payload.city !== undefined) updateData.city = payload.city;
  if (payload.currency !== undefined) updateData.currency = payload.currency;
  if (payload.vat_percent !== undefined) updateData.vat_percent = parseFloat(payload.vat_percent);
  if (payload.website !== undefined) updateData.website = payload.website;
  if (payload.po_box !== undefined) updateData.po_box = payload.po_box;
  if (payload.timezone !== undefined) {
    updateData.timezone = payload.timezone;
    updateData.time_zone = payload.timezone;
  } else if (payload.time_zone !== undefined) {
    updateData.timezone = payload.time_zone;
    updateData.time_zone = payload.time_zone;
  }
  if (payload.phone !== undefined) updateData.phone = payload.phone;
  if (payload.mobile !== undefined) updateData.mobile = payload.mobile;
  if (payload.email !== undefined) updateData.email = payload.email;
  if (payload.location !== undefined) updateData.location = payload.location;
  if (payload.tr_number !== undefined) updateData.tr_number = payload.tr_number;
  if (payload.trn !== undefined) updateData.tr_number = payload.trn;
  if (payload.address !== undefined) updateData.address = payload.address;
  if (payload.is_active !== undefined) updateData.is_active = payload.is_active;
  if (payload.isActive !== undefined) updateData.is_active = payload.isActive;

  if (supabase) {
    let sanitized = { ...updateData };
    let { data, error } = await supabase.from('branches').update(sanitized).eq('id', id).select().single();

    let maxRetries = 5;
    while (error && maxRetries > 0) {
      maxRetries--;
      if (error.code === 'PGRST204') {
        const match = /Could not find the '(.+?)' column/.exec(error.message || '');
        if (match && match[1]) {
          delete sanitized[match[1]];
        } else break;
      } else break;

      const retry = await supabase.from('branches').update(sanitized).eq('id', id).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (!error && data) {
      return res.json({ success: true, message: 'Branch updated successfully', data: { ...data, timezone: updateData.timezone || 'Asia/Dubai' } });
    }
  }

  const index = store.branches.findIndex(b => b.id === id);
  if (index !== -1) {
    store.branches[index] = { ...store.branches[index], ...updateData };
    return res.json({ success: true, message: 'Branch updated successfully', data: store.branches[index] });
  }

  return res.status(404).json({ success: false, message: 'Branch not found' });
});

// DELETE /api/branches/:id - Delete branch
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  if (supabase) {
    const { error } = await supabase.from('branches').delete().eq('id', id);
    if (!error) {
      return res.json({ success: true, message: 'Branch deleted successfully' });
    }
  }

  const index = store.branches.findIndex(b => b.id === id);
  if (index !== -1) {
    store.branches.splice(index, 1);
    return res.json({ success: true, message: 'Branch deleted successfully' });
  }

  return res.status(404).json({ success: false, message: 'Branch not found' });
});

module.exports = router;
