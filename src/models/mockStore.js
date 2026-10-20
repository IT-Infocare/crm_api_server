// In-memory data store for fallback and rapid prototyping

let leads = [
  {
    id: 'lead_001',
    contact_name: 'Ahmed Al Mansoori',
    company_name: 'Al Maya Trading LLC',
    phone: '+971 50 111 2222',
    email: 'ahmed@almaya.ae',
    whatsapp_number: '+971 50 111 2222',
    location: 'Dubai',
    requirement: 'Full CCTV and Access Control system for 3-floor office building with 40 cameras.',
    source: 'whatsapp',
    source_detail: 'Inbound message from campaign banner',
    campaign: 'Q3 Security Solutions',
    captured_by: 'WhatsApp AI Agent',
    owner_id: 'usr_1001',
    owner_name: 'Sarah Connor',
    branch: 'Dubai',
    estimated_value: 45000,
    product_interest: 'Hikvision IP CCTV, ZK Access',
    status: 'contacted',
    stage: 'site_survey',
    ai_summary: 'High intent lead requesting 40 camera IP CCTV installation and bio-access doors.',
    ai_category: 'CCTV & Security',
    ai_urgency: 'High',
    ai_next_step: 'Schedule site survey visit within 24 hours.',
    ai_draft_reply: 'Hello Ahmed, thank you for reaching out to Infocare. We can definitely assist with your 40-camera IP CCTV requirement for your 3-floor office.',
    is_duplicate: false,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'lead_002',
    contact_name: 'John Smith',
    company_name: 'Apex Logistics',
    phone: '+971 55 333 4444',
    email: 'jsmith@apexlogistics.com',
    whatsapp_number: '+971 55 333 4444',
    location: 'RAK',
    requirement: 'Structured cabling and Wi-Fi access points for 10,000 sq ft warehouse.',
    source: 'website',
    source_detail: 'Web form submission',
    campaign: 'Google Ads Search',
    captured_by: 'Web Form',
    owner_id: 'usr_1002',
    owner_name: 'Rahul Verma',
    branch: 'RAK',
    estimated_value: 120000,
    product_interest: 'Aruba Wi-Fi 6, Cat6A Cabling',
    status: 'contacted',
    stage: 'quotation_sent',
    ai_summary: 'Enterprise warehouse networking inquiry. Requires high-density wireless coverage.',
    ai_category: 'Networking',
    ai_urgency: 'Medium',
    ai_next_step: 'Follow up on Quotation QT-2026-089 sent on Tuesday.',
    ai_draft_reply: 'Dear Mr. Smith, following up on our quotation for the Apex Logistics warehouse project.',
    is_duplicate: false,
    created_at: new Date(Date.now() - 259200000).toISOString(),
  }
];

let customers = [
  {
    id: 'cust_001',
    name: 'Ahmed Al Mansoori',
    company_name: 'Al Maya Trading LLC',
    email: 'ahmed@almaya.ae',
    phone: '+971 50 111 2222',
    whatsapp_number: '+971 50 111 2222',
    branch: 'Dubai',
    emirate: 'Dubai',
    address: 'Business Bay, Tower B, Office 1204',
    total_revenue: 145000,
    total_deals: 3,
    created_at: new Date(Date.now() - 10368000000).toISOString(),
  },
  {
    id: 'cust_002',
    name: 'John Smith',
    company_name: 'Apex Logistics',
    email: 'jsmith@apexlogistics.com',
    phone: '+971 55 333 4444',
    whatsapp_number: '+971 55 333 4444',
    branch: 'RAK',
    emirate: 'Ras Al Khaimah',
    address: 'Al Hamra Industrial Zone, Plot 44',
    total_revenue: 280000,
    total_deals: 5,
    created_at: new Date(Date.now() - 17280000000).toISOString(),
  }
];

let quotations = [
  {
    id: 'qt_001',
    quotation_number: 'QT-2026-001',
    version: 1,
    status: 'draft',
    valid_until: new Date(Date.now() + 1296000000).toISOString(),
    customer_id: 'cust_001',
    customer_name: 'Al Maya Trading LLC',
    lead_id: 'lead_001',
    prepared_by: 'Sarah Connor',
    terms: '50% Advance, 50% on completion. Validity 15 days.',
    subtotal: 42000,
    vat_amount: 2100,
    total_amount: 44100,
    items: [
      {
        id: 'qti_01',
        quotation_id: 'qt_001',
        product_name: 'Hikvision 4MP IP Dome Camera',
        quantity: 40,
        unit_price: 350,
        discount: 0,
        line_total: 14000
      },
      {
        id: 'qti_02',
        quotation_id: 'qt_001',
        product_name: 'NVR 64-Channel 4K Storage',
        quantity: 1,
        unit_price: 8500,
        discount: 500,
        line_total: 8000
      }
    ],
    created_at: new Date().toISOString(),
  }
];

