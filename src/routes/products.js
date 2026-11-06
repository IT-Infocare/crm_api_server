const express = require('express');
const { randomUUID } = require('crypto');
const router = express.Router();
const store = require('../models/mockStore');
const { supabase } = require('../config/db');
const { updateRow, insertRows, sendUpdateFailure } = require('../utils/dbUpdate');

const dbError = (res, label, error) => {
  console.error(`[Supabase Product ${label} Error]:`, error.code, error.message);
  if (error.code === '23505') {
    return res.status(409).json({ success: false, message: 'A product with this SKU already exists' });
  }
  return res.status(500).json({ success: false, message: `Failed to ${label.toLowerCase()} product: ${error.message}` });
};

const toRow = (item, { forCreate = false } = {}) => {
  const row = {};
  const set = (k, v) => { if (v !== undefined) row[k] = v; };
  set('name', item.name);
  set('sku', item.sku);
  set('category', item.category);
  set('description', item.description);
  set('unit_price', item.unit_price !== undefined ? Number(item.unit_price) || 0 : undefined);
  set('cost_price', item.cost_price !== undefined && item.cost_price !== null ? Number(item.cost_price) || 0 : undefined);
  set('is_active', item.is_active);
  if (forCreate) {
    row.id = randomUUID();
    row.name = row.name || 'New Product';
    row.sku = row.sku || `SKU-${Date.now()}`;
    row.category = row.category || 'General';
    row.unit_price = row.unit_price || 0;
    row.cost_price = row.cost_price || 0;
  }
  return row;
};

// GET /api/products - List products
router.get('/', async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) return dbError(res, 'List', error);
    return res.json({ success: true, data });
  }
  return res.json({ success: true, data: store.products });
});

// POST /api/products - Create product
router.post('/', async (req, res) => {
  if (supabase) {
    const { data, error } = await insertRows(supabase, 'products', toRow(req.body, { forCreate: true }));
    if (error) return dbError(res, 'Create', error);
    return res.status(201).json({ success: true, message: 'Product created', data: data[0] });
  }
  const payload = req.body;
  const newProduct = {
    id: `prod_${Date.now()}`,
    name: payload.name || 'New Product',
    sku: payload.sku || `SKU-${Date.now()}`,
    category: payload.category || 'General',
    unit_price: payload.unit_price || 0,
    cost_price: payload.cost_price || 0,
    created_at: new Date().toISOString()
  };
  store.products.unshift(newProduct);
  return res.status(201).json({ success: true, message: 'Product created', data: newProduct });
});

// POST /api/products/import - Bulk import products
router.post('/import', async (req, res) => {
  const { products: items } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ success: false, message: 'products array required' });
  }
  if (supabase) {
    const rows = items.map((i) => toRow(i, { forCreate: true }));
    const { error } = await insertRows(supabase, 'products', rows);
    if (error) return dbError(res, 'Import', error);
    return res.json({ success: true, message: 'Products imported successfully' });
  }
  items.forEach(item => {
    store.products.push({
      id: `prod_${Date.now()}_${Math.random()}`,
      name: item.name || 'Imported Product',
      sku: item.sku || `SKU-${Math.floor(Math.random()*10000)}`,
      category: item.category || 'General',
      unit_price: item.unit_price || 0,
      cost_price: item.cost_price || 0,
      created_at: new Date().toISOString()
    });
  });
  return res.json({ success: true, message: 'Products imported successfully' });
});

// GET /api/products/bundles - no bundles table yet; never return demo bundles when a DB is configured
router.get('/bundles', (req, res) => {
  if (supabase) return res.json({ success: true, data: [] });
  return res.json({
    success: true,
    data: [{
      id: 'bnd_001',
      name: '4-Camera CCTV Office Security Kit',
      description: 'Complete 4-Camera 4MP IP CCTV Kit with NVR and Cables',
      total_price: 3200,
      discount_price: 2800,
      items: store.products
    }]
  });
});

// PUT /api/products/:id - Update product
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  if (supabase) {
    const result = await updateRow(supabase, 'products', id, toRow(req.body));
    if (result.data) return res.json({ success: true, message: 'Product updated', data: result.data });
    if (result.error && result.error.code === '23505') return dbError(res, 'Update', result.error);
    return sendUpdateFailure(res, 'Product', result);
  }
  const index = store.products.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Product not found' });
  store.products[index] = { ...store.products[index], ...req.body };
  return res.json({ success: true, message: 'Product updated', data: store.products[index] });
});

// DELETE /api/products/:id - Delete product
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (supabase) {
    const { data, error } = await supabase.from('products').delete().eq('id', id).select('id');
    if (error) return dbError(res, 'Delete', error);
    if (!data || data.length === 0) return res.status(404).json({ success: false, message: 'Product not found' });
    return res.json({ success: true, message: 'Product deleted' });
  }
  const index = store.products.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Product not found' });
  store.products.splice(index, 1);
  return res.json({ success: true, message: 'Product deleted' });
});

module.exports = router;
