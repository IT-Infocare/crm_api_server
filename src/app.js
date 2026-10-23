const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const leadRoutes = require('./routes/leads');
const customerRoutes = require('./routes/customers');
const quotationRoutes = require('./routes/quotations');
const visitRoutes = require('./routes/visits');
const dealRoutes = require('./routes/deals');
const taskRoutes = require('./routes/tasks');
const campaignRoutes = require('./routes/campaigns');
const productRoutes = require('./routes/products');
const dashboardRoutes = require('./routes/dashboard');
const reportRoutes = require('./routes/reports');
const settingsRoutes = require('./routes/settings');
const fileRoutes = require('./routes/files');
const userRoutes = require('./routes/users');

const branchRoutes = require('./routes/branches');
const companyRoutes = require('./routes/companies');
const aiRoutes = require('./routes/ai');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoints (Root and /api/health for pre-warming)
const healthHandler = (req, res) => {
  res.json({
    status: 'ok',
    service: 'Infocare CRM Standalone REST API Server',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
};
app.get('/', healthHandler);
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// API Routes Registration
const prefix = process.env.API_PREFIX || '/api';

app.use(prefix + '/auth', authRoutes);
app.use(prefix + '/users', userRoutes);
app.use(prefix + '/companies', companyRoutes);
app.use(prefix + '/branches', branchRoutes);
app.use(prefix + '/settings/branches', branchRoutes);
app.use(prefix + '/leads', leadRoutes);
app.use(prefix + '/customers', customerRoutes);
app.use(prefix + '/quotations', quotationRoutes);
app.use(prefix + '/visits', visitRoutes);
app.use(prefix + '/deals', dealRoutes);
app.use(prefix + '/pipeline', dealRoutes);
app.use(prefix + '/tasks', taskRoutes);
app.use(prefix + '/campaigns', campaignRoutes);
app.use(prefix + '/products', productRoutes);
app.use(prefix + '/product-bundles', productRoutes);
app.use(prefix + '/dashboard', dashboardRoutes);
app.use(prefix + '/reports', reportRoutes);
app.use(prefix + '/settings', settingsRoutes);
app.use(prefix + '/files', fileRoutes);
app.use(prefix + '/ai', aiRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[API Error]:', err.stack || err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found: ' + req.method + ' ' + req.originalUrl
  });
});

module.exports = app;
