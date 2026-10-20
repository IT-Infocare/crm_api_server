// Shared helpers for writing to Supabase.
//
// Clients (CRM web, crm_field) send branch names ("Dubai", "RAK", "DXB",
// "Infocare Systems FZC") or a branch UUID. Supabase tables need a valid
// branches.id in branch_id (NOT NULL + FK), so every insert resolves it here.

const isUUID = (str) =>
  typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

let branchCache = null;
let branchCacheAt = 0;
const BRANCH_CACHE_MS = 5 * 60 * 1000;

async function getBranches(supabase) {
  if (branchCache && Date.now() - branchCacheAt < BRANCH_CACHE_MS) return branchCache;
  const { data, error } = await supabase.from('branches').select('id, code, name, city, short_name');
  if (error) {
    console.warn('[Branch Lookup Warning]:', error.message);
    return branchCache || [];
  }
  branchCache = data || [];
  branchCacheAt = Date.now();
  return branchCache;
}

const BRANCH_ALIASES = {
  DXB: ['dxb', 'dubai'],
  RAK: ['rak', 'ras al khaimah', 'ras al-khaimah'],
  FZC: ['fzc', 'shj', 'sharjah'],
};

/**
 * Returns a valid branches.id for a branch UUID or name, falling back to
 * the Dubai branch (or the first branch) so inserts never fail on branch_id.
 */
async function resolveBranchId(supabase, branchIdOrName) {
  const branches = await getBranches(supabase);
  if (branches.length === 0) return null;

  if (isUUID(branchIdOrName)) {
    const byId = branches.find((b) => b.id === branchIdOrName);
    if (byId) return byId.id;
  }

  const name = String(branchIdOrName || '').toLowerCase().trim();
  if (name) {
    const exact = branches.find((b) =>
      [b.code, b.name, b.city, b.short_name].some((v) => v && v.toLowerCase() === name)
    );
    if (exact) return exact.id;

    for (const [code, aliases] of Object.entries(BRANCH_ALIASES)) {
      if (aliases.some((a) => name.includes(a))) {
        const match = branches.find((b) => (b.code || '').toUpperCase() === code);
        if (match) return match.id;
      }
    }
  }

  const dubai = branches.find((b) => (b.code || '').toUpperCase() === 'DXB');
  return (dubai || branches[0]).id;
}

/** Branch display name for a branch_id, e.g. "Dubai", "RAK". */
async function branchNameFor(supabase, branchId) {
  const b = (await getBranches(supabase)).find((x) => x.id === branchId);
  if (!b) return 'Dubai';
  return { DXB: 'Dubai', RAK: 'RAK', FZC: 'Sharjah' }[(b.code || '').toUpperCase()] || b.city || b.name;
}

const toCode = (v) => String(v || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

const LEAD_SOURCES = ['direct_visit', 'event', 'walk_in', 'referral', 'phone', 'email', 'website',
  'whatsapp', 'facebook', 'instagram', 'linkedin', 'other'];

/** Maps "Direct visit", "WhatsApp", "Facebook"... to the lead_source enum. */
function normalizeLeadSource(source) {
  const code = toCode(source);
  if (!code) return 'website';
  if (LEAD_SOURCES.includes(code)) return code;
  if (code.includes('visit') || code === 'field') return 'direct_visit';
  if (code.includes('walk')) return 'walk_in';
  if (code.includes('call')) return 'phone';
  return 'other';
}

/** Maps "Site Survey", "Proposal", "Proposal Sent"... to the web pipeline stage codes. */
function normalizeLeadStage(stage) {
  const code = toCode(stage);
  if (!code) return 'new';
  const map = {
    proposal: 'quotation_sent',
    proposal_sent: 'quotation_sent',
    quote_sent: 'quotation_sent',
    quotation: 'quotation_sent',
    survey: 'site_survey',
  };
  return map[code] || code;
}

const ACTIVITY_TYPES = ['call', 'visit', 'site_survey', 'meeting', 'email', 'whatsapp', 'note'];

function normalizeActivityType(type) {
  const code = toCode(type);
  return ACTIVITY_TYPES.includes(code) ? code : 'note';
}

module.exports = {
  isUUID,
  resolveBranchId,
  branchNameFor,
  normalizeLeadSource,
  normalizeLeadStage,
  normalizeActivityType,
};
