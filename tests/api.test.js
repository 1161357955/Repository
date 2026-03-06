'use strict';

/**
 * Integration tests for the Falak platform API
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Use a temp DB for testing
const tmpDb = path.join(os.tmpdir(), `falak-test-${Date.now()}.db`);
process.env.DB_PATH = tmpDb;

// Re-require after setting env (fresh module cache)
jest.resetModules();
const { createDb } = require('../src/database');
const db = createDb(tmpDb);

// Patch the app to use the test db
const express = require('express');
const cors = require('cors');
const buildVendors = require('../src/routes/vendors');
const buildBeneficiaries = require('../src/routes/beneficiaries');
const buildServices = require('../src/routes/services');
const buildBilling = require('../src/routes/billing');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/vendors', buildVendors(db));
app.use('/api/beneficiaries', buildBeneficiaries(db));
app.use('/api/services', buildServices(db));
app.use('/api/invoices', buildBilling(db));

afterAll(() => {
  db.close();
  if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
});

// ── Vendors ────────────────────────────────────────────────
describe('Vendors API', () => {
  let vendorId;

  test('GET /api/vendors returns empty array', async () => {
    const res = await request(app).get('/api/vendors');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/vendors creates a vendor', async () => {
    const res = await request(app).post('/api/vendors').send({ name: 'شركة الأمل', category: 'تقنية', status: 'active' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('شركة الأمل');
    vendorId = res.body.id;
  });

  test('POST /api/vendors rejects missing name', async () => {
    const res = await request(app).post('/api/vendors').send({ category: 'تقنية' });
    expect(res.status).toBe(400);
  });

  test('GET /api/vendors/:id returns vendor', async () => {
    const res = await request(app).get(`/api/vendors/${vendorId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(vendorId);
  });

  test('PUT /api/vendors/:id updates vendor', async () => {
    const res = await request(app).put(`/api/vendors/${vendorId}`).send({ name: 'شركة الأمل المحدودة', status: 'active' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('شركة الأمل المحدودة');
  });

  test('GET /api/vendors/:id returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/vendors/9999');
    expect(res.status).toBe(404);
  });

  test('DELETE /api/vendors/:id deletes vendor', async () => {
    const tmp = await request(app).post('/api/vendors').send({ name: 'مؤقت' });
    const res = await request(app).delete(`/api/vendors/${tmp.body.id}`);
    expect(res.status).toBe(200);
  });
});

// ── Beneficiaries ─────────────────────────────────────────
describe('Beneficiaries API', () => {
  let bId;

  test('POST /api/beneficiaries creates a beneficiary', async () => {
    const res = await request(app).post('/api/beneficiaries').send({ name: 'أحمد محمد', type: 'فرد' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('أحمد محمد');
    bId = res.body.id;
  });

  test('POST /api/beneficiaries rejects missing name', async () => {
    const res = await request(app).post('/api/beneficiaries').send({ type: 'فرد' });
    expect(res.status).toBe(400);
  });

  test('GET /api/beneficiaries returns list', async () => {
    const res = await request(app).get('/api/beneficiaries');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('PUT /api/beneficiaries/:id updates', async () => {
    const res = await request(app).put(`/api/beneficiaries/${bId}`).send({ name: 'أحمد علي', status: 'active' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('أحمد علي');
  });
});

// ── Services ──────────────────────────────────────────────
describe('Services API', () => {
  let vendorId, serviceId;

  beforeAll(async () => {
    const v = await request(app).post('/api/vendors').send({ name: 'مورد الخدمات', status: 'active' });
    vendorId = v.body.id;
  });

  test('POST /api/services creates a service', async () => {
    const res = await request(app).post('/api/services').send({
      name: 'صيانة شبكات', vendor_id: vendorId, unit_price: 500, unit: 'زيارة'
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('صيانة شبكات');
    serviceId = res.body.id;
  });

  test('POST /api/services rejects missing vendor', async () => {
    const res = await request(app).post('/api/services').send({ name: 'خدمة', unit_price: 100 });
    expect(res.status).toBe(400);
  });

  test('GET /api/services returns list', async () => {
    const res = await request(app).get('/api/services');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('GET /api/services?vendor_id= filters by vendor', async () => {
    const res = await request(app).get(`/api/services?vendor_id=${vendorId}`);
    expect(res.status).toBe(200);
    res.body.forEach(s => expect(s.vendor_id).toBe(vendorId));
  });

  test('PUT /api/services/:id updates service', async () => {
    const res = await request(app).put(`/api/services/${serviceId}`).send({
      name: 'صيانة شبكات محدّثة', vendor_id: vendorId, unit_price: 600, status: 'active'
    });
    expect(res.status).toBe(200);
    expect(res.body.unit_price).toBe(600);
  });
});

// ── Billing ───────────────────────────────────────────────
describe('Billing API', () => {
  let vendorId, serviceId, beneficiaryId, invoiceId;

  beforeAll(async () => {
    const v = await request(app).post('/api/vendors').send({ name: 'مورد الفواتير', status: 'active' });
    vendorId = v.body.id;
    const s = await request(app).post('/api/services').send({ name: 'استشارات', vendor_id: vendorId, unit_price: 1000, unit: 'ساعة' });
    serviceId = s.body.id;
    const b = await request(app).post('/api/beneficiaries').send({ name: 'شركة النهضة' });
    beneficiaryId = b.body.id;
  });

  test('POST /api/invoices creates an invoice', async () => {
    const res = await request(app).post('/api/invoices').send({
      beneficiary_id: beneficiaryId,
      items: [{ service_id: serviceId, quantity: 2 }]
    });
    expect(res.status).toBe(201);
    expect(res.body.total_amount).toBe(2000);
    invoiceId = res.body.id;
  });

  test('POST /api/invoices rejects empty items', async () => {
    const res = await request(app).post('/api/invoices').send({ beneficiary_id: beneficiaryId, items: [] });
    expect(res.status).toBe(400);
  });

  test('GET /api/invoices returns list', async () => {
    const res = await request(app).get('/api/invoices');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('GET /api/invoices/:id returns invoice with items', async () => {
    const res = await request(app).get(`/api/invoices/${invoiceId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(1);
  });

  test('PATCH /api/invoices/:id/status updates status to paid', async () => {
    const res = await request(app).patch(`/api/invoices/${invoiceId}/status`).send({ status: 'paid' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paid');
  });

  test('PATCH /api/invoices/:id/status rejects invalid status', async () => {
    const res = await request(app).patch(`/api/invoices/${invoiceId}/status`).send({ status: 'unknown' });
    expect(res.status).toBe(400);
  });

  test('GET /api/invoices/stats/summary returns stats', async () => {
    const res = await request(app).get('/api/invoices/stats/summary');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('vendorCount');
    expect(res.body).toHaveProperty('totalRevenue');
    expect(res.body.totalRevenue).toBeGreaterThan(0);
  });

  test('DELETE /api/invoices/:id deletes invoice', async () => {
    const res = await request(app).delete(`/api/invoices/${invoiceId}`);
    expect(res.status).toBe(200);
  });
});
