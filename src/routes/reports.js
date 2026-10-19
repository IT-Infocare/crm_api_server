const express = require('express');
const router = express.Router();
const store = require('../models/mockStore');

// GET /api/reports/leads-by-source
router.get('/leads-by-source', (req, res) => {
  return res.json({
    success: true,
    data: [
      { source: 'WhatsApp', count: 18, value: 340000 },
      { source: 'Website', count: 12, value: 210000 },
      { source: 'Referral', count: 7, value: 145000 },
      { source: 'Direct Sales', count: 5, value: 90000 },
    ]
  });
});

// GET /api/reports/pipeline-value
router.get('/pipeline-value', (req, res) => {
  return res.json({
    success: true,
    data: [
      { stage: 'Qualification', value: 85000 },
      { stage: 'Proposal', value: 240000 },
      { stage: 'Negotiation', value: 165000 },
      { stage: 'Won', value: 380000 },
      { stage: 'Lost', value: 45000 }
    ]
  });
});

// GET /api/reports/conversion-rate
router.get('/conversion-rate', (req, res) => {
  return res.json({
    success: true,
    data: {
      overall_conversion_rate: 34.5,
      leads_total: 42,
      leads_converted: 15
    }
  });
});

// GET /api/reports/quotation-performance
router.get('/quotation-performance', (req, res) => {
  return res.json({
    success: true,
    data: {
      total_quotations_sent: 24,
      total_accepted: 14,
      acceptance_rate: 58.3,
      avg_deal_size: 45000
    }
  });
});

module.exports = router;
