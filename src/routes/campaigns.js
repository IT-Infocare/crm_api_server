const express = require('express');
const router = express.Router();
const store = require('../models/mockStore');

// GET /api/campaigns - List campaigns
router.get('/', (req, res) => {
  return res.json({ success: true, data: store.campaigns });
});

// GET /api/campaigns/:id - Campaign details
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const campaign = store.campaigns.find(c => c.id === id);
  if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
  return res.json({ success: true, data: campaign });
});

// POST /api/campaigns - Create campaign
router.post('/', (req, res) => {
  const payload = req.body;
  const newCampaign = {
    id: `cmp_${Date.now()}`,
    name: payload.name || 'New Campaign',
    channel: payload.channel || 'Digital',
    budget: payload.budget || 0,
    status: payload.status || 'active',
    created_at: new Date().toISOString()
  };
  store.campaigns.unshift(newCampaign);
  return res.status(201).json({ success: true, message: 'Campaign created', data: newCampaign });
});

// PUT /api/campaigns/:id - Update campaign
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const index = store.campaigns.findIndex(c => c.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Campaign not found' });
  store.campaigns[index] = { ...store.campaigns[index], ...req.body };
  return res.json({ success: true, message: 'Campaign updated', data: store.campaigns[index] });
});

// DELETE /api/campaigns/:id - Delete campaign
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const index = store.campaigns.findIndex(c => c.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Campaign not found' });
  store.campaigns.splice(index, 1);
  return res.json({ success: true, message: 'Campaign deleted' });
});

module.exports = router;
