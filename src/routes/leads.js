const express = require('express');
const router = express.Router();
const store = require('../models/mockStore');
const { supabase } = require('../config/db');
const { resolveBranchId, normalizeLeadSource, normalizeLeadStage, normalizeActivityType } = require('../utils/normalize');

// GET /api/leads - List leads with search, filter, pagination
router.get('/', async (req, res) => {
  const { search, branch, owner, source, status, stage, page = 1, limit = 10 } = req.query;

  if (supabase) {
    try {
      let query = supabase.from('leads').select('*', { count: 'exact' });
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
          query = query.or(`branch.eq.${branch},branch.ilike.%${branch}%`);
        }
      }
      if (source && source !== 'All') query = query.eq('source', source);
      if (status && status !== 'All') query = query.eq('status', status);
      if (stage && stage !== 'All') query = query.eq('stage', stage);

      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const from = (pageNum - 1) * limitNum;
      const to = from + limitNum - 1;

      const { data, count, error } = await query.range(from, to).order('created_at', { ascending: false });

      if (!error && data) {
        if (data.length > 0 || process.env.ENABLE_MOCK_FALLBACK !== 'true') {
          return res.json({
            success: true,
            data,
            pagination: {
              page: pageNum,
              limit: limitNum,
              totalItems: count || data.length,
              totalPages: Math.ceil((count || data.length) / limitNum) || 1,
            }
          });
        }
      }
    } catch (err) {
      console.error('Supabase query error:', err);
    }
  }

  // Fallback to local store
  let filtered = [...store.leads];
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(l =>
      l.contact_name.toLowerCase().includes(q) ||
      (l.company_name && l.company_name.toLowerCase().includes(q)) ||
      l.requirement.toLowerCase().includes(q)
    );
  }
  if (branch && branch !== 'All') {
    const bLower = branch.toLowerCase();
    filtered = filtered.filter(l => {
      if (!l.branch) return false;
      const lLower = l.branch.toLowerCase();
      if (lLower === bLower) return true;
      if ((bLower === 'dxb' || bLower === 'dubai') && (lLower === 'dxb' || lLower === 'dubai')) return true;
      if (bLower === 'rak' && (lLower === 'rak' || lLower.includes('rak') || lLower.includes('khaimah'))) return true;
      if ((bLower === 'ker' || bLower === 'kerala') && (lLower === 'ker' || lLower === 'kerala')) return true;
      if ((bLower === 'irq' || bLower === 'iraq') && (lLower === 'irq' || lLower === 'iraq')) return true;
      if ((bLower === 'shj' || bLower === 'sharjah') && (lLower === 'shj' || lLower === 'sharjah')) return true;
      return lLower.includes(bLower) || bLower.includes(lLower);
    });
  }
  if (source && source !== 'All') filtered = filtered.filter(l => l.source === source);
  if (status && status !== 'All') filtered = filtered.filter(l => l.status === status);
  if (stage && stage !== 'All') filtered = filtered.filter(l => l.stage === stage);

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const startIndex = (pageNum - 1) * limitNum;
  const paginated = filtered.slice(startIndex, startIndex + limitNum);

  return res.json({
    success: true,
    data: paginated,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalItems: filtered.length,
      totalPages: Math.ceil(filtered.length / limitNum) || 1,
    }
  });
});

// GET /api/leads/:id - Get lead details
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (supabase) {
    const { data, error } = await supabase.from('leads').select('*').eq('id', id).single();
    if (!error && data) {
      if ((data.latitude == null || data.longitude == null || !data.location) && isUUID(id)) {
        try {
          const { data: act } = await supabase
            .from('activities')
            .select('latitude, longitude, body')
            .eq('lead_id', id)
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .order('occurred_at', { ascending: false })
            .limit(1);
          if (act && act.length > 0) {
            if (data.latitude == null) data.latitude = Number(act[0].latitude);
            if (data.longitude == null) data.longitude = Number(act[0].longitude);
            if (!data.location) {
              const lines = String(act[0].body || '').split('\n');
              for (const line of lines) {
                if (line.startsWith('Location: ')) data.location = line.replace('Location: ', '').trim();
              }
              if (!data.location) data.location = `${Number(act[0].latitude).toFixed(5)}, ${Number(act[0].longitude).toFixed(5)}`;
            }
          }
        } catch (_) {}
      }
      return res.json({ success: true, data });
    }
  }

  const lead = store.leads.find(l => l.id === id);
  if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
  return res.json({ success: true, data: lead });
});

