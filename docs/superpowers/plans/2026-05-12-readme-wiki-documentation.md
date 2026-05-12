# README And Wiki Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a polished README and a detailed wiki-style guide for using ComfyUI Node Builder.

**Architecture:** Keep the README as the public project overview and move procedural depth into focused `docs/wiki/` pages. Cross-link all docs so a new user can start from the README, complete setup, author a node, deploy to ComfyUI, and troubleshoot common failures.

**Tech Stack:** Markdown documentation for a Vue 3, TypeScript, Vite, Express, Pinia, Monaco, and ComfyUI helper-server application.

---

### Task 1: Rewrite The README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the template README**

  Write a polished project overview with these sections:

  - project title and concise value proposition
  - screenshot reference
  - what the project does
  - who should use it
  - feature highlights
  - quick start
  - basic workflow
  - managed pack deployment
  - deeper documentation links
  - development commands
  - limitations

- [ ] **Step 2: Verify link targets**

  Run: `rg -n "docs/wiki|polished-populated|npm run|ComfyUI" README.md`

  Expected: output contains links to the wiki docs, command references, and project-specific ComfyUI copy.

### Task 2: Add Wiki Navigation

**Files:**
- Create: `docs/wiki/index.md`

- [ ] **Step 1: Create a documentation index**

  Include a short description of each wiki page and a recommended reading order for first-time users.

- [ ] **Step 2: Verify page links**

  Run: `rg -n "\\.md\\)" docs/wiki/index.md`

  Expected: output lists every page in the wiki set.

### Task 3: Add Setup And Usage Guides

**Files:**
- Create: `docs/wiki/getting-started.md`
- Create: `docs/wiki/using-the-workbench.md`
- Create: `docs/wiki/creating-nodes.md`

- [ ] **Step 1: Write setup guide**

  Cover prerequisites, `npm install`, `npm run dev`, the browser app, helper server, ComfyUI URL, install path, first pack, and persistence behavior.

- [ ] **Step 2: Write workbench guide**

  Cover the toolbar, pack switcher, node library, contract sidebar, preview panel, code workspace, status bar, notifications, terminal, and AI Builder.

- [ ] **Step 3: Write node authoring guide**

  Cover templates, inputs, outputs, widgets, Return UI, generated Python, full-file editing, dependencies, custom files, and validation.

### Task 4: Add Deployment And Maintenance Guides

**Files:**
- Create: `docs/wiki/deploying-to-comfyui.md`
- Create: `docs/wiki/project-structure.md`
- Create: `docs/wiki/troubleshooting.md`

- [ ] **Step 1: Write deployment guide**

  Cover Export ZIP, Deploy & Restart, managed pack folder layout, dependency installation, restart requirements, loading a pack from ComfyUI, and importing discovered packs.

- [ ] **Step 2: Write project structure guide**

  Cover repository layout, generated pack layout, helper server responsibilities, metadata, local storage, and safety boundaries.

- [ ] **Step 3: Write troubleshooting guide**

  Cover install path failures, ComfyUI connection failures, validation blocks, deploy/restart failures, dependency installation, missing generated nodes, local storage, and AI/provider issues.

### Task 5: Documentation Verification

**Files:**
- Read: `README.md`
- Read: `docs/wiki/*.md`

- [ ] **Step 1: Check Markdown links**

  Run: `rg -n "\\[[^\\]]+\\]\\([^)]+" README.md docs/wiki`

  Expected: all local links point to files created in this plan or existing screenshots.

- [ ] **Step 2: Check for rough-draft markers**

  Run: `rg -n "lorem|ipsum|fill me|draft only" README.md docs/wiki`

  Expected: no output.

- [ ] **Step 3: Check repository status**

  Run: `git status --short`

  Expected: changed files include `README.md`, this plan/spec, and the new `docs/wiki/` pages, plus any unrelated pre-existing user changes.
