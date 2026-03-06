# DiagnosticLogs / Networking

A lightweight Node.js module that intercepts outbound HTTP/HTTPS requests and
writes structured JSON diagnostic logs to disk.

## Features

- **Zero external dependencies** – built entirely on Node.js core modules.
- Patches `http.request` and `https.request` at runtime; easily toggled on/off.
- Captures method, URL, status code, latency (ms) and errors for every request.
- Writes newline-delimited JSON (NDJSON) log files to a configurable directory.
- Exposes aggregate statistics via `getSummary()`.

## Directory layout

```
DiagnosticLogs/Networking/
├── src/
│   ├── index.js          # Public entry-point (re-exports all classes)
│   ├── NetworkLogger.js  # HTTP/HTTPS interceptor
│   └── logger.js         # Low-level file + console logger
├── tests/
│   ├── logger.test.js
│   └── NetworkLogger.test.js
├── logs/                 # Default log output directory (git-ignored)
└── package.json
```

## Quick start

```js
const { NetworkLogger } = require('./src');

const logger = new NetworkLogger({
  logDir:  './DiagnosticLogs/Networking/logs',
  level:   'INFO',    // DEBUG | INFO | WARN | ERROR
  console: true,      // also print to stdout
});

logger.enable();

// … your application makes HTTP/HTTPS calls here …

logger.disable();

console.log(logger.getSummary());
// { total: 5, errors: 0, byStatus: { '200': 4, '404': 1 }, avgLatencyMs: 42 }
```

## API

### `new NetworkLogger(options?)`

| Option      | Type    | Default           | Description |
|-------------|---------|-------------------|-------------|
| `logDir`    | string  | `./logs`          | Directory for log files |
| `filename`  | string  | `network.log`     | Log file name |
| `level`     | string  | `'DEBUG'`         | Minimum level (`DEBUG`/`INFO`/`WARN`/`ERROR`) |
| `console`   | boolean | `true`            | Also write entries to stdout |

### Methods

| Method | Description |
|--------|-------------|
| `enable()` | Start intercepting outbound requests |
| `disable()` | Stop intercepting; restore original functions |
| `getRecords()` | Return a copy of all captured request records |
| `getSummary()` | Return aggregate stats `{ total, errors, byStatus, avgLatencyMs }` |
| `clearRecords()` | Empty the in-memory records list |

## Running tests

```bash
cd DiagnosticLogs/Networking
npm test
```

## Log format (NDJSON)

Each line in the log file is a valid JSON object:

```json
{"timestamp":"2026-03-06T01:00:00.000Z","level":"INFO","message":"Response received","meta":{"id":1,"url":"https://api.example.com/orders","statusCode":200,"durationMs":87}}
```
