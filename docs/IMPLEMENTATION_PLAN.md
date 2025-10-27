# Implementation Plan

This plan reflects the ES5-compatible browser target and the separation of concerns
outlined in the project specification.

## 1. Repository Setup

1. Initialize workspace tooling
   - Configure npm (or pnpm) workspaces for `packages/shared`, `packages/server`,
     `packages/browser-client`, `packages/node-client`, and `packages/dashboard`.
   - Create root-level scripts: `lint`, `test`, `build`, `format` (ESLint + Prettier
     with JavaScript only).
2. Establish baseline configs
   - `.editorconfig`, `.eslintignore`, `.prettierignore`.
   - Add Babel config for ES5 builds in browser client (`@babel/preset-env` with
     `targets: { ie: "11" }`).
3. Set up GitHub workflow placeholders (lint/test) for future CI.

## 2. Shared Package (`packages/shared`)

1. Create modules
   - `logLevels.js` — enum + helper to compare log severity.
   - `schema.js` — manual validation helpers (`validateLogPayload`,
     `validateFetchOptions`).
   - `id.js` — UUID generation (dependency-free or small helper) and sequence
     management.
   - `time.js` — ISO timestamp helpers.
   - `serialization.js` — canonical JSON stringify, NDJSON export utilities.
2. Unit tests covering validation, serialization, and helper functions.
3. Export aggregated API via `index.js` for easy consumption.

## 3. Server Package (`packages/server`)

### 3.1 Core Infrastructure

1. `config.js`
   - Parse env vars: `LOG_BUFFER_SIZE`, `LOG_HTTP_PORT`, `LOG_AUTH_TOKEN`,
     `LOG_BROWSER_TARGET` (for cross-package builds).
   - Provide default values and simple schema validation.
2. `ringBuffer.js`
   - Implement circular buffer with `append(entry)`,
     `read({ cursor, limit, filters })`, `clear()`, and `stats()`.
   - Track sequence numbers and dropped entry count.
3. `sessionManager.js`
   - Manage current session metadata, `startSession(label?)`, `getSessions()`, and
     default session initialization.

### 3.2 Transports & Interfaces

1. `transports/stdio.js`
   - Initialize MCP server via official SDK.
   - Register tool handlers (`push_log`, `fetch_logs`, `clear_logs`, `set_session`).
   - Wire logging notifications to stored buffer events.
2. `transports/http.js`
   - Optional express-like HTTP server
     - POST `/push` (expects auth token if configured).
     - GET `/events` for SSE.
     - WebSocket `/ws` for live stream + client commands (clear/session).
   - Use shared schema validation before writing to buffer.
3. `broadcaster.js`
   - Subscribe to buffer events (append/clear/session change) and fan out to
     WebSocket/SSE clients + MCP notifications.
4. `auth.js`
   - Middleware to enforce optional bearer token on HTTP/WebSocket transports.

### 3.3 Tool Handlers (`packages/server/src/tools`)

1. `pushLog.js`
   - Validate payload using shared schema.
   - Assign sequence/timestamp if missing.
   - Append to buffer; emit notification via broadcaster.
2. `fetchLogs.js`
   - Parse filters (levels, clientId, sessionId, since, limit, cursor).
   - Return entries and next cursor.
3. `clearLogs.js`
   - Invoke buffer `clear()` and sessionManager `startSession()` (new default).
   - Broadcast clear event.
4. `setSession.js`
   - Call `sessionManager.startSession(label)` and return session metadata.

### 3.4 Startup (`index.js`)

1. Load config, initialize buffer + session manager.
2. Instantiate transports (stdio always; HTTP/WebSocket if enabled).
3. Wire broadcaster across components.
4. Graceful shutdown handling (SIGINT/SIGTERM).

### 3.5 Testing

1. Unit tests for ring buffer, session manager, and tool handlers.
2. Integration test: spin up server, mock STDIO client, HTTP push, WebSocket
   listener, ensure entries propagate.

## 4. Browser Client (`packages/browser-client`)

### 4.1 Core Modules

1. `consolePatch.js`
   - Wrap `console.log/info/warn/error` preserving originals.
   - Provide `patch()` and `restore()` functions.
2. `transportFetch.js`
   - Send batched logs via `fetch`; fallback to XHR when unavailable.
   - Support queue flush interval, retry with backoff.
3. `transportWebSocket.js`
   - Optional upgrade when WS available; keep connection alive (heartbeat).
4. `queue.js`
   - Buffer outgoing entries; flush using active transport.
5. `session.js`
   - Manage session association (request new session ID from server if needed).
6. `index.js`
   - Export `attachLogger(options)` / `detachLogger()` / `setSession(label)`.
   - Options include `endpoint`, `clientId`, `levels`, `enabled`, `useWebSocket`.

### 4.2 ES5 Build

1. Babel transpilation to ES5 target using `@babel/preset-env` with IE11 target.
2. Bundle (Rollup or Vite library mode) producing UMD build for script-tag usage.
3. Provide docs on including polyfills when required (e.g., Promise).

### 4.3 Testing

1. Unit tests (run in headless browser environment) for console patch.
2. Mock transport tests verifying fallback to XHR when `fetch` missing.

## 5. Node Client (`packages/node-client`)

1. Core modules mirroring browser client but using Node HTTP libraries.
2. Optional integration with MCP stdio if running inside server process.
3. Tests ensuring metadata, retry logic, and error hooks behave.

## 6. Dashboard (`packages/dashboard`)

1. Vite setup with plain JS.
2. Components: log table, filter controls, session panel.
3. Services: `logStream.js` (WebSocket/SSE), `api.js` (hits MCP tools).
4. Build script that outputs static assets consumed by server HTTP transport.
5. Tests covering data store reducers and basic component rendering (optional).

## 7. Documentation & Examples

1. Update README with usage examples for Node and browser clients.
2. Create `examples/` directory with minimal browser page and Node script using
   the adapters.
3. Add guide for VS Code/Windsurf MCP configuration.

## 8. Release Preparation

1. Ensure all packages have `package.json` metadata (name, version, exports).
2. Configure publishing scripts (`npm publish --workspace ...`).
3. Draft CHANGELOG template and contribution guidelines.
4. Tag initial release once MVP complete.
