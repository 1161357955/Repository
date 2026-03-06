'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'falak.db');

function createDb(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS vendors (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      email       TEXT,
      phone       TEXT,
      address     TEXT,
      category    TEXT,
      status      TEXT    NOT NULL DEFAULT 'active',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS beneficiaries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      email       TEXT,
      phone       TEXT,
      address     TEXT,
      type        TEXT,
      status      TEXT    NOT NULL DEFAULT 'active',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS services (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      description TEXT,
      vendor_id   INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
      unit_price  REAL    NOT NULL DEFAULT 0,
      unit        TEXT,
      status      TEXT    NOT NULL DEFAULT 'active',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number  TEXT    NOT NULL UNIQUE,
      beneficiary_id  INTEGER NOT NULL REFERENCES beneficiaries(id) ON DELETE RESTRICT,
      issue_date      TEXT    NOT NULL DEFAULT (date('now')),
      due_date        TEXT,
      status          TEXT    NOT NULL DEFAULT 'pending',
      notes           TEXT,
      total_amount    REAL    NOT NULL DEFAULT 0,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id  INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      service_id  INTEGER NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
      quantity    REAL    NOT NULL DEFAULT 1,
      unit_price  REAL    NOT NULL,
      total       REAL    GENERATED ALWAYS AS (quantity * unit_price) STORED
    );
  `);

  return db;
}

const db = createDb(DB_PATH);

module.exports = { db, createDb };
