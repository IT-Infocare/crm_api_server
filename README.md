# Infocare CRM - Standalone REST API Server (CRUD Operations)

This is the standalone **Backend REST API Server** project for Infocare CRM, completely separated from the Flutter GUI presentation layer.

---

## 🚀 Features & Architecture

- **Independent API Architecture**: Completely decoupled from GUI components.
- **Full CRUD Support**: Complete CRUD operations for Leads, Customers, Quotations, Deals/Pipeline, Tasks, Campaigns, Products, Reports, Dashboard, Settings, Files, and Authentication.
- **Dual Storage Strategy**: Connects to **Supabase (PostgreSQL)** when credentials are configured, with automatic fallback to **in-memory mock store** for zero-dependency local testing.
- **CORS & Middleware Support**: Pre-configured with CORS headers, JSON body parser, health checks, and global error handling.

---

## 📂 Directory Structure

```
crm_api_server/
├── package.json
├── server.js               # Application entry point
├── .env                    # Environment variables configuration
├── .env.example
├── src/
│   ├── app.js              # Express app configuration & middleware
│   ├── config/
│   │   └── db.js           # Database connection manager (Supabase / Mock)
│   ├── models/
│   │   └── mockStore.js    # Seed data & in-memory data store
│   └── routes/
│       ├── auth.js         # /api/auth endpoints
│       ├── leads.js        # /api/leads endpoints (CRUD & activities)
│       ├── customers.js    # /api/customers endpoints (CRUD)
│       ├── quotations.js   # /api/quotations endpoints (CRUD & actions)
│       ├── deals.js        # /api/deals & /api/pipeline endpoints
│       ├── tasks.js        # /api/tasks endpoints (CRUD)
│       ├── campaigns.js    # /api/campaigns endpoints (CRUD)
│       ├── products.js     # /api/products endpoints (CRUD & import)
│       ├── dashboard.js    # /api/dashboard summary & analytics
│       ├── reports.js      # /api/reports analytics endpoints
│       ├── settings.js     # /api/settings endpoints
│       └── files.js        # /api/files presign & upload endpoints
```

---

## 🛠️ Quick Start & Running

### 1. Install Dependencies
```bash
cd crm_api_server
npm install
```

### 2. Start API Server
```bash
# Production mode
npm start

# Development mode (auto-reload)
npm run dev
```

The server will start at **`http://localhost:3000`**.

---

## 📋 API Endpoints Reference

### 1. Health Check
- `GET /health` - Server health status and timestamp.

### 2. Leads Module (`/api/leads`)
- `GET /api/leads` - List leads (supports `search`, `branch`, `source`, `status`, `stage`, `page`, `limit`).
- `GET /api/leads/:id` - Fetch single lead.
- `POST /api/leads` - Create new lead.
- `PUT /api/leads/:id` - Update existing lead.
- `PATCH /api/leads/:id/status` - Update lead status.
- `PATCH /api/leads/:id/owner` - Assign lead owner.
- `POST /api/leads/:id/convert` - Convert lead to customer/deal.
- `GET /api/leads/:id/activities` - Fetch lead activity timeline.
- `POST /api/leads/:id/activities` - Log new activity for lead.

### 3. Customers Module (`/api/customers`)
- `GET /api/customers` - List customers (`search`, `branch`).
- `GET /api/customers/:id` - Fetch customer detail.
- `POST /api/customers` - Create customer.
- `PUT /api/customers/:id` - Update customer.
- `DELETE /api/customers/:id` - Delete customer.

### 4. Quotations Module (`/api/quotations`)
- `GET /api/quotations` - List quotations (`search`, `status`).
- `GET /api/quotations/:id` - Fetch quotation detail with line items.
- `POST /api/quotations` - Create quotation.
- `PUT /api/quotations/:id` - Update quotation.
- `DELETE /api/quotations/:id` - Delete quotation.
- `POST /api/quotations/:id/submit-approval` - Submit quotation for manager approval.
- `POST /api/quotations/:id/approve` - Approve quotation.
- `POST /api/quotations/:id/send` - Mark quotation sent to client.
- `POST /api/quotations/:id/regenerate-ai-draft` - Trigger AI terms regeneration.

### 5. Deals & Pipeline Module (`/api/deals` & `/api/pipeline`)
- `GET /api/deals` - List deals.
- `GET /api/pipeline` - Fetch deals grouped by stage (`qualification`, `proposal`, `negotiation`, `won`, `lost`).
- `POST /api/deals` - Create deal.
- `PUT /api/deals/:id` - Update deal.
- `PATCH /api/pipeline/deals/:id/stage` - Update deal pipeline stage.

### 6. Tasks Module (`/api/tasks`)
- `GET /api/tasks` - List tasks (`status`, `priority`, `lead_id`).
- `GET /api/tasks/:id` - Fetch task detail.
- `POST /api/tasks` - Create task.
- `PUT /api/tasks/:id` - Update task.
- `PATCH /api/tasks/:id/status` - Update task status (`pending`, `completed`, `canceled`).
- `DELETE /api/tasks/:id` - Delete task.

### 7. Campaigns & Products (`/api/campaigns` & `/api/products`)
- `GET /api/campaigns` & `POST /api/campaigns` - Campaign CRUD.
- `GET /api/products` & `POST /api/products` - Product CRUD.
- `POST /api/products/import` - Bulk import product catalog.
- `GET /api/product-bundles` - Fetch pre-configured product bundles.

### 8. Dashboard & Reports (`/api/dashboard` & `/api/reports`)
- `GET /api/dashboard/summary` - Key metrics (total leads, customers, pipeline value, quotations).
- `GET /api/dashboard/leads-by-source` - Leads grouped by source.
- `GET /api/dashboard/follow-ups` - Pending tasks for current user.
- `GET /api/dashboard/briefing` - AI daily executive briefing.
- `GET /api/reports/*` - Analytics for source distribution, pipeline conversion, and quotation performance.

### 9. Settings & Files (`/api/settings` & `/api/files`)
- `GET /api/settings` & `PUT /api/settings` - System settings.
- `POST /api/files/presign` & `POST /api/files/complete` - Document/attachment uploads.

---

## 🌐 Connecting the GUI App

To point the Flutter GUI application to this standalone API server, set `API_BASE_URL` in the GUI `.env`:

```env
API_BASE_URL=http://localhost:3000/api
```
