const { Client } = require('pg');

const connectionString = 'postgresql://postgres:InfocareDB%40168@db.hqijrtdyvtaclifrbuuc.supabase.co:5432/postgres';

const sql = `
-- 1. LEADS TABLE
CREATE TABLE IF NOT EXISTS public.leads (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    customer_id TEXT,
    contact_name TEXT NOT NULL,
    company_name TEXT,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    whatsapp_number TEXT,
    location TEXT,
    requirement TEXT NOT NULL,
    source TEXT DEFAULT 'website',
    source_detail TEXT,
    campaign TEXT,
    captured_by TEXT,
    owner_id TEXT,
    owner_name TEXT,
    branch TEXT DEFAULT 'Dubai',
    estimated_value NUMERIC DEFAULT 0,
    product_interest TEXT,
    status TEXT DEFAULT 'new',
    stage TEXT DEFAULT 'new',
    ai_summary TEXT,
    ai_category TEXT,
    ai_urgency TEXT,
    ai_next_step TEXT,
    ai_draft_reply TEXT,
    is_duplicate BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist in public.leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS requirement TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'website';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source_detail TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS campaign TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS captured_by TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'Dubai';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS estimated_value NUMERIC DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS product_interest TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'new';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_category TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_urgency TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_next_step TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_draft_reply TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT FALSE;

-- 2. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    company_name TEXT,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    whatsapp_number TEXT,
    branch TEXT DEFAULT 'Dubai',
    emirate TEXT DEFAULT 'Dubai',
    address TEXT,
    total_revenue NUMERIC DEFAULT 0,
    total_deals INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. QUOTATIONS TABLE
CREATE TABLE IF NOT EXISTS public.quotations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    quotation_number TEXT NOT NULL,
    version INT DEFAULT 1,
    status TEXT DEFAULT 'draft',
    valid_until TIMESTAMPTZ,
    customer_id TEXT,
    customer_name TEXT,
    lead_id TEXT,
    deal_id TEXT,
    prepared_by TEXT,
    terms TEXT,
    subtotal NUMERIC DEFAULT 0,
    vat_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    pdf_url TEXT,
    is_ai_draft BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. QUOTATION ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.quotation_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    quotation_id TEXT,
    product_id TEXT,
    product_name TEXT NOT NULL,
    description TEXT,
    quantity INT DEFAULT 1,
    unit_price NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    line_total NUMERIC DEFAULT 0,
    sort_order INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TASKS TABLE
CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    description TEXT,
    lead_id TEXT,
    customer_id TEXT,
    related_to_title TEXT,
    assigned_user_id TEXT,
    assigned_user_name TEXT,
    due_date TIMESTAMPTZ,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ACTIVITIES TABLE
CREATE TABLE IF NOT EXISTS public.activities (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    lead_id TEXT,
    customer_id TEXT,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    username TEXT UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'Admin',
    branch TEXT DEFAULT 'Dubai',
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Admin';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'Dubai';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;

-- DISABLE RLS FOR READ/WRITE API ACCESS
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- GRANT PERMISSIONS TO API ROLES
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- SEED DEFAULT ADMIN USER
INSERT INTO public.users (id, username, name, email, password, role, branch, phone)
VALUES 
  ('a0000000-0000-4000-a000-000000000001', 'Admin', 'System Administrator', 'admin@infocare.ae', 'Info@1234', 'Admin', 'Dubai', '+971 50 100 0000')
ON CONFLICT DO NOTHING;
-- SEED INITIAL BRANCHES
CREATE TABLE IF NOT EXISTS public.branches (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    code TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS short_name TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Dubai';
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS time_zone TEXT DEFAULT 'Asia/Dubai';
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS telephone TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS mobile_number TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS email_address TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS tr_number TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS trn TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.branches DISABLE ROW LEVEL SECURITY;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

UPDATE public.branches SET 
  short_name = COALESCE(short_name, 'Dubai'),
  phone = COALESCE(phone, '+971 4 321 0000'),
  mobile = COALESCE(mobile, '+971 50 111 2222'),
  email = COALESCE(email, 'dubai@infocare.ae'),
  location = COALESCE(location, 'Dubai, UAE'),
  tr_number = COALESCE(tr_number, '100293847500003'),
  address = COALESCE(address, 'Business Bay, Tower B, Office 1204, Dubai, UAE')
WHERE code = 'DXB' OR code = 'Dubai' OR name ILIKE '%Dubai%';

-- SEED INITIAL CUSTOMERS
INSERT INTO public.customers (id, name, company_name, email, phone, whatsapp_number, branch, emirate, address, total_revenue, total_deals)
VALUES 
  ('11111111-1111-4111-a111-111111111111', 'Ahmed Al Mansoori', 'Al Maya Trading LLC', 'ahmed@almaya.ae', '+971 50 111 2222', '+971 50 111 2222', 'Dubai', 'Dubai', 'Business Bay, Tower B, Office 1204', 145000, 3),
  ('22222222-2222-4222-a222-222222222222', 'John Smith', 'Apex Logistics', 'jsmith@apexlogistics.com', '+971 55 333 4444', '+971 55 333 4444', 'RAK', 'Ras Al Khaimah', 'Al Hamra Industrial Zone, Plot 44', 280000, 5)
ON CONFLICT (id) DO NOTHING;

-- Ensure title is not strictly required if null
ALTER TABLE public.leads ALTER COLUMN title DROP NOT NULL;

-- SEED INITIAL LEADS
INSERT INTO public.leads (id, customer_id, title, contact_name, company_name, phone, email, whatsapp_number, location, requirement, source, source_detail, campaign, captured_by, owner_id, owner_name, branch_id, branch, estimated_value, status, stage, ai_summary, ai_category, ai_urgency, ai_next_step, ai_draft_reply)
VALUES
  ('33333333-3333-4333-a333-333333333333', '11111111-1111-4111-a111-111111111111', 'CCTV Installation - Al Maya', 'Ahmed Al Mansoori', 'Al Maya Trading LLC', '+971 50 111 2222', 'ahmed@almaya.ae', '+971 50 111 2222', 'Dubai', 'Full CCTV and Access Control system for 3-floor office building with 40 cameras.', 'whatsapp', 'Inbound message from campaign banner', 'Q3 Security Solutions', 'WhatsApp AI Agent', (SELECT id FROM public.profiles LIMIT 1), 'Sarah Connor', (SELECT id FROM public.branches LIMIT 1), 'Dubai', 45000, 'new', 'site_survey', 'High intent lead requesting 40 camera IP CCTV installation.', 'CCTV & Security', 'high', 'Schedule site survey visit within 24 hours.', 'Hello Ahmed, thank you for reaching out to Infocare.'),
  ('44444444-4444-4444-a444-444444444444', '22222222-2222-4222-a222-222222222222', 'Structured Cabling - Apex', 'John Smith', 'Apex Logistics', '+971 55 333 4444', 'jsmith@apexlogistics.com', '+971 55 333 4444', 'RAK', 'Structured cabling and Wi-Fi access points for 10,000 sq ft warehouse.', 'website', 'Web form submission', 'Google Ads Search', 'Web Form', (SELECT id FROM public.profiles LIMIT 1), 'Rahul Verma', (SELECT id FROM public.branches LIMIT 1), 'RAK', 120000, 'contacted', 'quotation_sent', 'Enterprise warehouse networking inquiry.', 'Networking', 'medium', 'Follow up on Quotation QT-2026-089 sent on Tuesday.', 'Dear Mr. Smith, following up on our quotation for the Apex Logistics warehouse project.')
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
`;

async function run() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('[DB Init] Connecting to Supabase PostgreSQL database...');
    await client.connect();
    console.log('[DB Init] Connected! Running schema migration script...');
    await client.query(sql);
    console.log('[DB Init] ✅ Database migration completed successfully!');
  } catch (err) {
    console.error('[DB Init Error]:', err);
  } finally {
    await client.end();
  }
}

run();