const { randomUUID } = require('crypto');
const isUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

const LEAD_COLUMNS = new Set([
  'id', 'branch_id', 'contact_id', 'company_id', 'campaign_id', 'title', 'requirement', 'product_interest',
  'source', 'source_detail', 'external_ref', 'status', 'owner_id', 'ai_summary', 'ai_category', 'ai_urgency',
  'duplicate_of', 'first_response_at', 'latitude', 'longitude', 'created_at', 'customer_id', 'contact_name',
  'company_name', 'phone', 'email', 'whatsapp_number', 'location', 'campaign', 'captured_by', 'owner_name',
  'branch', 'estimated_value', 'stage', 'ai_next_step', 'ai_draft_reply', 'is_duplicate',
]);

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

// POST /api/leads - Create new lead
router.post('/', async (req, res) => {
  const payload = req.body;

  // Auto-create customer in customers table if create_customer flag is true or customer_id missing
  let customerId = payload.customer_id;
  if (!customerId && (payload.create_customer || payload.company_name || payload.contact_name)) {
    const newCustId = randomUUID();
    const newCust = {
      id: newCustId,
      name: payload.contact_name || payload.name || 'New Customer',
      company_name: payload.company_name || '',
      email: payload.email || '',
      phone: payload.phone || '',
      whatsapp_number: payload.whatsapp_number || payload.phone || '',
      branch: payload.branch || 'Dubai',
      created_at: new Date().toISOString()
    };

    if (supabase) {
      try {
        const { data: custData, error: custErr } = await supabase.from('customers').insert([newCust]).select().single();
        if (!custErr && custData) {
          customerId = custData.id;
        } else if (custErr) {
          console.warn('[Supabase Auto-Customer Insert Warning]:', custErr.code, custErr.message);
        }
      } catch (e) {
        console.warn('Customer insertion notice:', e.message);
      }
    }

    if (!customerId) {
      store.customers.unshift(newCust);
      customerId = newCust.id;
    }
  }

  delete payload.create_customer;
  const leadId = isUUID(payload.id) ? payload.id : randomUUID();
  const leadStage = normalizeLeadStage(payload.stage || 'new');
  const leadStatus = payload.status && payload.status !== 'new' ? payload.status : deriveStatusFromStage(leadStage);
  const leadTitle = payload.title || payload.requirement || payload.contact_name || payload.company_name || 'New Lead Enquiry';

  // Extract and validate device GPS coordinates
  const lat = payload.latitude != null && payload.latitude !== '' ? Number(payload.latitude) : null;
  const lon = payload.longitude != null && payload.longitude !== '' ? Number(payload.longitude) : null;
  const validLat = lat != null && !isNaN(lat) ? lat : null;
  const validLon = lon != null && !isNaN(lon) ? lon : null;

  // The location on the lead should always take the current device location based on GPS, not based on the branch.
  let locationStr = (payload.location || payload.emirate || '').trim();
  const branchName = (payload.branch || '').trim().toLowerCase();

  const isBranchValue = !locationStr ||
    (branchName && (locationStr.toLowerCase() === branchName || locationStr.toLowerCase() === `${branchName}, uae`)) ||
    ['dubai', 'dubai, uae', 'rak', 'ras al khaimah', 'sharjah', 'sharjah, uae', 'dxb', 'fzc', 'abu dhabi'].includes(locationStr.toLowerCase());

  if (validLat != null && validLon != null) {
    if (!locationStr || isBranchValue) {
      locationStr = `${validLat.toFixed(5)}, ${validLon.toFixed(5)}`;
    }
  } else if (isBranchValue) {
    locationStr = payload.location && !isBranchValue ? payload.location : '';
  }

  const newLead = {
    id: leadId,
    title: leadTitle,
    contact_name: payload.contact_name || payload.name || '',
    company_name: payload.company_name || '',
    phone: payload.phone || '',
    email: payload.email || '',
    whatsapp_number: payload.whatsapp_number || payload.phone || '',
    location: locationStr,
    latitude: validLat,
    longitude: validLon,
    requirement: payload.requirement || leadTitle,
    source: normalizeLeadSource(payload.source),
    // Keep the client's original wording when it isn't already an enum value.
    source_detail: payload.source_detail || (payload.source && normalizeLeadSource(payload.source) !== payload.source ? payload.source : ''),
    campaign: payload.campaign || '',
    captured_by: payload.captured_by || '',
    owner_name: payload.owner_name || '',
    branch: payload.branch || 'Dubai',
    estimated_value: parseFloat(payload.estimated_value) || 0,
    product_interest: payload.product_interest || '',
    status: leadStatus,
    stage: leadStage,
    ai_summary: payload.ai_summary || '',
    ai_category: payload.ai_category || '',
    ai_urgency: (payload.ai_urgency || 'low').toLowerCase(),
    ai_next_step: payload.ai_next_step || '',
    ai_draft_reply: payload.ai_draft_reply || '',
    is_duplicate: payload.is_duplicate === true,
    created_at: payload.created_at || new Date().toISOString(),
  };

  if (isUUID(customerId)) newLead.customer_id = customerId;
  if (isUUID(payload.owner_id)) newLead.owner_id = payload.owner_id;
  if (isUUID(payload.branch_id)) newLead.branch_id = payload.branch_id;

  if (supabase) {
    // 1. branch_id is NOT NULL + FK in Supabase: resolve it from the UUID or branch name.
    const validBranchId = await resolveBranchId(supabase, newLead.branch_id || newLead.branch || payload.branch);
    if (validBranchId) newLead.branch_id = validBranchId;

    // 2. Validate owner_id against profiles table (owner_id FK references profiles.id)
    if (newLead.owner_id) {
      const { data: pCheck } = await supabase.from('profiles').select('id').eq('id', newLead.owner_id).single();
      if (!pCheck || !pCheck.id) {
        delete newLead.owner_id;
      }
    }

    // 3. Validate customer_id against customers table
    if (newLead.customer_id) {
      const { data: cCheck } = await supabase.from('customers').select('id').eq('id', newLead.customer_id).single();
      if (!cCheck || !cCheck.id) {
        delete newLead.customer_id;
      }
    }

    let sanitized = { ...newLead };
    if (!sanitized.customer_id) delete sanitized.customer_id;
    if (!sanitized.owner_id) delete sanitized.owner_id;

    if (!sanitized.product_interest || sanitized.product_interest === '') {
      delete sanitized.product_interest;
    } else if (!Array.isArray(sanitized.product_interest)) {
      sanitized.product_interest = [sanitized.product_interest];
    }

    let { data, error } = await supabase.from('leads').insert([sanitized]).select().single();

    let maxRetries = 10;
    while (error && maxRetries > 0) {
      maxRetries--;
      const fullErr = `${error.details || '' } ${error.detail || '' } ${error.message || '' }`;
      console.warn('[Supabase Lead Insert Error]:', error.code, fullErr);

      if (error.code === 'PGRST204') {
        const match = /Could not find the '(.+?)' column/.exec(fullErr);
        if (match && match[1]) {
          delete sanitized[match[1]];
        } else break;
      } else if (error.code === '23503') {
        // Foreign key violation
        const match = /Key \((.+?)\)=\((.+?)\) is not present in table/.exec(fullErr) ||
                      /violates foreign key constraint "leads_(.+?)_fkey"/.exec(fullErr);
        if (match && match[1]) {
          const col = match[1];
          if (col !== 'branch_id') {
            delete sanitized[col];
          }
        } else {
          // Never delete branch_id as it has a NOT NULL constraint
          delete sanitized.owner_id;
          delete sanitized.customer_id;
          delete sanitized.contact_id;
          delete sanitized.company_id;
          delete sanitized.campaign_id;
          delete sanitized.created_by;
        }
      } else if (error.code === '23502') {
        // Not null violation
        const match = /null value in column "(.+?)"/.exec(fullErr);
        if (match && match[1]) {
          const col = match[1];
          if (col === 'branch_id') {
            const { data: bData } = await supabase.from('branches').select('id').limit(1).single();
            if (bData && bData.id) sanitized.branch_id = bData.id;
          } else if (col === 'title') {
            sanitized.title = payload.title || payload.requirement || payload.contact_name || payload.company_name || 'New Lead';
          } else if (col === 'source') {
            sanitized.source = 'website';
          } else if (col === 'status') {
            sanitized.status = 'new';
          }
        } else break;
      } else if (error.code === '22P02') {
        const match = /invalid input syntax for type (.+?): "(.+?)"/.exec(fullErr);
        if (match) {
          const badVal = match[2];
          for (const k of Object.keys(sanitized)) {
            if (sanitized[k] === badVal) delete sanitized[k];
          }
        } else break;
      } else {
        break;
      }

      const retry = await supabase.from('leads').insert([sanitized]).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (!error && data) {
      console.log('[Supabase Lead Inserted Successfully]:', data.id);
      return res.status(201).json({ success: true, message: 'Lead & Customer created successfully in Supabase', data });
    }

    if (error) {
      console.error('[Supabase Lead Final Error]:', error);
      if (process.env.ENABLE_MOCK_FALLBACK !== 'true') {
        return res.status(500).json({
          success: false,
          message: `Failed to save Lead to database: ${error.message || 'Database error'}`,
          error: error.message
        });
      }
    }
  }

  store.leads.unshift(newLead);
  return res.status(201).json({ success: true, message: 'Lead & Customer created successfully', data: newLead });
});

// PUT /api/leads/:id - Update lead details
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const payload = req.body;

  if (payload.stage) payload.stage = normalizeLeadStage(payload.stage);
  if (payload.source) payload.source = normalizeLeadSource(payload.source);
  if (payload.stage && !payload.status) {
    payload.status = deriveStatusFromStage(payload.stage);
  }

  if (payload.latitude !== undefined) {
    const lat = payload.latitude != null && payload.latitude !== '' ? Number(payload.latitude) : null;
    payload.latitude = lat != null && !isNaN(lat) ? lat : null;
  }
  if (payload.longitude !== undefined) {
    const lon = payload.longitude != null && payload.longitude !== '' ? Number(payload.longitude) : null;
    payload.longitude = lon != null && !isNaN(lon) ? lon : null;
  }
  if (payload.latitude != null && payload.longitude != null) {
    const bName = (payload.branch || '').trim().toLowerCase();
    const loc = (payload.location || '').trim().toLowerCase();
    if (!loc || loc === bName || loc === `${bName}, uae` || ['dubai', 'dubai, uae', 'rak', 'sharjah'].includes(loc)) {
      payload.location = `${payload.latitude.toFixed(5)}, ${payload.longitude.toFixed(5)}`;
    }
  }

  if (supabase) {
    // Only send real columns; clients include extras like assigned_ago.
    const update = {};
    for (const [k, v] of Object.entries(payload)) {
      if (LEAD_COLUMNS.has(k) && k !== 'id' && k !== 'created_at') update[k] = v;
    }
    if (update.branch_id || update.branch) {
      update.branch_id = await resolveBranchId(supabase, update.branch_id || update.branch);
    }
    const { data, error } = await supabase.from('leads').update(update).eq('id', id).select().single();
    if (!error && data) return res.json({ success: true, message: 'Lead updated successfully', data });
    if (error && error.code !== 'PGRST116' && error.code !== '22P02') {
      console.error('[Supabase Lead Update Error]:', error.code, error.message);
    }
  }

  const index = store.leads.findIndex(l => l.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Lead not found' });

  store.leads[index] = { ...store.leads[index], ...payload };
  return res.json({ success: true, message: 'Lead updated successfully', data: store.leads[index] });
});

