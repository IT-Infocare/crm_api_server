const express = require('express');
const router = express.Router();
const store = require('../models/mockStore');
const { supabase } = require('../config/db');

const getBranchFilterValues = (branch) => {
  if (!branch || branch === 'All') return null;
  const b = branch.toUpperCase().trim();
  if (b === 'DXB' || b === 'DUBAI' || b.includes('DXB') || b.includes('DUBAI')) {
    return ['DXB', 'Dubai', 'InfoCare System Dubai', 'Dubai HQ Office', 'Infocare Surveillance Systems LLC — Dubai', 'Infocare Surveillance Systems LLC Dubai', 'INFOCARE DXB'];
  }
  if (b === 'RAK' || b === 'RAS AL KHAIMAH' || b.includes('RAK')) {
    return ['RAK', 'Ras Al Khaimah', 'Infocare Surveillance Systems LLC — RAK', 'INFOCARE RAK'];
  }
  if (b === 'SHJ' || b === 'SHARJAH' || b === 'FZC' || b.includes('SHARJAH') || b.includes('FZC')) {
    return ['SHJ', 'Sharjah', 'InfoCare Systems Sharjah', 'FZC', 'Infocare Systems FZC', 'INFOCARE FZC'];
  }
  if (b === 'KER' || b === 'KERALA' || b.includes('KERALA')) {
    return ['KER', 'Kerala', 'Infocare Back Office — Kerala'];
  }
  if (b === 'IRQ' || b === 'IRAQ' || b.includes('IRAQ')) {
    return ['IRQ', 'Iraq', 'InfoCare System Iraq'];
  }
  return [branch];
};

