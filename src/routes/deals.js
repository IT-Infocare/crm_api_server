const express = require('express');
const router = express.Router();
const store = require('../models/mockStore');
const { supabase } = require('../config/db');
const { isUUID, resolveBranchId, normalizeLeadStage } = require('../utils/normalize');

const DEAL_STAGES = ['site_survey', 'quotation_sent', 'negotiation', 'won', 'lost'];

function deriveStatusFromStage(stage) {
  if (!stage) return 'new';
  switch (stage.toLowerCase()) {
    case 'new':
      return 'new';
    case 'contacted':
    case 'site_survey':
    case 'site survey':
      return 'contacted';
    case 'quotation_sent':
    case 'proposal sent':
    case 'proposal':
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

// GET /api/deals and /api/deals/list
const getDealsHandler = async (req, res) => {
  const { branch, search, stage } = req.query;

  if (supabase) {
    try {
      let query = supabase.from('deals').select('*');
      if (stage && stage !== 'All') query = query.eq('stage', stage);
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return res.json({ success: true, data });
      }
    } catch (e) {
      console.warn('[Supabase Deals Query Notice]:', e.message);
    }
  }

  let list = [...(store.deals || [])];
  if (branch && branch !== 'All') {
    list = list.filter(d => (d.branch || '').toLowerCase() === branch.toLowerCase());
  }
  if (stage && stage !== 'All') {
    list = list.filter(d => (d.stage || '').toLowerCase() === stage.toLowerCase());
  }
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(d => (d.title && d.title.toLowerCase().includes(q)) || (d.company && d.company.toLowerCase().includes(q)) || (d.customer_name && d.customer_name.toLowerCase().includes(q)));
  }

  return res.json({ success: true, data: list });
};