// PATCH /api/leads/:id/status - Update lead status
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (supabase) {
    const { data, error } = await supabase.from('leads').update({ status }).eq('id', id).select().single();
    if (!error && data) return res.json({ success: true, message: 'Lead status updated', data });
  }

  const lead = store.leads.find(l => l.id === id);
  if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

  lead.status = status;
  return res.json({ success: true, message: 'Lead status updated', data: lead });
});

// PATCH /api/leads/:id/owner - Update lead owner
router.patch('/:id/owner', async (req, res) => {
  const { id } = req.params;
  const { owner_id, owner_name } = req.body;

  const lead = store.leads.find(l => l.id === id);
  if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

  lead.owner_id = owner_id || lead.owner_id;
  lead.owner_name = owner_name || lead.owner_name;
  return res.json({ success: true, message: 'Lead owner updated', data: lead });
});

// POST /api/leads/:id/convert - Convert lead to customer/deal
router.post('/:id/convert', (req, res) => {
  const { id } = req.params;
  const lead = store.leads.find(l => l.id === id);
  if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

  lead.status = 'converted';
  const newCustomer = {
    id: `cust_${Date.now()}`,
    name: lead.contact_name,
    company_name: lead.company_name,
    email: lead.email,
    phone: lead.phone,
    branch: lead.branch,
    created_at: new Date().toISOString()
  };
  store.customers.unshift(newCustomer);

  return res.json({ success: true, message: 'Lead converted to Customer', data: { customer: newCustomer, lead } });
});

