const express = require('express');
const router = express.Router();
const store = require('../models/mockStore');
const { supabase } = require('../config/db');
const { isUUID, resolveBranchId, branchNameFor } = require('../utils/normalize');

// Field visits are stored in Supabase as activities (type = 'visit').
// The visit details that activities has no column for are written as
// readable lines in `body` and parsed back when listing.

function visitBody(v) {
  const lines = [];
  if (v.contact_name) lines.push(`Contact: ${v.contact_name}`);
  if (v.mobile) lines.push(`Mobile: ${v.mobile}`);
  if (v.interests && v.interests.length) lines.push(`Interested in: ${v.interests.join(', ')}`);
  if (v.notes) lines.push(`Notes: ${v.notes}`);
  if (v.location_address) lines.push(`Location: ${v.location_address}`);
  if (v.photo_count) lines.push(`Photos: ${v.photo_count}`);
  if (v.has_voice_note) lines.push(`Voice note: ${v.voice_note_duration_seconds || 0}s`);
  if (v.source) lines.push(`Source: ${v.source}`);
  return lines.join('\n');
}

function parseBody(body) {
  const out = {};
  for (const line of String(body || '').split('\n')) {
    const i = line.indexOf(': ');
    if (i > 0) out[line.slice(0, i)] = line.slice(i + 2);
  }
  return out;
}

async function activityToVisit(a) {
  const f = parseBody(a.body);
  return {
    id: a.id,
    company_or_site: a.summary || '',
    contact_name: f['Contact'] || '',
    mobile: f['Mobile'] || '',
    interests: f['Interested in'] ? f['Interested in'].split(', ') : [],
    notes: f['Notes'] || '',
    photo_count: parseInt(f['Photos'], 10) || (a.attachments || []).length,
    has_voice_note: !!f['Voice note'],
    voice_note_duration_seconds: parseInt(f['Voice note'], 10) || 0,
    location_address: f['Location'] || '',
    latitude: a.latitude != null ? Number(a.latitude) : null,
    longitude: a.longitude != null ? Number(a.longitude) : null,
    source: f['Source'] || 'Direct visit',
    branch: await branchNameFor(supabase, a.branch_id),
    branch_id: a.branch_id,
    lead_id: a.lead_id,
    is_synced: true,
    created_at: a.occurred_at || a.created_at,
  };
}

function visitFromPayload(payload, id) {
  return {
    id,
    company_or_site: payload.company_or_site || payload.companyOrSite || 'Site Visit',
    contact_name: payload.contact_name || payload.contactName || '',
    mobile: payload.mobile || payload.phone || '',
    interests: payload.interests || [],
    notes: payload.notes || '',
    photo_count: payload.photo_count || payload.photoCount || 0,
    has_voice_note: payload.has_voice_note || payload.hasVoiceNote || false,
    voice_note_duration_seconds: payload.voice_note_duration_seconds || payload.voiceNoteDurationSeconds || 0,
    location_address: payload.location_address || payload.locationAddress || '',
    latitude: payload.latitude ?? null,
    longitude: payload.longitude ?? null,
    source: payload.source || 'Direct visit',
    branch: payload.branch || 'Dubai',
    lead_id: payload.lead_id,
    is_synced: true,
    created_at: payload.created_at || new Date().toISOString()
  };
}

// activities has CHECK (lead_id OR deal_id), so every visit must hang off a
// lead: use the given lead_id, else the newest lead with the same phone or
// contact + company, else create a direct-visit lead for it.
async function findOrCreateLeadId(v, branchId) {
  if (isUUID(v.lead_id)) return v.lead_id;

  if (v.mobile) {
    const { data } = await supabase.from('leads').select('id').eq('phone', v.mobile)
      .order('created_at', { ascending: false }).limit(1);
    if (data && data.length) return data[0].id;
  }
  if (v.contact_name) {
    let q = supabase.from('leads').select('id').eq('contact_name', v.contact_name);
    if (v.company_or_site) q = q.eq('company_name', v.company_or_site);
    const { data } = await q.order('created_at', { ascending: false }).limit(1);
    if (data && data.length) return data[0].id;
  }

  const requirement = [(v.interests || []).join(', '), v.notes].filter(Boolean).join(' - ') || 'Field visit';
  const { data, error } = await supabase.from('leads').insert([{
    branch_id: branchId,
    branch: v.branch || 'Dubai',
    title: requirement,
    requirement,
    contact_name: v.contact_name || v.company_or_site || 'Field visit',
    company_name: v.company_or_site || '',
    phone: v.mobile || '',
    whatsapp_number: v.mobile || '',
    location: v.location_address || '',
    source: 'direct_visit',
    status: 'contacted',
    stage: 'site_survey',
  }]).select('id').single();
  if (error) {
    console.error('[Supabase Visit Lead Create Error]:', error.code, error.message);
    return null;
  }
  return data.id;
}

