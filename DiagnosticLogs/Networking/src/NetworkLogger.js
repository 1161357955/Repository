'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');
const Logger = require('./logger');

/**
 * NetworkLogger – patches Node's built-in http/https modules to capture
 * every outbound request and its response for diagnostic purposes.
 *
 * Usage:
 *   const { NetworkLogger } = require('./NetworkLogger');
 *   const logger = new NetworkLogger();
 *   logger.enable();
 *   // … make HTTP calls …
 *   logger.disable();
 *   const summary = logger.getSummary();
 */
class NetworkLogger {
  /**
   * @param {object} [options]  Forwarded to the underlying Logger instance.
   */
  constructor(options = {}) {
    this._log = new Logger(options);
    this._records = [];
    this._enabled = false;
    this._origHttpRequest  = null;
    this._origHttpsRequest = null;
  }

  // ─── public API ────────────────────────────────────────────────────────────

  /** Start intercepting outbound requests. */
  enable() {
    if (this._enabled) return;
    this._enabled = true;
    this._origHttpRequest  = http.request;
    this._origHttpsRequest = https.request;
    http.request  = this._wrap(http.request.bind(http),  'http');
    https.request = this._wrap(https.request.bind(https), 'https');
    this._log.info('NetworkLogger enabled – intercepting HTTP/HTTPS requests');
  }

  /** Stop intercepting and restore original request functions. */
  disable() {
    if (!this._enabled) return;
    this._enabled = false;
    if (this._origHttpRequest)  http.request  = this._origHttpRequest;
    if (this._origHttpsRequest) https.request = this._origHttpsRequest;
    this._origHttpRequest  = null;
    this._origHttpsRequest = null;
    this._log.info('NetworkLogger disabled – original request functions restored');
  }

  /** Return a copy of all captured request records. */
  getRecords() {
    return [...this._records];
  }

  /** Return aggregate statistics for all captured requests. */
  getSummary() {
    const total   = this._records.length;
    const errors  = this._records.filter(r => r.error).length;
    const byStatus = {};
    for (const r of this._records) {
      if (r.statusCode != null) {
        byStatus[r.statusCode] = (byStatus[r.statusCode] || 0) + 1;
      }
    }
    const latencies = this._records
      .filter(r => r.durationMs != null)
      .map(r => r.durationMs);
    const avgLatencyMs = latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;

    return { total, errors, byStatus, avgLatencyMs };
  }

  /** Clear captured records. */
  clearRecords() {
    this._records = [];
  }

  // ─── internal ──────────────────────────────────────────────────────────────

  _wrap(originalFn, scheme) {
    const self = this;
    return function wrappedRequest(input, options, callback) {
      // Normalise arguments – Node accepts (url, [options], [callback])
      //   or (options, [callback]).
      let urlStr;
      try {
        if (typeof input === 'string' || input instanceof URL) {
          urlStr = input.toString();
        } else if (input && typeof input === 'object') {
          const host = input.hostname || input.host || 'unknown';
          const port = input.port ? `:${input.port}` : '';
          const p    = input.path || '/';
          urlStr = `${scheme}://${host}${port}${p}`;
        }
      } catch (_) {
        urlStr = '(unparseable url)';
      }

      const method = (
        (typeof options === 'object' && options && options.method) ||
        (typeof input   === 'object' && input   && input.method)   ||
        'GET'
      ).toUpperCase();

      const record = {
        id:         self._records.length + 1,
        scheme,
        method,
        url:        urlStr,
        startedAt:  new Date().toISOString(),
        statusCode: null,
        durationMs: null,
        error:      null,
      };
      self._records.push(record);

      self._log.debug('Request started', { id: record.id, method, url: urlStr });

      const startTime = Date.now();

      const req = originalFn(input, options, callback);

      req.on('response', (res) => {
        record.statusCode = res.statusCode;
        record.durationMs = Date.now() - startTime;
        self._log.info('Response received', {
          id:         record.id,
          url:        urlStr,
          statusCode: res.statusCode,
          durationMs: record.durationMs,
        });
      });

      req.on('error', (err) => {
        record.error      = err.message;
        record.durationMs = Date.now() - startTime;
        self._log.error('Request error', {
          id:         record.id,
          url:        urlStr,
          error:      err.message,
          durationMs: record.durationMs,
        });
      });

      return req;
    };
  }
}

module.exports = { NetworkLogger };
