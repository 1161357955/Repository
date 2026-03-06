'use strict';

const express = require('express');
const router = express.Router();

const VALID_STATUSES = ['pending', 'paid', 'cancelled', 'overdue'];

function generateInvoiceNumber(db) {
  const year = new Date().getFullYear();
  const count = db.prepare(
    "SELECT COUNT(*) AS c FROM invoices WHERE invoice_number LIKE ?"
  ).get(`INV-${year}-%`).c;
  return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
}

function buildRouter(db) {
  // List all invoices
  router.get('/', (req, res) => {
    const rows = db.prepare(`
      SELECT i.*, b.name AS beneficiary_name
      FROM invoices i
      JOIN beneficiaries b ON i.beneficiary_id = b.id
      ORDER BY i.created_at DESC
    `).all();
    res.json(rows);
  });

  // Get single invoice with items
  router.get('/:id', (req, res) => {
    const invoice = db.prepare(`
      SELECT i.*, b.name AS beneficiary_name
      FROM invoices i
      JOIN beneficiaries b ON i.beneficiary_id = b.id
      WHERE i.id = ?
    `).get(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'الفاتورة غير موجودة' });

    const items = db.prepare(`
      SELECT ii.*, s.name AS service_name, s.unit
      FROM invoice_items ii
      JOIN services s ON ii.service_id = s.id
      WHERE ii.invoice_id = ?
    `).all(req.params.id);

    res.json({ ...invoice, items });
  });

  // Create invoice
  router.post('/', (req, res) => {
    const { beneficiary_id, due_date, notes, items } = req.body;
    if (!beneficiary_id) return res.status(400).json({ error: 'المستفيد مطلوب' });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'يجب إضافة بند واحد على الأقل' });
    }

    const beneficiary = db.prepare('SELECT id FROM beneficiaries WHERE id = ?').get(beneficiary_id);
    if (!beneficiary) return res.status(400).json({ error: 'المستفيد غير موجود' });

    // Validate items
    for (const item of items) {
      if (!item.service_id) return res.status(400).json({ error: 'الخدمة مطلوبة في كل بند' });
      if (!item.quantity || item.quantity <= 0) return res.status(400).json({ error: 'الكمية يجب أن تكون أكبر من صفر' });
      const svc = db.prepare('SELECT id, unit_price FROM services WHERE id = ?').get(item.service_id);
      if (!svc) return res.status(400).json({ error: `الخدمة ${item.service_id} غير موجودة` });
    }

    const createInvoice = db.transaction(() => {
      const invoice_number = generateInvoiceNumber(db);
      let total_amount = 0;
      const stmtInvoice = db.prepare(
        'INSERT INTO invoices (invoice_number, beneficiary_id, due_date, notes, total_amount) VALUES (?, ?, ?, ?, ?)'
      );
      const invResult = stmtInvoice.run(invoice_number, beneficiary_id, due_date || null, notes || null, 0);
      const invoice_id = invResult.lastInsertRowid;

      const stmtItem = db.prepare(
        'INSERT INTO invoice_items (invoice_id, service_id, quantity, unit_price) VALUES (?, ?, ?, ?)'
      );

      for (const item of items) {
        const svc = db.prepare('SELECT unit_price FROM services WHERE id = ?').get(item.service_id);
        const unit_price = item.unit_price !== undefined ? parseFloat(item.unit_price) : svc.unit_price;
        const qty = parseFloat(item.quantity);
        stmtItem.run(invoice_id, item.service_id, qty, unit_price);
        total_amount += qty * unit_price;
      }

      db.prepare('UPDATE invoices SET total_amount = ? WHERE id = ?').run(total_amount, invoice_id);
      return invoice_id;
    });

    const invoice_id = createInvoice();
    const invoice = db.prepare(`
      SELECT i.*, b.name AS beneficiary_name FROM invoices i
      JOIN beneficiaries b ON i.beneficiary_id = b.id WHERE i.id = ?
    `).get(invoice_id);
    const invoiceItems = db.prepare(`
      SELECT ii.*, s.name AS service_name, s.unit FROM invoice_items ii
      JOIN services s ON ii.service_id = s.id WHERE ii.invoice_id = ?
    `).all(invoice_id);

    res.status(201).json({ ...invoice, items: invoiceItems });
  });

  // Update invoice status
  router.patch('/:id/status', (req, res) => {
    const invoice = db.prepare('SELECT id FROM invoices WHERE id = ?').get(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'الفاتورة غير موجودة' });

    const { status } = req.body;
    const validStatuses = VALID_STATUSES;
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'حالة غير صالحة' });
    }

    db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json(db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id));
  });

  // Delete invoice
  router.delete('/:id', (req, res) => {
    const invoice = db.prepare('SELECT id FROM invoices WHERE id = ?').get(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'الفاتورة غير موجودة' });
    db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
    res.json({ message: 'تم حذف الفاتورة بنجاح' });
  });

  // Dashboard stats
  router.get('/stats/summary', (req, res) => {
    const vendorCount = db.prepare('SELECT COUNT(*) AS c FROM vendors').get().c;
    const beneficiaryCount = db.prepare('SELECT COUNT(*) AS c FROM beneficiaries').get().c;
    const serviceCount = db.prepare('SELECT COUNT(*) AS c FROM services').get().c;
    const invoiceCount = db.prepare('SELECT COUNT(*) AS c FROM invoices').get().c;
    const totalRevenue = db.prepare(
      "SELECT COALESCE(SUM(total_amount),0) AS t FROM invoices WHERE status = 'paid'"
    ).get().t;
    const pendingAmount = db.prepare(
      "SELECT COALESCE(SUM(total_amount),0) AS t FROM invoices WHERE status = 'pending'"
    ).get().t;
    res.json({ vendorCount, beneficiaryCount, serviceCount, invoiceCount, totalRevenue, pendingAmount });
  });

  return router;
}

module.exports = buildRouter;
