# mcp-logger

## Overview

`mcp-logger` is a Model Context Protocol (MCP) server and companion client
toolkit that captures structured log messages from browsers and Node.js
processes. It forwards those logs to MCP-aware tools (Claude, VS Code, Windsurf,
etc.), provides a live web dashboard, and keeps native console output intact for
local debugging.

## Goals

- Collect logs from many clients (browser or Node) and differentiate their
  sources.
- Preserve native `console.*` behavior while streaming structured entries to the
  MCP server.
- Offer real-time viewing (web UI + MCP logging notifications) and historical
  retrieval via fetch APIs.
- Support buffer clearing and named sessions so test runs are easy to diff.
- Stay transport-agnostic and open for community adoption.

## Feature Set

1. **MCP Logging Server** – stdio-compatible server with optional HTTP/WebSocket
   bridge, ring-buffer storage, and tool APIs (`push_log`, `fetch_logs`,
   `clear_logs`, `set_session`).
2. **Web Dashboard** – Vite-powered SPA served by the server for live log
   monitoring, filtering, and session control.
3. **Client Adapters** – Browser and Node helpers that wrap `console.log`, send
   structured payloads to the server, and retain native console output.
4. **Session & Client Tagging** – Each log includes `clientId` and `sessionId`
   metadata for filtering and grouping.
5. **Structured Schema** – Shared definitions for levels, payload shape, and
   validation logic to keep all packages in sync.

## Architecture

```
┌────────────────────────┐      ┌───────────────────────────┐
│ Browser Client         │      │ Node Client               │
│ @mcp-logger/browser    │      │ @mcp-logger/node          │
│ • console hook         │      │ • console hook            │
│ • HTTP/WebSocket push  │      │ • HTTP/WebSocket/stdio    │
└──────────┬─────────────┘      └──────────┬────────────────┘
           │                                │
           ▼                                ▼
      ┌────────────────────────────────────────────────────┐
      │ mcp-logger Server                                  │
      │ • MCP stdio transport                              │
      │ • HTTP + WebSocket endpoints                       │
      │ • Ring buffer + sessions                           │
      │ • Tools: push_log, fetch_logs, clear_logs,          │
      │   set_session                                      │
      │ • MCP logging notifications                        │
      └──────────┬────────────────────────────┬────────────┘
                 │                            │
                 ▼                            ▼
      ┌────────────────────┐        ┌──────────────────────┐
      │ Web Dashboard      │        │ MCP Clients (IDE, AI)│
      │ SSE / WebSocket    │        │ logging/fetch tools  │
      └────────────────────┘        └──────────────────────┘
```

## Server Components

- **Transport Layer** – stdio MCP interface plus optional HTTP server with
  WebSocket/SSE endpoints for browser clients and dashboard.
- **Ring Buffer Store** – Configurable in-memory circular buffer that stores
  logs, maintains cursors, and tracks dropped entries when capacity is
  exceeded.
- **Session Manager** – Issues `sessionId` tokens, records start/end metadata,
  and exposes session list to clients.
- **Tool Handlers**
  - `logging/push` – validate payload, stamp timestamp/sequence, place entry in
    buffer, and broadcast notifications.
  - `logging/fetch` – filter by level, client, session, time window, and return
    paginated results with a cursor.
  - `logging/clear` – reset buffer (optionally starting a new default session)
    and notify subscribers.
  - `logging/set-session` – create or rename a session scope and hand back the
    active `sessionId`.
- **Notification Dispatcher** – Emits MCP logging notifications and broadcasts
  to WebSocket/SSE subscribers.

## Data Model

```jsonc
{
  "id": "uuid",
  "timestamp": "ISO-8601 string",
  "sequence": 123456,
  "level": "trace|debug|info|warn|error|fatal",
  "clientId": "renderer-web",
  "sessionId": "run-48",
  "message": "Fog renderer ready",
  "data": { "module": "fog", "details": { "cells": 2048 } },
  "source": "browser-http"
}
```

## Logging Flow

1. Client adapter patches `console.*` and forwards structured payloads to the
   server.
2. Server validates payload, assigns sequence number, stores in ring buffer, and
   emits MCP notification + WebSocket update.
3. MCP clients (Claude, IDE) use `logging/fetch` to retrieve batches or stream
   live messages; dashboard updates in real time.
4. Users or automations call `logging/clear` / `logging/set-session` to reset or
   tag test runs, ensuring clean diffs between sessions.

## Client Adapters

- **Browser** (`@mcp-logger/browser`)
  - `attachLogger({ endpoint, clientId, sessionId?, levels?, enabled? })`.
  - Sends entries via Fetch batching; upgrades to WebSocket when available.
  - Falls back to XHR polling when neither Fetch nor WebSocket is present (ES5
    compatibility for IE11-era browsers).
  - Built output transpiled to ES5 (no optional chaining, arrow functions, etc.)
    so it can run in legacy engines.
  - Respects runtime feature flags so logging can be toggled without reload.
- **Node** (`@mcp-logger/node`)
  - Similar API; preserves stdout/stderr; optional hooks for unhandled
    rejections or custom metadata injectors.
- Both adapters ensure `clientId` defaults (hostname + PID or URL) while allowing
  explicit overrides for multi-client deployments.

## Web Dashboard

- Served at the server root with static assets built by Vite.
- Connects via SSE/WebSocket for live updates.
- UI features: level toggles, client/session filters, text search, timeline
  graph, clear/session buttons, JSON export, theme toggle.
- Uses MCP tool endpoints under the hood for destructive actions (clear, start
  session).

## Configuration

- Environment variables / config file
  - `LOG_BUFFER_SIZE` – maximum entries kept in memory.
  - `LOG_HTTP_PORT` – optional HTTP/WebSocket listener.
  - `LOG_AUTH_TOKEN` – bearer token required for remote pushes.
  - `LOG_PERSIST_PATH` (future) – directory for NDJSON archival.
- IDE auto-start (VS Code/Windsurf)
  - Add an entry under `mcpServers` pointing to `node packages/server/index.js`
    with the appropriate `cwd`.
- Optional npm scripts: `dev` (watch mode), `start` (prod server), `dashboard`
  (run web UI standalone).
  - `LOG_BROWSER_TARGET=es5` (build flag controlling Babel preset for legacy
    bundle).

## Local Development Without Workspaces

The repo now relies on plain npm with direct `file:` links instead of
workspaces. Use the project root scripts to keep package builds in sync:

```bash
npm install
npm run build:shared
npm run build:server
npm run build:browser
npm run build:node
npm run build:dashboard
```

The `npm run build` shortcut chains those commands in order. Each package can
also be built or tested in isolation via `npm run <script> --prefix
packages/<name>`.

## Roadmap

1. Scaffold repo (workspaces, linting, testing, GitHub workflows).
2. Implement shared schema utilities and unit tests.
3. Build server MVP (MCP stdio + HTTP/WebSocket, ring buffer, tool handlers).
4. Release browser & Node adapters with console hooking and transport logic.
5. Ship basic web dashboard (live table, filters, clear/session controls).
6. Add persistence/export, auth hooks, CLI utilities, and documentation.
7. Publish packages to npm and prepare GitHub release templates.

## Status

- Spec drafted – implementation in progress.
