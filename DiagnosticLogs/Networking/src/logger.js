'use strict';

const fs = require('fs');
const path = require('path');

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

/**
 * Simple file + console logger with optional log-level filtering.
 */
class Logger {
  /**
   * @param {object} [options]
   * @param {string} [options.logDir]   Directory where log files are written.
   * @param {string} [options.filename] Base filename (default: 'network.log').
   * @param {string} [options.level]    Minimum level to log (default: 'DEBUG').
   * @param {boolean} [options.console] Whether to also write to stdout (default: true).
   */
  constructor(options = {}) {
    this.logDir = options.logDir || path.join(__dirname, '..', 'logs');
    this.filename = options.filename || 'network.log';
    this.minLevel = LOG_LEVELS[String(options.level || 'DEBUG').toUpperCase()] ?? 0;
    this.toConsole = options.console !== false;

    fs.mkdirSync(this.logDir, { recursive: true });
    this.logPath = path.join(this.logDir, this.filename);
  }

  _write(level, message, meta) {
    if (LOG_LEVELS[level] < this.minLevel) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(meta && Object.keys(meta).length ? { meta } : {}),
    };

    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(this.logPath, line, 'utf8');
    if (this.toConsole) {
      process.stdout.write(line);
    }
  }

  debug(message, meta) { this._write('DEBUG', message, meta); }
  info(message, meta)  { this._write('INFO',  message, meta); }
  warn(message, meta)  { this._write('WARN',  message, meta); }
  error(message, meta) { this._write('ERROR', message, meta); }
}

module.exports = Logger;