// GET /api/dashboard/overview or /api/dashboard - Consolidated fast endpoint
const getOverviewHandler = async (req, res) => {
  const { branch } = req.query;
  const branchFilters = getBranchFilterValues(branch);

  if (supabase) {
    try {
      let leadsQuery = supabase.from('leads').select('id, estimated_value, status, stage, source, branch, created_at');
      if (branchFilters) leadsQuery = leadsQuery.in('branch', branchFilters);

      let custQuery = supabase.from('customers').select('id', { count: 'exact', head: true });
      if (branchFilters) custQuery = custQuery.in('branch', branchFilters);

      let quoteQuery = supabase.from('quotations').select('id, status, branch');
      if (branchFilters) quoteQuery = quoteQuery.in('branch', branchFilters);

      let taskQuery = supabase.from('tasks').select('*').neq('status', 'completed');
      if (branchFilters) taskQuery = taskQuery.in('branch', branchFilters);

      const [leadsRes, custRes, quotesRes, tasksRes] = await Promise.all([
        leadsQuery,
        custQuery,
        quoteQuery,
        taskQuery
      ]);

      const leadsList = leadsRes.data || [];
      const custCount = custRes.count || 0;
      const quotesList = quotesRes.data || [];
      const tasksList = tasksRes.data || [];

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // 1. Calculate New Leads This Week & Trend
      const newLeadsThisWeek = leadsList.filter(l => {
        if (!l.created_at) return false;
        const d = new Date(l.created_at);
        return !isNaN(d.getTime()) && d >= oneWeekAgo;
      }).length;

      const newLeadsLastWeek = leadsList.filter(l => {
        if (!l.created_at) return false;
        const d = new Date(l.created_at);
        return !isNaN(d.getTime()) && d >= twoWeeksAgo && d < oneWeekAgo;
      }).length;

      let newLeadsSubtitle = '';
      if (newLeadsThisWeek > 0 && newLeadsLastWeek > 0) {
        const diff = Math.round(((newLeadsThisWeek - newLeadsLastWeek) / newLeadsLastWeek) * 100);
        newLeadsSubtitle = (diff >= 0 ? `+${diff}%` : `${diff}%`) + ' from last week';
      } else if (newLeadsThisWeek > 0) {
        newLeadsSubtitle = `${newLeadsThisWeek} new this week`;
      } else {
        newLeadsSubtitle = `${leadsList.length} total active ${leadsList.length === 1 ? 'lead' : 'leads'}`;
      }

      // 2. Calculate Open Pipeline Value & Open Deals Count
      const openDealsList = leadsList.filter(l => {
        const status = (l.status || '').toLowerCase();
        const stage = (l.stage || '').toLowerCase();
        return status !== 'converted' && status !== 'disqualified' && stage !== 'lost' && stage !== 'closed_lost';
      });

      const openDealsCount = openDealsList.length;
      const openPipelineValue = openDealsList.reduce((acc, l) => {
        return acc + (parseFloat(l.estimated_value) || 0);
      }, 0);

      const openPipelineSubtitle = openDealsCount === 0
        ? 'No open deals'
        : `Across ${openDealsCount} open ${openDealsCount === 1 ? 'deal' : 'deals'}`;

      // 3. Quotes awaiting reply
      const pendingQuotesList = quotesList.filter(q => {
        const s = (q.status || '').toLowerCase();
        return s === 'sent' || s === 'pending_approval' || s === 'draft' || s === 'pending';
      });
      const quotesAwaitingReply = pendingQuotesList.length || leadsList.filter(l => {
        const st = (l.stage || '').toLowerCase();
        return st === 'quotation_sent' || st === 'proposal';
      }).length;

      const quotesSubtitle = quotesAwaitingReply === 0
        ? 'All quotations up to date'
        : `${quotesAwaitingReply} require follow-up`;

      // 4. Follow-ups due
      const followUpsDue = tasksList.length;
      const followUpsSubtitle = followUpsDue === 0
        ? 'All follow-ups completed'
        : `${followUpsDue} action required today`;

      // Leads by source map
      const sourcesMap = {};
      leadsList.forEach(l => {
        const src = (l.source || 'website').toLowerCase();
        sourcesMap[src] = (sourcesMap[src] || 0) + 1;
      });

      return res.json({
        success: true,
        data: {
          summary: {
            new_leads_this_week: newLeadsThisWeek,
            open_pipeline_value: openPipelineValue,
            quotes_awaiting_reply: quotesAwaitingReply,
            follow_ups_due: followUpsDue,
            total_leads: leadsList.length,
            total_customers: custCount,
            open_deals_count: openDealsCount,
            pipeline_value: openPipelineValue,
            total_quotations: quotesList.length,
            currency: 'AED',
            new_leads_subtitle: newLeadsSubtitle,
            open_pipeline_subtitle: openPipelineSubtitle,
            quotes_subtitle: quotesSubtitle,
            follow_ups_subtitle: followUpsSubtitle
          },
          leads_by_source: sourcesMap,
          follow_ups: tasksList,
          briefing: {
            greeting: 'Good Morning',
            ai_summary: followUpsDue > 0
              ? `You have ${followUpsDue} pending task${followUpsDue > 1 ? 's' : ''} and ${openDealsCount} active deal${openDealsCount > 1 ? 's' : ''} in your pipeline.`
              : `All tasks are up to date with ${openDealsCount} active deal${openDealsCount > 1 ? 's' : ''} in pipeline.`,
            urgent_leads_count: Math.min(openDealsCount, 2),
            pending_approvals_count: quotesAwaitingReply
          }
        }
      });
    } catch (err) {
      console.error('[Dashboard Overview Supabase Error]:', err);
    }
  }

  // Fallback to mock store
  const leadsList = store.leads || [];
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const newLeadsThisWeek = leadsList.filter(l => {
    if (!l.created_at) return true;
    const d = new Date(l.created_at);
    return !isNaN(d.getTime()) && d >= oneWeekAgo;
  }).length;

  const openDealsList = leadsList.filter(l => {
    const status = (l.status || '').toLowerCase();
    const stage = (l.stage || '').toLowerCase();
    return status !== 'converted' && status !== 'disqualified' && stage !== 'lost' && stage !== 'closed_lost';
  });
  const openDealsCount = openDealsList.length;

  const openPipelineValue = openDealsList.reduce((acc, l) => {
    return acc + (parseFloat(l.estimated_value) || 0);
  }, 0);

  const sourcesMap = {};
  leadsList.forEach(l => {
    const src = (l.source || 'website').toLowerCase();
    sourcesMap[src] = (sourcesMap[src] || 0) + 1;
  });

  const pendingTasks = (store.tasks || []).filter(t => t.status === 'pending');
  const quotesCount = (store.quotations || []).length;

  return res.json({
    success: true,
    data: {
      summary: {
        new_leads_this_week: newLeadsThisWeek,
        open_pipeline_value: openPipelineValue,
        quotes_awaiting_reply: quotesCount,
        follow_ups_due: pendingTasks.length,
        total_leads: leadsList.length,
        total_customers: (store.customers || []).length,
        open_deals_count: openDealsCount,
        pipeline_value: openPipelineValue,
        total_quotations: quotesCount,
        currency: 'AED',
        new_leads_subtitle: `${newLeadsThisWeek} new this week`,
        open_pipeline_subtitle: openDealsCount === 0 ? 'No open deals' : `Across ${openDealsCount} open ${openDealsCount === 1 ? 'deal' : 'deals'}`,
        quotes_subtitle: quotesCount === 0 ? 'All quotations up to date' : `${quotesCount} require follow-up`,
        follow_ups_subtitle: pendingTasks.length === 0 ? 'All follow-ups completed' : `${pendingTasks.length} action required today`
      },
      leads_by_source: sourcesMap,
      follow_ups: pendingTasks,
      briefing: {
        greeting: 'Good Morning',
        ai_summary: pendingTasks.length > 0
          ? `You have ${pendingTasks.length} pending task${pendingTasks.length > 1 ? 's' : ''} and ${openDealsCount} active deal${openDealsCount > 1 ? 's' : ''} in your pipeline.`
          : `All tasks are up to date with ${openDealsCount} active deal${openDealsCount > 1 ? 's' : ''} in pipeline.`,
        urgent_leads_count: Math.min(openDealsCount, 2),
        pending_approvals_count: quotesCount
      }
    }
  });
};

