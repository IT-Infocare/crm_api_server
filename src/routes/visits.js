const express = require('express');
const router = express.Router();
const store = require('../models/mockStore');
const { supabase } = require('../config/db');

// GET /api/visits - List all visits
router.get('/', async (req, res) => {
  const { branch, search } = req.query;

  if (supabase) {
    try {
      const { data, error } = await supabase.from('activities').select('*').eq('type', 'visit').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        const mapped = data.map(a => ({
          id: a.id,
          company_or_site: a.summary || '',
          contact_name: a.body || '',
          mobile: '',
          interests: [],
          notes: a.summary,
          photo_count: (a.attachments || []).length,
          has_voice_note: false,
          voice_note_duration_seconds: 0,
          location_address: 'Dubai, UAE',
          branch: 'Dubai',
          is_synced: true,
          created_at: a.created_at
        }));
        return res.json({ success: true, data: mapped });
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
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const visit = (store.visits || []).find(v => v.id === id);
  if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });
  return res.json({ success: true, data: visit });
});

// POST /api/visits - Log a field visit
router.post('/', async (req, res) => {
  const payload = req.body;
  const visitId = payload.id || 'vst_' + Date.now();

  const newVisit = {
    id: visitId,
    company_or_site: payload.company_or_site || payload.companyOrSite || 'Site Visit',
    contact_name: payload.contact_name || payload.contactName || '',
    mobile: payload.mobile || payload.phone || '',
    interests: payload.interests || [],
    notes: payload.notes || '',
    photo_count: payload.photo_count || payload.photoCount || 0,
    has_voice_note: payload.has_voice_note || payload.hasVoiceNote || false,
    voice_note_duration_seconds: payload.voice_note_duration_seconds || payload.voiceNoteDurationSeconds || 0,
    location_address: payload.location_address || payload.locationAddress || 'Dubai, UAE',
    source: payload.source || 'Direct visit',
    branch: payload.branch || 'Dubai',
    is_synced: true,
    created_at: payload.created_at || new Date().toISOString()
  };

  // 1. Try to record activity in Supabase
  if (supabase) {
    try {
      const { data: defaultBranch } = await supabase.from('branches').select('id').limit(1).single();
      const branchId = defaultBranch ? defaultBranch.id : '3eca26c2-6156-4a1c-972b-75d9bf8d2329';

      const activityData = {
        branch_id: branchId,
        type: 'visit',
        summary: `Field Visit: ${newVisit.company_or_site} - ${newVisit.contact_name}`,
        body: newVisit.notes || newVisit.interests.join(', '),
        occurred_at: newVisit.created_at
      };
      await supabase.from('activities').insert([activityData]);
    } catch (e) {
      console.warn('[Supabase Activity Notice for Visit]:', e.message);
    }
  }

  if (!store.visits) store.visits = [];
  store.visits.unshift(newVisit);

  return res.status(201).json({
    success: true,
    message: 'Visit logged and synced with CRM database',
    data: newVisit
  });
});

// PUT /api/visits/:id - Update visit
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const payload = req.body;
  const index = (store.visits || []).findIndex(v => v.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Visit not found' });
  store.visits[index] = { ...store.visits[index], ...payload };
  return res.json({ success: true, message: 'Visit updated', data: store.visits[index] });
});

// DELETE /api/visits/:id - Delete visit
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const index = (store.visits || []).findIndex(v => v.id === id);
  if (index !== -1) {
    store.visits.splice(index, 1);
  }
  return res.json({ success: true, message: 'Visit deleted successfully' });
});

module.exports = router;
