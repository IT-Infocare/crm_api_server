const express = require('express');
const router = express.Router();
const store = require('../models/mockStore');
const { supabase } = require('../config/db');

// GET /api/tasks - List tasks
router.get('/', async (req, res) => {
  const { status, priority, lead_id, branch } = req.query;

  if (supabase) {
    try {
      let query = supabase.from('tasks').select('*');
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return res.json({ success: true, data });
      }
    } catch (e) {
      console.warn('[Supabase Tasks Query Warning]:', e.message);
    }
  }

  let list = [...store.tasks];
  if (status) list = list.filter(t => (t.status || '').toLowerCase() === status.toLowerCase());
  if (priority) list = list.filter(t => (t.priority || '').toLowerCase() === priority.toLowerCase());
  if (lead_id) list = list.filter(t => t.lead_id === lead_id);
  if (branch && branch !== 'All') {
    list = list.filter(t => (t.location || '').toLowerCase().includes(branch.toLowerCase()) || (t.branch || '').toLowerCase() === branch.toLowerCase());
  }

  return res.json({ success: true, data: list });
});

// GET /api/tasks/:id - Task details
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (supabase) {
    try {
      const { data, error } = await supabase.from('tasks').select('*').eq('id', id).single();
      if (!error && data) return res.json({ success: true, data });
    } catch (e) {}
  }

  const task = store.tasks.find(t => t.id === id);
  if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
  return res.json({ success: true, data: task });
});

// POST /api/tasks - Create task
router.post('/', async (req, res) => {
  const payload = req.body;
  const taskId = payload.id || 'tsk_' + Date.now();
  const newTask = {
    id: taskId,
    title: payload.title || 'Untitled Task',
    subtitle: payload.subtitle || '',
    task_type: payload.task_type || payload.taskType || 'Visit',
    time_label: payload.time_label || payload.timeLabel || 'Today',
    contact_name: payload.contact_name || payload.contactName || '',
    phone: payload.phone || '+971 50 123 4567',
    location: payload.location || 'Dubai, UAE',
    description: payload.description || payload.subtitle || '',
    lead_id: payload.lead_id,
    customer_id: payload.customer_id,
    related_to_title: payload.related_to_title || payload.title || '',
    assigned_user_id: payload.assigned_user_id || 'usr_1001',
    assigned_user_name: payload.assigned_user_name || 'Sarah Connor',
    due_date: payload.due_date || payload.scheduled_at || new Date(Date.now() + 86400000).toISOString(),
    scheduled_at: payload.scheduled_at || new Date().toISOString(),
    priority: payload.priority || 'medium',
    status: payload.status || 'pending',
    is_completed: payload.is_completed || false,
    created_at: payload.created_at || new Date().toISOString()
  };

  if (supabase) {
    try {
      const sanitized = {
        title: newTask.title,
        priority: newTask.priority,
        status: newTask.status
      };
      await supabase.from('tasks').insert([sanitized]);
    } catch (e) {
      console.warn('[Supabase Task Insert Notice]:', e.message);
    }
  }

  store.tasks.unshift(newTask);
  return res.status(201).json({ success: true, message: 'Task created successfully', data: newTask });
});

// PUT /api/tasks/:id - Update task
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const payload = req.body;

  if (supabase) {
    try {
      await supabase.from('tasks').update(payload).eq('id', id);
    } catch (e) {}
  }

  const index = store.tasks.findIndex(t => t.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Task not found' });
  store.tasks[index] = { ...store.tasks[index], ...payload };
  return res.json({ success: true, message: 'Task updated successfully', data: store.tasks[index] });
});

// PATCH /api/tasks/:id/status - Update task status
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, is_completed } = req.body;

  if (supabase) {
    try {
      await supabase.from('tasks').update({ status }).eq('id', id);
    } catch (e) {}
  }

  const task = store.tasks.find(t => t.id === id);
  if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
  if (status) task.status = status;
  if (typeof is_completed === 'boolean') task.is_completed = is_completed;
  return res.json({ success: true, message: 'Task status updated successfully', data: task });
});

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  if (supabase) {
    try {
      await supabase.from('tasks').delete().eq('id', id);
    } catch (e) {}
  }

  const index = store.tasks.findIndex(t => t.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Task not found' });
  store.tasks.splice(index, 1);
  return res.json({ success: true, message: 'Task deleted successfully' });
});

module.exports = router;
