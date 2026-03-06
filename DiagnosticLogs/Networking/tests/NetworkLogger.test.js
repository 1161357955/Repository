'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http   = require('http');
const https  = require('https');
const net    = require('net');
const os     = require('os');
const fs     = require('fs');
const path   = require('path');

const { NetworkLogger } = require('../src/NetworkLogger');

// ── helper: create a tiny HTTP server on a random port ──────────────────────
function createTestServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

describe('NetworkLogger', () => {
  let logDir;
  let netLogger;

  beforeEach(() => {
    logDir    = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-netlog-'));
    netLogger = new NetworkLogger({ logDir, console: false });
  });

  afterEach(() => {
    netLogger.disable();
    fs.rmSync(logDir, { recursive: true, force: true });
  });

  it('starts disabled and does not patch http.request', () => {
    const original = http.request;
    netLogger.enable();
    assert.notEqual(http.request, original, 'http.request should be patched after enable()');
    netLogger.disable();
    assert.equal(http.request, original, 'http.request should be restored after disable()');
  });

  it('records a successful request', async () => {
    const { server, port } = await createTestServer((_req, res) => {
      res.writeHead(200);
      res.end('ok');
    });

    netLogger.enable();

    await new Promise((resolve, reject) => {
      const req = http.request(`http://127.0.0.1:${port}/health`, (res) => {
        res.resume();
        res.on('end', resolve);
      });
      req.on('error', reject);
      req.end();
    });

    server.close();

    const records = netLogger.getRecords();
    assert.equal(records.length, 1);
    assert.equal(records[0].statusCode, 200);
    assert.equal(records[0].method, 'GET');
    assert.ok(records[0].url.includes('/health'));
    assert.ok(records[0].durationMs >= 0);
    assert.equal(records[0].error, null);
  });

  it('records a connection error', async () => {
    // Find a port nothing is listening on.
    const freePort = await new Promise((resolve) => {
      const srv = net.createServer();
      srv.listen(0, '127.0.0.1', () => {
        const p = srv.address().port;
        srv.close(() => resolve(p));
      });
    });

    netLogger.enable();

    await new Promise((resolve) => {
      const req = http.request(`http://127.0.0.1:${freePort}/`, () => {});
      req.on('error', () => resolve());
      req.end();
    });

    const records = netLogger.getRecords();
    assert.equal(records.length, 1);
    assert.ok(records[0].error, 'error field should be populated');
  });

  it('getSummary returns correct aggregate data', async () => {
    const { server, port } = await createTestServer((_req, res) => {
      res.writeHead(201);
      res.end();
    });

    netLogger.enable();

    const makeRequest = () =>
      new Promise((resolve, reject) => {
        const req = http.request(`http://127.0.0.1:${port}/`, (res) => {
          res.resume();
          res.on('end', resolve);
        });
        req.on('error', reject);
        req.end();
      });

    await makeRequest();
    await makeRequest();

    server.close();

    const summary = netLogger.getSummary();
    assert.equal(summary.total,          2);
    assert.equal(summary.errors,         0);
    assert.equal(summary.byStatus[201],  2);
    assert.ok(summary.avgLatencyMs >= 0);
  });

  it('clearRecords empties the records list', async () => {
    const { server, port } = await createTestServer((_req, res) => {
      res.writeHead(200);
      res.end();
    });

    netLogger.enable();

    await new Promise((resolve, reject) => {
      const req = http.request(`http://127.0.0.1:${port}/`, (res) => {
        res.resume();
        res.on('end', resolve);
      });
      req.on('error', reject);
      req.end();
    });

    server.close();

    assert.equal(netLogger.getRecords().length, 1);
    netLogger.clearRecords();
    assert.equal(netLogger.getRecords().length, 0);
  });

  it('does not double-patch when enable() is called twice', () => {
    netLogger.enable();
    const patched = http.request;
    netLogger.enable(); // second call – should be a no-op
    assert.equal(http.request, patched, 'http.request should not be re-wrapped');
  });
});