// GET /api/leads/:id/activities - Get lead activities
router.get('/:id/activities', async (req, res) => {
  const { id } = req.params;
  let list = [];

  if (supabase) {
    try {
      // 1. Fetch custom logged activities
      const { data: actData } = await supabase.from('activities').select('*').eq('lead_id', id);
      if (actData && actData.length > 0) {
        list = actData.map(a => ({ ...a, description: a.description || a.summary }));
      }

      // 2. Fetch lead info for auto-generated timeline events
      const { data: lead } = await supabase.from('leads').select('*').eq('id', id).single();

      // 3. Fetch associated tasks
      let taskQuery = supabase.from('tasks').select('*');
      const { data: taskData } = await taskQuery;
      const leadTasks = (taskData || []).filter(t => t.lead_id === id || (lead && t.related_to_title && t.related_to_title.includes(lead.company_name || lead.contact_name)));

      if (list.length === 0 && lead) {
        list.push({
          id: `act_intake_${lead.id}`,
          lead_id: lead.id,
          type: 'lead_created',
          description: `Lead captured via ${(lead.source || 'website').toUpperCase()} - ${lead.requirement || 'Initial Inquiry'}`,
          created_by: lead.captured_by || 'System',
          created_at: lead.created_at || new Date().toISOString()
        });

        if (lead.stage && lead.stage !== 'new') {
          list.push({
            id: `act_stage_${lead.id}`,
            lead_id: lead.id,
            type: 'stage_changed',
            description: `Lead stage updated to ${lead.stage.replace(/_/g, ' ').toUpperCase()}`,
            created_by: lead.owner_name || 'System',
            created_at: lead.created_at || new Date().toISOString()
          });
        }

        leadTasks.forEach(t => {
          list.push({
            id: `act_task_${t.id}`,
            lead_id: lead.id,
            type: 'task',
            description: `Task scheduled: ${t.title} (Priority: ${t.priority.toUpperCase()}, Status: ${t.status.toUpperCase()})`,
            created_by: t.assigned_user_name || 'System',
            created_at: t.created_at || new Date().toISOString()
          });
        });
      }

      return res.json({ success: true, data: list });
    } catch (e) {
      console.error('[Activities Supabase Error]:', e);
    }
  }

  // Fallback to store
  const leadActivities = (store.activities || []).filter(a => a.lead_id === id);
  const leadObj = (store.leads || []).find(l => l.id === id);

  if (leadActivities.length > 0) {
    return res.json({ success: true, data: leadActivities });
  }

  if (leadObj) {
    const autoList = [
      {
        id: `act_intake_${leadObj.id}`,
        lead_id: leadObj.id,
        type: 'lead_created',
        description: `Lead captured via ${(leadObj.source || 'website').toUpperCase()} - ${leadObj.requirement || 'Initial Inquiry'}`,
        created_by: leadObj.captured_by || 'System',
        created_at: leadObj.created_at || new Date().toISOString()
      }
    ];

    if (leadObj.stage && leadObj.stage !== 'new') {
      autoList.push({
        id: `act_stage_${leadObj.id}`,
        lead_id: leadObj.id,
        type: 'stage_changed',
        description: `Lead stage updated to ${leadObj.stage.replace(/_/g, ' ').toUpperCase()}`,
        created_by: leadObj.owner_name || 'System',
        created_at: leadObj.created_at || new Date().toISOString()
      });
    }

    const tasks = (store.tasks || []).filter(t => t.lead_id === id || (t.related_to_title && t.related_to_title.includes(leadObj.company_name || leadObj.contact_name)));
    tasks.forEach(t => {
      autoList.push({
        id: `act_task_${t.id}`,
        lead_id: leadObj.id,
        type: 'task',
        description: `Task scheduled: ${t.title} (Priority: ${t.priority.toUpperCase()}, Status: ${t.status.toUpperCase()})`,
        created_by: t.assigned_user_name || 'System',
        created_at: t.created_at || new Date().toISOString()
      });
    });

    return res.json({ success: true, data: autoList });
  }

  return res.json({ success: true, data: [] });
});

