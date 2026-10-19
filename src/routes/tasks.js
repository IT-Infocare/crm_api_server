const express = require('express');
const router = express.Router();
const store = require('../models/mockStore');

// GET /api/tasks - List tasks
router.get('/', (req, res) => {
  const { status, priority, lead_id } = req.query;
  let list = [...store.tasks];
  if (status) list = list.filter(t => t.status === status);
  if (priority) list = list.filter(t => t.priority === priority);
  if (lead_id) list = list.filter(t => t.lead_id === lead_id);
  return res.json({ success: true, data: list });
});

// GET /api/tasks/:id - Task details
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const task = store.tasks.find(t => t.id === id);
  if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
  return res.json({ success: true, data: task });
});

// POST /api/tasks - Create task
router.post('/', (req, res) => {
  const payload = req.body;
  const newTask = {
    id: `tsk_${Date.now()}`,
    title: payload.title || 'Untitled Task',
    description: payload.description || '',
    lead_id: payload.lead_id,
    customer_id: payload.customer_id,
    related_to_title: payload.related_to_title || '',
    assigned_user_id: payload.assigned_user_id || 'usr_1001',
    assigned_user_name: payload.assigned_user_name || 'Sarah Connor',
    due_date: payload.due_date || new Date(Date.now() + 86400000).toISOString(),
    priority: payload.priority || 'medium',
    status: payload.status || 'pending',
    created_at: new Date().toISOString()
  };
  store.tasks.unshift(newTask);
  return res.status(201).json({ success: true, message: 'Task created', data: newTask });
});

// PUT /api/tasks/:id - Update task
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const index = store.tasks.findIndex(t => t.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Task not found' });
  store.tasks[index] = { ...store.tasks[index], ...req.body };
  return res.json({ success: true, message: 'Task updated', data: store.tasks[index] });
});

// PATCH /api/tasks/:id/status - Update task status
router.patch('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const task = store.tasks.find(t => t.id === id);
  if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
  task.status = status;
  return res.json({ success: true, message: 'Task status updated', data: task });
});

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const index = store.tasks.findIndex(t => t.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Task not found' });
  store.tasks.splice(index, 1);
  return res.json({ success: true, message: 'Task deleted' });
});

module.exports = router;
