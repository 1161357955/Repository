'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const { db } = require('./src/database');

const buildVendorsRouter = require('./src/routes/vendors');
const buildBeneficiariesRouter = require('./src/routes/beneficiaries');
const buildServicesRouter = require('./src/routes/services');
const buildBillingRouter = require('./src/routes/billing');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/vendors', buildVendorsRouter(db));
app.use('/api/beneficiaries', buildBeneficiariesRouter(db));
app.use('/api/services', buildServicesRouter(db));
app.use('/api/invoices', buildBillingRouter(db));

// Catch-all: serve the SPA
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Falak platform running on http://localhost:${PORT}`);
  });
}

module.exports = app;