// POST /api/leads/:id/activities - Add lead activity
router.post('/:id/activities', async (req, res) => {
  const { id } = req.params;
  const { type, description, created_by } = req.body;

  const newActivity = {
    id: `act_${Date.now()}`,
    lead_id: id,
    type: type || 'note',
    description,
    created_by: created_by || 'User',
    created_at: new Date().toISOString()
  };

  if (supabase && isUUID(id)) {
    try {
      // activities needs the lead's branch_id, a valid activity_type and a summary.
      const { data: lead } = await supabase.from('leads').select('branch_id, branch').eq('id', id).single();
      const row = {
        branch_id: await resolveBranchId(supabase, (lead && lead.branch_id) || (lead && lead.branch)),
        lead_id: id,
        type: normalizeActivityType(type),
        summary: description || type || 'Activity',
        body: created_by ? `Logged by ${created_by}` : null,
        occurred_at: newActivity.created_at,
      };
      const { data, error } = await supabase.from('activities').insert([row]).select().single();
      if (!error && data) {
        return res.status(201).json({
          success: true,
          message: 'Activity logged',
          data: { ...data, description: data.summary, created_by: newActivity.created_by }
        });
      }
      if (error) console.error('[Supabase Activity Insert Error]:', error.code, error.message);
    } catch (e) {
      console.error('[Supabase Activity Insert Error]:', e.message);
    }
  }

  store.activities.unshift(newActivity);
  return res.status(201).json({ success: true, message: 'Activity logged', data: newActivity });
});

