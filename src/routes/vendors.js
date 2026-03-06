'use strict';

const express = require('express');
const router = express.Router();

function buildRouter(db) {
  // List all vendors
  router.get('/', (req, res) => {
    const vendors = db.prepare('SELECT * FROM vendors ORDER BY created_at DESC').all();
    res.json(vendors);
  });

  // Get single vendor
  router.get('/:id', (req, res) => {
    const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
    if (!vendor) return res.status(404).json({ error: 'المورد غير موجود' });
    res.json(vendor);
  });

  // Create vendor
  router.post('/', (req, res) => {
    const { name, email, phone, address, category, status } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'اسم المورد مطلوب' });
    }
    const stmt = db.prepare(
      'INSERT INTO vendors (name, email, phone, address, category, status) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
      name.trim(), email || null, phone || null,
      address || null, category || null, status || 'active'
    );
    const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(vendor);
  });

  // Update vendor
  router.put('/:id', (req, res) => {
    const vendor = db.prepare('SELECT id FROM vendors WHERE id = ?').get(req.params.id);
    if (!vendor) return res.status(404).json({ error: 'المورد غير موجود' });

    const { name, email, phone, address, category, status } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'اسم المورد مطلوب' });
    }
    db.prepare(
      'UPDATE vendors SET name=?, email=?, phone=?, address=?, category=?, status=? WHERE id=?'
    ).run(
      name.trim(), email || null, phone || null,
      address || null, category || null, status || 'active',
      req.params.id
    );
    res.json(db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id));
  });

  // Delete vendor
  router.delete('/:id', (req, res) => {
    const vendor = db.prepare('SELECT id FROM vendors WHERE id = ?').get(req.params.id);
    if (!vendor) return res.status(404).json({ error: 'المورد غير موجود' });
    db.prepare('DELETE FROM vendors WHERE id = ?').run(req.params.id);
    res.json({ message: 'تم حذف المورد بنجاح' });
  });

  return router;
}

module.exports = buildRouter;
