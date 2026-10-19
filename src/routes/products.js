const express = require('express');
const router = express.Router();
const store = require('../models/mockStore');

// GET /api/products - List products
router.get('/', (req, res) => {
  return res.json({ success: true, data: store.products });
});

// POST /api/products - Create product
router.post('/', (req, res) => {
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

// PUT /api/products/:id - Update product
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const index = store.products.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Product not found' });
  store.products[index] = { ...store.products[index], ...req.body };
  return res.json({ success: true, message: 'Product updated', data: store.products[index] });
});

// DELETE /api/products/:id - Delete product
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const index = store.products.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Product not found' });
  store.products.splice(index, 1);
  return res.json({ success: true, message: 'Product deleted' });
});

// POST /api/products/import - Bulk import products
router.post('/import', (req, res) => {
  const { products: items } = req.body;
  if (Array.isArray(items)) {
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
  }
  return res.json({ success: true, message: 'Products imported successfully' });
});

// GET /api/product-bundles - List product bundles
router.get('/bundles', (req, res) => {
  return res.json({
    success: true,
    data: [
      {
        id: 'bnd_001',
        name: '4-Camera CCTV Office Security Kit',
        description: 'Complete 4-Camera 4MP IP CCTV Kit with NVR and Cables',
        total_price: 3200,
        discount_price: 2800,
        items: store.products
      }
    ]
  });
});

module.exports = router;
