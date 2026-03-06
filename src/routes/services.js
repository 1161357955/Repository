'use strict';

const express = require('express');
const router = express.Router();

function buildRouter(db) {
  // List all services (optionally filter by vendor)
  router.get('/', (req, res) => {
    let query = `
      SELECT s.*, v.name AS vendor_name
      FROM services s
      JOIN vendors v ON s.vendor_id = v.id
    `;
    const params = [];
    if (req.query.vendor_id) {
      query += ' WHERE s.vendor_id = ?';
      params.push(req.query.vendor_id);
    }
    query += ' ORDER BY s.created_at DESC';
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  });

  // Get single service
  router.get('/:id', (req, res) => {
    const row = db.prepare(`
      SELECT s.*, v.name AS vendor_name
      FROM services s
      JOIN vendors v ON s.vendor_id = v.id
      WHERE s.id = ?
    `).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'الخدمة غير موجودة' });
    res.json(row);
  });

  // Create service
  router.post('/', (req, res) => {
    const { name, description, vendor_id, unit_price, unit, status } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'اسم الخدمة مطلوب' });
    if (!vendor_id) return res.status(400).json({ error: 'المورد مطلوب' });

    const vendor = db.prepare('SELECT id FROM vendors WHERE id = ?').get(vendor_id);
    if (!vendor) return res.status(400).json({ error: 'المورد غير موجود' });

    const stmt = db.prepare(
      'INSERT INTO services (name, description, vendor_id, unit_price, unit, status) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
      name.trim(), description || null, vendor_id,
      parseFloat(unit_price) || 0, unit || null, status || 'active'
    );
    const row = db.prepare(`
      SELECT s.*, v.name AS vendor_name FROM services s
      JOIN vendors v ON s.vendor_id = v.id WHERE s.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json(row);
  });

  // Update service
  router.put('/:id', (req, res) => {
    const existing = db.prepare('SELECT id FROM services WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'الخدمة غير موجودة' });

    const { name, description, vendor_id, unit_price, unit, status } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'اسم الخدمة مطلوب' });
    if (!vendor_id) return res.status(400).json({ error: 'المورد مطلوب' });

    const vendor = db.prepare('SELECT id FROM vendors WHERE id = ?').get(vendor_id);
    if (!vendor) return res.status(400).json({ error: 'المورد غير موجود' });

    db.prepare(
      'UPDATE services SET name=?, description=?, vendor_id=?, unit_price=?, unit=?, status=? WHERE id=?'
    ).run(
      name.trim(), description || null, vendor_id,
      parseFloat(unit_price) || 0, unit || null, status || 'active',
      req.params.id
    );
    const row = db.prepare(`
      SELECT s.*, v.name AS vendor_name FROM services s
      JOIN vendors v ON s.vendor_id = v.id WHERE s.id = ?
    `).get(req.params.id);
    res.json(row);
  });

  // Delete service
  router.delete('/:id', (req, res) => {
    const existing = db.prepare('SELECT id FROM services WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'الخدمة غير موجودة' });
    db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
    res.json({ message: 'تم حذف الخدمة بنجاح' });
  });

  return router;
}

module.exports = buildRouter;
