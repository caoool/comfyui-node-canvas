# Project Structure

This page explains how the repository is organized and what the builder writes when it exports or deploys a pack.

## Repository Layout

```text
src/
  App.vue
  components/
  lib/
  stores/
  types/
server/
tests/
docs/
public/
```

Important areas:

- `src/components/`: Vue workbench panels, forms, toolbars, terminal, AI Builder, notifications, and code workspace.
- `src/stores/`: Pinia stores for project state and UI state.
- `src/lib/`: pack generation, Python generation, validation, deploy client, AI action parsing, terminal client, ComfyUI API client, and helper utilities.
- `server/`: Express helper server for local file writes, managed pack reads, dependency installation, node terminal commands, AI provider calls, and ComfyUI proxy/restart calls.
- `tests/`: Vitest unit and component tests.
- `docs/wiki/`: user-facing documentation.
- `docs/superpowers/`: design and implementation notes used during development.

## Frontend

The frontend is a Vue 3 and TypeScript app served by Vite. It uses Pinia for state and Monaco for code editing.

The core frontend responsibilities are:

- maintain the active project model
- render the node contract editor and preview
- build generated pack file previews
- validate projects before export or deploy
- send local actions to the helper server
- persist local project registry and UI settings in browser local storage

## Helper Server

The helper server is an Express app started by `npm run dev` or `npm run server`.

It listens on:

```text
http://127.0.0.1:3001
```

During development, Vite proxies frontend requests from `/helper/*` to the helper server.

The helper server handles actions that the browser cannot or should not perform directly:

- validate ComfyUI install paths
- write generated packs
- deploy managed packs
- remove stale generated files
- read `builder.project.json`
- list builder-owned packs
- install managed dependencies
- run pack terminal commands
- call AI providers
- fetch provider model lists
- ping ComfyUI
- request ComfyUI memory/free and restart endpoints

Sensitive endpoints are constrained to loopback origins and loopback ComfyUI URLs where applicable.

## Project Model

The builder project model includes:

- project name
- pack folder name
- ComfyUI URL
- ComfyUI install path
- nodes
- pack-level Python requirements
- pack-level install script
- shared custom files

Each node includes:

- name, display name, and category
- input ports
- output ports
- widgets
- Return UI outputs
- module code
- execute body or synced Python source
- return override settings
- optional custom UI renderer code

## Generated Pack Files

The pack builder can generate:

- one Python file per node, such as `ImageTransform.py`
- `__init__.py`
- `web/runtimeUiDisplays.js`
- `web/<NodeName>.customRenderer.js` for custom Return UI renderers
- `requirements.txt`
- `install.py`
- shared custom files
- `builder.project.json` for managed deploys

`Export ZIP` and direct deploy use the same pack file builder. Managed deploy adds `builder.project.json`.

## Builder Metadata

Managed packs include:

```text
builder.project.json
```

The metadata contains:

- builder identifier
- schema version
- complete editable project model

This is what lets the app load or import a deployed pack later. Without this metadata, the app treats a custom node pack as external.

## Local Storage

The browser stores:

- active project registry
- active project id
- layout dimensions
- AI provider settings

Clearing browser site data can remove local builder projects that have not been exported or deployed. For durable work, export ZIPs or deploy managed packs regularly.

## Safety Boundaries

The builder limits generated file writes to safe pack names and safe relative paths. It rejects parent directory traversal and reserved generated paths for custom files.

The helper server binds to loopback. ComfyUI proxy actions only accept loopback URLs, which reduces the risk of a browser page using the helper as a general network proxy.

## Tests

Run:

```bash
npm run test
```

The test suite covers key libraries, stores, server helpers, deployment behavior, generated pack files, validation, editor behavior, AI action parsing, and component workflows.