// GET /api/pipeline - Pipeline view
const getPipelineHandler = async (req, res) => {
  const { branch } = req.query;

  if (supabase) {
    try {
      let query = supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (branch && branch !== 'All') {
        const b = branch.toUpperCase().trim();
        if (b === 'DXB' || b === 'DUBAI' || b.includes('DXB') || b.includes('DUBAI')) {
          query = query.in('branch', ['DXB', 'Dubai', 'InfoCare System Dubai', 'Dubai HQ Office', 'Infocare Surveillance Systems LLC — Dubai', 'Infocare Surveillance Systems LLC Dubai', 'INFOCARE DXB']);
        } else if (b === 'RAK' || b === 'RAS AL KHAIMAH' || b.includes('RAK')) {
          query = query.in('branch', ['RAK', 'Ras Al Khaimah', 'Infocare Surveillance Systems LLC — RAK', 'INFOCARE RAK']);
        } else if (b === 'SHJ' || b === 'SHARJAH' || b === 'FZC' || b.includes('SHARJAH') || b.includes('FZC')) {
          query = query.in('branch', ['SHJ', 'Sharjah', 'InfoCare Systems Sharjah', 'FZC', 'Infocare Systems FZC', 'INFOCARE FZC']);
        } else if (b === 'KER' || b === 'KERALA' || b.includes('KERALA')) {
          query = query.in('branch', ['KER', 'Kerala', 'Infocare Back Office — Kerala']);
        } else if (b === 'IRQ' || b === 'IRAQ' || b.includes('IRAQ')) {
          query = query.in('branch', ['IRQ', 'Iraq', 'InfoCare System Iraq']);
        } else {
          query = query.or('branch.eq.' + branch + ',branch.ilike.%' + branch + '%');
        }
      }
      const { data: leadsData, error } = await query;

      let taskQuery = supabase.from('tasks').select('*');
      const { data: taskData } = await taskQuery;
      const tasksList = taskData || [];

      if (!error && leadsData) {
        const deals = leadsData.map(l => {
          const compName = (l.company_name || '').toLowerCase();
          const contName = (l.contact_name || '').toLowerCase();

          const hasPendingSiteSurvey = tasksList.some(t => {
            const rel = (t.related_to_title || '').toLowerCase();
            const isMatch = t.lead_id === l.id || (compName && rel.includes(compName)) || (contName && rel.includes(contName));
            return isMatch && (t.status || '').toLowerCase() !== 'completed' && (t.title || '').toLowerCase().includes('site survey');
          });

          let currentStage = l.stage || 'new';

          return {
            id: l.id,
            lead_id: l.id,
            title: l.requirement ? (l.company_name ? (l.company_name + ' - ' + l.requirement) : l.requirement) : (l.company_name || 'Commercial Deal'),
            customer_name: l.contact_name || l.company_name || 'Client',
            company: l.company_name || '',
            company_name: l.company_name || '',
            requirement: l.requirement || '',
            estimated_value: parseFloat(l.estimated_value) || 0,
            amount: parseFloat(l.estimated_value) || 0,
            probability: 70,
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
      console.warn('[Pipeline Supabase Error]:', e);
    }
  }

  // Fallback to store
  const tasksList = store.tasks || [];
  const deals = (store.leads || []).map(l => {
    const hasPendingSiteSurvey = tasksList.some(t => 
      (t.lead_id === l.id || (t.related_to_title && t.related_to_title.includes(l.company_name || l.contact_name))) &&
      t.status !== 'completed' &&
      (t.title || '').toLowerCase().includes('site survey')
    );

    let currentStage = l.stage || 'new';

    return {
      id: l.id,
      lead_id: l.id,
      title: l.requirement ? (l.company_name ? (l.company_name + ' - ' + l.requirement) : l.requirement) : (l.company_name || 'Commercial Deal'),
      customer_name: l.contact_name || l.company_name || 'Client',
      company: l.company_name || '',
      company_name: l.company_name || '',
      requirement: l.requirement || '',
      estimated_value: parseFloat(l.estimated_value) || 0,
      amount: parseFloat(l.estimated_value) || 0,
      probability: 70,
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
};

router.get('/', (req, res, next) => {
  if (req.baseUrl && req.baseUrl.endsWith('/pipeline')) {
    return getPipelineHandler(req, res);
  }
  return getDealsHandler(req, res);
});
router.get('/pipeline', getPipelineHandler);
router.get('/deals', getDealsHandler);

// GET /api/deals/:id
const getSingleDeal = (req, res) => {
  const { id } = req.params;
  const deal = store.deals.find(d => d.id === id);
  if (!deal) return res.status(404).json({ success: false, message: 'Deal not found' });
  return res.json({ success: true, data: deal });
};
router.get('/:id', getSingleDeal);
router.get('/deals/:id', getSingleDeal);

// POST /api/deals
const createDealHandler = async (req, res) => {
  const payload = req.body;
  const newDeal = {
    id: payload.id || 'deal_' + Date.now(),
    title: payload.title || 'New Deal',
    company: payload.company || payload.company_name || payload.customer_name || '',
    customer_name: payload.customer_name || payload.company || '',
    stage: payload.stage || 'Site Survey',
    amount: parseFloat(payload.amount || payload.value || payload.estimated_value) || 0,
    probability: parseInt(payload.probability, 10) || 60,
    branch: payload.branch || 'Dubai',
    expected_close: payload.expected_close || new Date(Date.now() + 14 * 86400000).toISOString(),
    created_at: payload.created_at || new Date().toISOString()
  };

  if (supabase) {
    try {
      const stage = normalizeLeadStage(newDeal.stage);
      const sanitized = {
        branch_id: await resolveBranchId(supabase, payload.branch_id || newDeal.branch),
        name: newDeal.company ? `${newDeal.title} - ${newDeal.company}` : newDeal.title,
        value_aed: newDeal.amount,
        stage: DEAL_STAGES.includes(stage) ? stage : 'site_survey',
        probability: Math.max(0, Math.min(100, newDeal.probability)),
        expected_close: String(newDeal.expected_close).slice(0, 10),
      };
      if (isUUID(payload.lead_id)) sanitized.lead_id = payload.lead_id;
      const { error } = await supabase.from('deals').insert([sanitized]);
      if (error) console.error('[Supabase Deals Insert Error]:', error.code, error.message);
    } catch (e) {
      console.warn('[Supabase Deals Insert Warning]:', e.message);
    }
  }

  store.deals.unshift(newDeal);
  return res.status(201).json({ success: true, message: 'Deal created successfully', data: newDeal });
};

router.post('/', createDealHandler);
router.post('/deals', createDealHandler);

// PUT /api/deals/:id
const updateDealHandler = async (req, res) => {
  const { id } = req.params;
  const payload = req.body;

  if (supabase) {
    try {
      await supabase.from('deals').update(payload).eq('id', id);
    } catch (e) {
      console.warn('[Supabase Deals Update Warning]:', e.message);
    }
  }

  const index = store.deals.findIndex(d => d.id === id);
  if (index !== -1) {
    store.deals[index] = { ...store.deals[index], ...payload };
    return res.json({ success: true, message: 'Deal updated successfully', data: store.deals[index] });
  }

  const lead = (store.leads || []).find(l => l.id === id);
  if (lead) {
    if (payload.stage) lead.stage = payload.stage;
    if (payload.amount) lead.estimated_value = payload.amount;
    return res.json({ success: true, message: 'Deal updated successfully', data: lead });
  }

  return res.status(404).json({ success: false, message: 'Deal not found' });
};

router.put('/:id', updateDealHandler);
router.put('/deals/:id', updateDealHandler);

// DELETE /api/deals/:id
const deleteDealHandler = async (req, res) => {
  const { id } = req.params;
  if (supabase) {
    try {
      await supabase.from('deals').delete().eq('id', id);
    } catch (e) {
      console.warn('[Supabase Deals Delete Warning]:', e.message);
    }
  }

  const index = store.deals.findIndex(d => d.id === id);
  if (index !== -1) {
    store.deals.splice(index, 1);
  }
  return res.json({ success: true, message: 'Deal deleted successfully' });
};

router.delete('/:id', deleteDealHandler);
router.delete('/deals/:id', deleteDealHandler);

// PATCH /api/pipeline/deals/:id/stage
const updateStageHandler = async (req, res) => {
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
      console.warn('[Update Stage Supabase Warning]:', e.message);
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
};

router.patch('/pipeline/deals/:id/stage', updateStageHandler);
router.patch('/deals/:id/stage', updateStageHandler);
router.patch('/:id/stage', updateStageHandler);

module.exports = router;