async function visitToActivityRow(v, branchIdOrName) {
  const row = {
    branch_id: await resolveBranchId(supabase, branchIdOrName || v.branch),
    type: 'visit',
    summary: v.company_or_site || 'Site Visit',
    body: visitBody(v),
    occurred_at: v.created_at,
  };
  if (v.latitude != null && v.longitude != null) {
    row.latitude = v.latitude;
    row.longitude = v.longitude;
  }
  row.lead_id = await findOrCreateLeadId(v, row.branch_id);
  return row;
}

// GET /api/visits - List all visits
router.get('/', async (req, res) => {
  const { branch, search } = req.query;

  if (supabase) {
    try {
      let query = supabase.from('activities').select('*').eq('type', 'visit').order('occurred_at', { ascending: false });
      if (branch && branch !== 'All') query = query.eq('branch_id', await resolveBranchId(supabase, branch));
      const { data, error } = await query;
      if (error) console.warn('[Supabase Visits Query Notice]:', error.message);
      if (!error && data && (data.length > 0 || process.env.ENABLE_MOCK_FALLBACK !== 'true')) {
        let list = await Promise.all(data.map(activityToVisit));
        if (search) {
          const q = search.toLowerCase();
          list = list.filter(v => [v.company_or_site, v.contact_name, v.location_address].some(x => (x || '').toLowerCase().includes(q)));
        }
        return res.json({ success: true, data: list });
      }
    } catch (e) {
      console.warn('[Supabase Visits Query Notice]:', e.message);
    }
  }

  let list = [...(store.visits || [])];
  if (branch && branch !== 'All') {
    list = list.filter(v => (v.branch || '').toLowerCase() === branch.toLowerCase());
  }
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(v =>
      (v.company_or_site && v.company_or_site.toLowerCase().includes(q)) ||
      (v.contact_name && v.contact_name.toLowerCase().includes(q)) ||
      (v.location_address && v.location_address.toLowerCase().includes(q))
    );
  }
  return res.json({ success: true, data: list });
});

// GET /api/visits/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (supabase && isUUID(id)) {
    const { data } = await supabase.from('activities').select('*').eq('id', id).eq('type', 'visit').single();
    if (data) return res.json({ success: true, data: await activityToVisit(data) });
  }
  const visit = (store.visits || []).find(v => v.id === id);
  if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });
  return res.json({ success: true, data: visit });
});

// POST /api/visits - Log a field visit
router.post('/', async (req, res) => {
  const payload = req.body;
  const newVisit = visitFromPayload(payload, payload.id || 'vst_' + Date.now());

  if (supabase) {
    try {
      const row = await visitToActivityRow(newVisit, payload.branch_id);
      const { data, error } = await supabase.from('activities').insert([row]).select().single();
      if (!error && data) {
        // The Supabase id replaces the app's temporary id.
        return res.status(201).json({
          success: true,
          message: 'Visit logged and synced with CRM database',
          data: await activityToVisit(data)
        });
      }
      console.error('[Supabase Visit Insert Error]:', error && error.code, error && error.message);
      if (process.env.ENABLE_MOCK_FALLBACK !== 'true') {
        return res.status(500).json({ success: false, message: `Failed to save visit: ${error && error.message}` });
      }
    } catch (e) {
      console.error('[Supabase Visit Insert Error]:', e.message);
    }
  }

  if (!store.visits) store.visits = [];
  store.visits.unshift(newVisit);

  return res.status(201).json({
    success: true,
    message: 'Visit logged (local store)',
    data: newVisit
  });
});

// PUT /api/visits/:id - Update visit
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const payload = req.body;

  if (supabase && isUUID(id)) {
    const updated = visitFromPayload({ ...payload, id }, id);
    const row = await visitToActivityRow(updated, payload.branch_id);
    const { data, error } = await supabase.from('activities').update(row).eq('id', id).eq('type', 'visit').select().single();
    if (!error && data) return res.json({ success: true, message: 'Visit updated', data: await activityToVisit(data) });
    if (error && error.code !== 'PGRST116') console.error('[Supabase Visit Update Error]:', error.code, error.message);
  }

  const index = (store.visits || []).findIndex(v => v.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Visit not found' });
  store.visits[index] = { ...store.visits[index], ...payload };
  return res.json({ success: true, message: 'Visit updated', data: store.visits[index] });
});

// DELETE /api/visits/:id - Delete visit
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (supabase && isUUID(id)) {
    const { error } = await supabase.from('activities').delete().eq('id', id).eq('type', 'visit');
    if (error) console.error('[Supabase Visit Delete Error]:', error.code, error.message);
  }
  const index = (store.visits || []).findIndex(v => v.id === id);
  if (index !== -1) {
    store.visits.splice(index, 1);
  }
  return res.json({ success: true, message: 'Visit deleted successfully' });
});

module.exports = router;
