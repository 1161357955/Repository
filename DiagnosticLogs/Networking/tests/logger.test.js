'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');

const Logger = require('../src/logger');

describe('Logger', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-logger-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates the log directory if it does not exist', () => {
    const logDir = path.join(tmpDir, 'new-dir');
    new Logger({ logDir, console: false });
    assert.ok(fs.existsSync(logDir), 'log directory should be created');
  });

  it('writes a JSON entry for each log call', () => {
    const logDir  = path.join(tmpDir, 'write-test');
    const logger  = new Logger({ logDir, console: false });
    logger.info('hello world');

    const content = fs.readFileSync(path.join(logDir, 'network.log'), 'utf8');
    const entry   = JSON.parse(content.trim().split('\n')[0]);
    assert.equal(entry.level,   'INFO');
    assert.equal(entry.message, 'hello world');
    assert.ok(entry.timestamp,  'timestamp should be present');
  });

  it('includes meta fields in the log entry', () => {
    const logDir = path.join(tmpDir, 'meta-test');
    const logger = new Logger({ logDir, console: false });
    logger.warn('test warning', { code: 42, reason: 'demo' });

    const content = fs.readFileSync(path.join(logDir, 'network.log'), 'utf8');
    const entry   = JSON.parse(content.trim());
    assert.equal(entry.meta.code,   42);
    assert.equal(entry.meta.reason, 'demo');
  });

  it('respects the minimum log level', () => {
    const logDir = path.join(tmpDir, 'level-test');
    const logger = new Logger({ logDir, console: false, level: 'WARN' });
    logger.debug('should be suppressed');
    logger.info('also suppressed');
    logger.warn('this should appear');

    const logFile = path.join(logDir, 'network.log');
    const content = fs.readFileSync(logFile, 'utf8').trim();
    const entries = content.split('\n').map(l => JSON.parse(l));
    assert.equal(entries.length, 1);
    assert.equal(entries[0].level, 'WARN');
  });

  it('uses a custom filename when specified', () => {
    const logDir   = path.join(tmpDir, 'filename-test');
    const filename = 'custom.log';
    const logger   = new Logger({ logDir, filename, console: false });
    logger.error('boom');

    assert.ok(fs.existsSync(path.join(logDir, filename)), 'custom log file should exist');
  });
});