router.get('/overview', getOverviewHandler);
router.get('/', getOverviewHandler);

// GET /api/dashboard/summary
router.get('/summary', async (req, res) => {
  const { branch } = req.query;
  const branchFilters = getBranchFilterValues(branch);

  if (supabase) {
    try {
      let leadsQuery = supabase.from('leads').select('id, estimated_value, status, stage, branch, created_at');
      if (branchFilters) leadsQuery = leadsQuery.in('branch', branchFilters);

      let custQuery = supabase.from('customers').select('id', { count: 'exact', head: true });
      if (branchFilters) custQuery = custQuery.in('branch', branchFilters);

      let quoteQuery = supabase.from('quotations').select('id, status, branch');
      if (branchFilters) quoteQuery = quoteQuery.in('branch', branchFilters);

      let taskQuery = supabase.from('tasks').select('*').neq('status', 'completed');
      if (branchFilters) taskQuery = taskQuery.in('branch', branchFilters);

      const [leadsRes, custRes, quotesRes, tasksRes] = await Promise.all([
        leadsQuery,
        custQuery,
        quoteQuery,
        taskQuery
      ]);

      const leadsList = leadsRes.data || [];
      const custCount = custRes.count || 0;
      const quotesList = quotesRes.data || [];
      const tasksList = tasksRes.data || [];

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // Calculate New Leads This Week
      const newLeadsThisWeek = leadsList.filter(l => {
        if (!l.created_at) return false;
        const d = new Date(l.created_at);
        return !isNaN(d.getTime()) && d >= oneWeekAgo;
      }).length;

      const newLeadsLastWeek = leadsList.filter(l => {
        if (!l.created_at) return false;
        const d = new Date(l.created_at);
        return !isNaN(d.getTime()) && d >= twoWeeksAgo && d < oneWeekAgo;
      }).length;

      let newLeadsSubtitle = '';
      if (newLeadsThisWeek > 0 && newLeadsLastWeek > 0) {
        const diff = Math.round(((newLeadsThisWeek - newLeadsLastWeek) / newLeadsLastWeek) * 100);
        newLeadsSubtitle = (diff >= 0 ? `+${diff}%` : `${diff}%`) + ' from last week';
      } else if (newLeadsThisWeek > 0) {
        newLeadsSubtitle = `${newLeadsThisWeek} new this week`;
      } else {
        newLeadsSubtitle = `${leadsList.length} total active ${leadsList.length === 1 ? 'lead' : 'leads'}`;
      }

      // Calculate Open Pipeline Value
      const openDealsList = leadsList.filter(l => {
        const status = (l.status || '').toLowerCase();
        const stage = (l.stage || '').toLowerCase();
        return status !== 'converted' && status !== 'disqualified' && stage !== 'lost' && stage !== 'closed_lost';
      });

      const openDealsCount = openDealsList.length;
      const openPipelineValue = openDealsList.reduce((acc, l) => {
        return acc + (parseFloat(l.estimated_value) || 0);
      }, 0);

      const openPipelineSubtitle = openDealsCount === 0
        ? 'No open deals'
        : `Across ${openDealsCount} open ${openDealsCount === 1 ? 'deal' : 'deals'}`;

      // Quotes awaiting reply
      const pendingQuotesList = quotesList.filter(q => {
        const s = (q.status || '').toLowerCase();
        return s === 'sent' || s === 'pending_approval' || s === 'draft' || s === 'pending';
      });
      const quotesAwaitingReply = pendingQuotesList.length || leadsList.filter(l => {
        const st = (l.stage || '').toLowerCase();
        return st === 'quotation_sent' || st === 'proposal';
      }).length;

      const quotesSubtitle = quotesAwaitingReply === 0
        ? 'All quotations up to date'
        : `${quotesAwaitingReply} require follow-up`;

      // Follow ups due
      const followUpsDue = tasksList.length;
      const followUpsSubtitle = followUpsDue === 0
        ? 'All follow-ups completed'
        : `${followUpsDue} action required today`;

      return res.json({
        success: true,
        data: {
          new_leads_this_week: newLeadsThisWeek,
          open_pipeline_value: openPipelineValue,
          quotes_awaiting_reply: quotesAwaitingReply,
          follow_ups_due: followUpsDue,
          total_leads: leadsList.length,
          total_customers: custCount || 0,
          open_deals_count: openDealsCount,
          pipeline_value: openPipelineValue,
          total_quotations: quotesList.length,
          currency: 'AED',
          new_leads_subtitle: newLeadsSubtitle,
          open_pipeline_subtitle: openPipelineSubtitle,
          quotes_subtitle: quotesSubtitle,
          follow_ups_subtitle: followUpsSubtitle
        }
      });
    } catch (err) {
      console.error('[Dashboard Supabase Error]:', err);
    }
  }

  // Fallback to store
  const leadsList = store.leads || [];
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const newLeadsThisWeek = leadsList.filter(l => {
    if (!l.created_at) return true;
    const d = new Date(l.created_at);
    return !isNaN(d.getTime()) && d >= oneWeekAgo;
  }).length;

  const openDealsList = leadsList.filter(l => {
    const status = (l.status || '').toLowerCase();
    const stage = (l.stage || '').toLowerCase();
    return status !== 'converted' && status !== 'disqualified' && stage !== 'lost' && stage !== 'closed_lost';
  });
  const openDealsCount = openDealsList.length;

  const openPipelineValue = openDealsList.reduce((acc, l) => {
    return acc + (parseFloat(l.estimated_value) || 0);
  }, 0);

  const quotesCount = (store.quotations || []).length;
  const pendingTasks = (store.tasks || []).filter(t => (t.status || '').toLowerCase() !== 'completed');

  return res.json({
    success: true,
    data: {
      new_leads_this_week: newLeadsThisWeek,
      open_pipeline_value: openPipelineValue,
      quotes_awaiting_reply: quotesCount,
      follow_ups_due: pendingTasks.length,
      total_leads: leadsList.length,
      total_customers: (store.customers || []).length,
      open_deals_count: openDealsCount,
      pipeline_value: openPipelineValue,
      total_quotations: quotesCount,
      currency: 'AED',
      new_leads_subtitle: `${newLeadsThisWeek} new this week`,
      open_pipeline_subtitle: openDealsCount === 0 ? 'No open deals' : `Across ${openDealsCount} open ${openDealsCount === 1 ? 'deal' : 'deals'}`,
      quotes_subtitle: quotesCount === 0 ? 'All quotations up to date' : `${quotesCount} require follow-up`,
      follow_ups_subtitle: pendingTasks.length === 0 ? 'All follow-ups completed' : `${pendingTasks.length} action required today`
    }
  });
});

