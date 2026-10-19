const express = require('express');
const router = express.Router();
const store = require('../models/mockStore');

const { supabase } = require('../config/db');

// GET /api/deals - List deals
router.get('/', (req, res) => {
  return res.json({ success: true, data: store.deals });
});

// GET /api/pipeline - Get deal pipeline grouped by stages
router.get('/pipeline', async (req, res) => {
  const { branch } = req.query;

  if (supabase) {
    try {
      let query = supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (branch && branch !== 'All') {
        query = query.eq('branch', branch);
      }
      const { data: leadsData, error } = await query;

      let taskQuery = supabase.from('tasks').select('*');
      const { data: taskData } = await taskQuery;
      const tasksList = taskData || [];

      if (!error && leadsData) {
        const deals = leadsData.map(l => {
          // Check if lead has a pending site survey task
          const compName = (l.company_name || '').toLowerCase();
          const contName = (l.contact_name || '').toLowerCase();

          const hasPendingSiteSurvey = tasksList.some(t => {
            const rel = (t.related_to_title || '').toLowerCase();
            const isMatch = t.lead_id === l.id || (compName && rel.includes(compName)) || (contName && rel.includes(contName));
            return isMatch && (t.status || '').toLowerCase() !== 'completed' && (t.title || '').toLowerCase().includes('site survey');
          });

          let currentStage = l.stage || 'new';
          if (hasPendingSiteSurvey) {
            currentStage = 'site_survey';
            supabase.from('leads').update({ stage: 'site_survey' }).eq('id', l.id).then(() => {}).catch(() => {});
          }

          return {
            id: l.id,
            lead_id: l.id,
            customer_name: l.contact_name || l.company_name || 'Client',
            company_name: l.company_name,
            requirement: l.requirement || '',
            estimated_value: parseFloat(l.estimated_value) || 0,
            owner_name: l.owner_name || 'Unassigned',
            source: l.source || 'website',
            stage: currentStage,
            days_in_stage: 1,
            is_stalled: false,
            branch: l.branch || 'Dubai',
            created_at: l.created_at || new Date().toISOString()
          };
        });
        return res.json({ success: true, data: deals });
      }
    } catch (e) {
      console.error('[Pipeline Supabase Error]:', e);
    }
  }

  // Fallback to store
  const tasksList = store.tasks || [];
  const deals = (store.leads || []).map(l => {
    const hasPendingSiteSurvey = tasksList.some(t => 
      (t.lead_id === l.id || (t.related_to_title && t.related_to_title.includes(l.company_name || l.contact_name))) &&
      t.status !== 'completed' &&
      t.title.toLowerCase().includes('site survey')
    );

    let currentStage = l.stage || 'new';
    if (hasPendingSiteSurvey) {
      currentStage = 'site_survey';
      l.stage = 'site_survey';
    }

    return {
      id: l.id,
      lead_id: l.id,
      customer_name: l.contact_name || l.company_name || 'Client',
      company_name: l.company_name,
      requirement: l.requirement || '',
      estimated_value: parseFloat(l.estimated_value) || 0,
      owner_name: l.owner_name || 'Unassigned',
      source: l.source || 'website',
      stage: currentStage,
      days_in_stage: 1,
      is_stalled: false,
      branch: l.branch || 'Dubai',
      created_at: l.created_at || new Date().toISOString()
    };
  });
  return res.json({ success: true, data: deals });
});

// POST /api/deals - Create deal
router.post('/', (req, res) => {
  const payload = req.body;
  const newDeal = {
    id: `deal_${Date.now()}`,
    title: payload.title || 'New Deal',
    value: payload.value || 0,
    stage: payload.stage || 'new',
    customer_name: payload.customer_name || '',
    created_at: new Date().toISOString()
  };
  store.deals.unshift(newDeal);
  return res.status(201).json({ success: true, message: 'Deal created', data: newDeal });
});

// PUT /api/deals/:id - Update deal
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const index = store.deals.findIndex(d => d.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Deal not found' });
  store.deals[index] = { ...store.deals[index], ...req.body };
  return res.json({ success: true, message: 'Deal updated', data: store.deals[index] });
});

function deriveStatusFromStage(stage) {
  if (!stage) return 'new';
  switch (stage.toLowerCase()) {
    case 'new':
      return 'new';
    case 'contacted':
    case 'site_survey':
      return 'contacted';
    case 'quotation_sent':
    case 'negotiation':
      return 'qualified';
    case 'won':
      return 'converted';
    case 'lost':
      return 'disqualified';
    default:
      return 'new';
  }
}

// PATCH /api/pipeline/deals/:id/stage - Update deal stage in pipeline
router.patch('/pipeline/deals/:id/stage', async (req, res) => {
  const { id } = req.params;
  const { stage, lost_reason } = req.body;

  const derivedStatus = deriveStatusFromStage(stage);

  if (supabase) {
    try {
      const updateData = { stage, status: derivedStatus };
      if (lost_reason) updateData.lost_reason = lost_reason;

      const { data, error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        return res.json({ success: true, message: 'Deal stage updated', data });
      }
    } catch (e) {
      console.error('[Update Stage Supabase Error]:', e);
    }
  }

  const deal = (store.leads || []).find(d => d.id === id);
  if (deal) {
    deal.stage = stage;
    deal.status = derivedStatus;
    if (lost_reason) deal.lost_reason = lost_reason;
    return res.json({ success: true, message: 'Deal stage updated', data: deal });
  }

  return res.status(404).json({ success: false, message: 'Deal not found' });
});

module.exports = router;