// PUT /api/leads/:id/activities/:activityId - Update lead activity
router.put('/:id/activities/:activityId', async (req, res) => {
  const { id, activityId } = req.params;
  const { type, description } = req.body;

  if (supabase && isUUID(activityId)) {
    try {
      const updateData = {};
      if (type) updateData.type = normalizeActivityType(type);
      if (description) updateData.summary = description;
      const { data, error } = await supabase
        .from('activities')
        .update(updateData)
        .eq('id', activityId)
        .select()
        .single();
      if (!error && data) {
        return res.json({
          success: true,
          message: 'Activity updated',
          data: { ...data, description: data.summary || data.description }
        });
      }
      if (error) console.error('[Supabase Activity Update Error]:', error.code, error.message);
    } catch (e) {
      console.error('[Supabase Activity Update Error]:', e.message);
    }
  }

  // Fallback to store
  const act = (store.activities || []).find(a => a.id === activityId);
  if (act) {
    if (type) act.type = type;
    if (description) act.description = description;
    return res.json({ success: true, message: 'Activity updated', data: act });
  }

  return res.json({ success: true, message: 'Activity updated', data: { id: activityId, type, description } });
});

// DELETE /api/leads/:id/activities/:activityId - Delete lead activity
router.delete('/:id/activities/:activityId', async (req, res) => {
  const { activityId } = req.params;
  if (supabase && isUUID(activityId)) {
    try {
      await supabase.from('activities').delete().eq('id', activityId);
    } catch (e) {
      console.error('[Supabase Activity Delete Error]:', e.message);
    }
  }

  const index = (store.activities || []).findIndex(a => a.id === activityId);
  if (index !== -1) {
    store.activities.splice(index, 1);
  }
  return res.json({ success: true, message: 'Activity deleted' });
});


// DELETE /api/leads/:id - Delete lead
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (supabase) {
    try {
      await supabase.from('leads').delete().eq('id', id);
    } catch (e) {
      console.warn('[Supabase Lead Delete Warning]:', e.message);
    }
  }

  const index = store.leads.findIndex(l => l.id === id);
  if (index !== -1) {
    store.leads.splice(index, 1);
  }
  return res.json({ success: true, message: 'Lead deleted successfully' });
});

module.exports = router;