// GET /api/dashboard/leads-by-source
router.get('/leads-by-source', async (req, res) => {
  const { branch } = req.query;
  let leads = [];

  if (supabase) {
    try {
      let query = supabase.from('leads').select('source, branch');
      if (branch && branch !== 'All') query = query.eq('branch', branch);
      const { data, error } = await query;
      if (!error && data && data.length > 0) leads = data;
    } catch (e) {}
  }

  if (leads.length === 0) leads = store.leads || [];

  const sourcesMap = {};
  leads.forEach(l => {
    const src = (l.source || 'website').toLowerCase();
    sourcesMap[src] = (sourcesMap[src] || 0) + 1;
  });
  return res.json({ success: true, data: sourcesMap });
});

// GET /api/dashboard/follow-ups
router.get('/follow-ups', async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('tasks').select('*').neq('status', 'completed');
      if (!error && data && data.length > 0) {
        return res.json({ success: true, data });
      }
    } catch (e) {}
  }
  const pendingTasks = (store.tasks || []).filter(t => t.status === 'pending');
  return res.json({ success: true, data: pendingTasks });
});

// GET /api/dashboard/briefing
router.get('/briefing', (req, res) => {
  return res.json({
    success: true,
    data: {
      greeting: 'Good Morning',
      ai_summary: 'You have active leads requiring follow-up and pending quotations in your branch.',
      urgent_leads_count: 2,
      pending_approvals_count: 1
    }
  });
});

module.exports = router;
