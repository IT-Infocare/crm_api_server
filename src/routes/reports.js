const express = require('express');
const router = express.Router();

// Report figures are computed by the clients from real deals/quotations.
// These endpoints intentionally return no canned data.
router.get('/leads-by-source', (req, res) => res.json({ success: true, data: [] }));
router.get('/pipeline-value', (req, res) => res.json({ success: true, data: [] }));
router.get('/conversion-rate', (req, res) => res.json({ success: true, data: {} }));
router.get('/quotation-performance', (req, res) => res.json({ success: true, data: {} }));

module.exports = router;
