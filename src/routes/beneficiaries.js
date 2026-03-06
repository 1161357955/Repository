'use strict';

const express = require('express');
const router = express.Router();

function buildRouter(db) {
  // List all beneficiaries
  router.get('/', (req, res) => {
    const rows = db.prepare('SELECT * FROM beneficiaries ORDER BY created_at DESC').all();
    res.json(rows);
  });

  // Get single beneficiary
  router.get('/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM beneficiaries WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'المستفيد غير موجود' });
    res.json(row);
  });

  // Create beneficiary
  router.post('/', (req, res) => {
    const { name, email, phone, address, type, status } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'اسم المستفيد مطلوب' });
    }
    const stmt = db.prepare(
      'INSERT INTO beneficiaries (name, email, phone, address, type, status) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
      name.trim(), email || null, phone || null,
      address || null, type || null, status || 'active'
    );
    const row = db.prepare('SELECT * FROM beneficiaries WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(row);
  });

  // Update beneficiary
  router.put('/:id', (req, res) => {
    const existing = db.prepare('SELECT id FROM beneficiaries WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'المستفيد غير موجود' });

    const { name, email, phone, address, type, status } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'اسم المستفيد مطلوب' });
    }
    db.prepare(
      'UPDATE beneficiaries SET name=?, email=?, phone=?, address=?, type=?, status=? WHERE id=?'
    ).run(
      name.trim(), email || null, phone || null,
      address || null, type || null, status || 'active',
      req.params.id
    );
    res.json(db.prepare('SELECT * FROM beneficiaries WHERE id = ?').get(req.params.id));
  });

  // Delete beneficiary
  router.delete('/:id', (req, res) => {
    const existing = db.prepare('SELECT id FROM beneficiaries WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'المستفيد غير موجود' });
    db.prepare('DELETE FROM beneficiaries WHERE id = ?').run(req.params.id);
    res.json({ message: 'تم حذف المستفيد بنجاح' });
  });

  return router;
}

module.exports = buildRouter;