let deals = [
  {
    id: 'deal_001',
    title: 'CCTV Installation - Al Maya Tower',
    value: 45000,
    stage: 'proposal',
    customer_name: 'Al Maya Trading LLC',
    created_at: new Date().toISOString()
  },
  {
    id: 'deal_002',
    title: 'Structured Cabling - Apex Warehouse',
    value: 120000,
    stage: 'negotiation',
    customer_name: 'Apex Logistics',
    created_at: new Date().toISOString()
  }
];

let tasks = [
  {
    id: 'tsk_001',
    title: 'Site survey visit at Al Maya Building',
    description: 'Verify cable conduit routes and camera placement on floors 1-3.',
    lead_id: 'lead_001',
    related_to_title: 'Al Maya Trading LLC',
    assigned_user_id: 'usr_1001',
    assigned_user_name: 'Sarah Connor',
    due_date: new Date(Date.now() + 86400000).toISOString(),
    priority: 'high',
    status: 'pending',
    created_at: new Date().toISOString(),
  }
];

let campaigns = [
  {
    id: 'cmp_001',
    name: 'Q3 Security Solutions',
    channel: 'WhatsApp & Meta Ads',
    budget: 15000,
    status: 'active',
    created_at: new Date().toISOString()
  }
];

let products = [
  {
    id: 'prod_001',
    name: 'Hikvision 4MP IP Dome Camera',
    sku: 'HIK-CAM-4MP',
    category: 'CCTV',
    unit_price: 350,
    cost_price: 220,
    created_at: new Date().toISOString()
  },
  {
    id: 'prod_002',
    name: 'Yeastar S50 IP PBX Phone System',
    sku: 'YST-S50',
    category: 'Telecom',
    unit_price: 4500,
    cost_price: 3100,
    created_at: new Date().toISOString()
  }
];

let activities = [
  {
    id: 'act_101',
    lead_id: 'lead_001',
    type: 'lead_created',
    description: 'Lead captured via WhatsApp AI channel.',
    created_by: 'System AI',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  }
];

let users = [
  { id: 'usr_1001', name: 'Sarah Connor', email: 'sarah@infocare.ae', role: 'Sales Manager', branch: 'Dubai' },
  { id: 'usr_1002', name: 'Rahul Verma', email: 'rahul@infocare.ae', role: 'Sales Engineer', branch: 'RAK' },
];

let settings = {
  company_name: 'Infocare Technologies LLC',
  default_currency: 'AED',
  default_vat_percent: 5,
  branches: ['Dubai', 'RAK', 'Sharjah'],
  enable_ai_suggestions: true,
};

let visits = [
  {
    id: 'vst_01',
    company_or_site: 'Al Noor Villas',
    contact_name: 'Rashid',
    mobile: '+971 50 444 8899',
    interests: ['CCTV', 'Access control'],
    notes: 'Villa renovation project, requires 8 IP dome cameras.',
    photo_count: 2,
    has_voice_note: false,
    voice_note_duration_seconds: 0,
    location_address: 'Al Barsha, Dubai',
    branch: 'Dubai',
    is_synced: true,
    created_at: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'vst_02',
    company_or_site: 'Emirates Logistics',
    contact_name: 'Mohamed Tariq',
    mobile: '+971 55 987 6543',
    interests: ['CCTV', 'Intercom'],
    notes: 'Warehouse survey completed. Client requested quote by Thursday.',
    photo_count: 3,
    has_voice_note: true,
    voice_note_duration_seconds: 45,
    location_address: 'Warehouse 14, Jebel Ali Industrial, Dubai',
    branch: 'Dubai',
    is_synced: true,
    created_at: new Date(Date.now() - 7200000).toISOString()
  }
];

module.exports = {
  visits,
  leads,
  customers,
  quotations,
  deals,
  tasks,
  campaigns,
  products,
  activities,
  users,
  settings,
};
