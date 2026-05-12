# GitHub Pages Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a polished static landing page for ComfyUI Node Builder on GitHub Pages, with README links pointing to it.

**Architecture:** Create a standalone static site under `site/` so the hosted page is independent from the local Vue/Vite workbench and helper server. Add a GitHub Actions Pages workflow that stages `site/` plus existing screenshots into a Pages artifact, then deploys it from `main`.

**Tech Stack:** Static HTML/CSS, GitHub Actions, GitHub Pages, existing PNG screenshots, Markdown README/docs links.

---

### Task 1: Create Static Landing Page

**Files:**
- Create: `site/index.html`
- Create: `site/styles.css`

- [ ] **Step 1: Write the landing page HTML**

  Create `site/index.html` with:

  - nav links to GitHub, README, and wiki
  - hero section titled `ComfyUI Node Builder`
  - primary action linking to `https://github.com/caoool/comfyui-node-canvas/blob/main/docs/wiki/index.md`
  - secondary action linking to `https://github.com/caoool/comfyui-node-canvas`
  - screenshot image references to `polished-populated.png`, `polished-app.png`, and `final-look.png`
  - content sections for what it is, who should use it, feature highlights, workflow, managed deploy, and start-here links

- [ ] **Step 2: Write the landing page CSS**

  Create `site/styles.css` with responsive layout, dark product-workbench styling, restrained accent colors, screenshot framing, button styles, feature grids, and mobile-safe text wrapping.

- [ ] **Step 3: Verify local file references**

  Run: `rg -n "polished-populated|polished-app|final-look|docs/wiki|github.com/caoool" site`

  Expected: output shows screenshot references and GitHub/wiki links.

### Task 2: Add GitHub Pages Workflow

**Files:**
- Create: `.github/workflows/pages.yml`

- [ ] **Step 1: Write Pages workflow**

  Create a workflow that:

  - runs on pushes to `main` and manual dispatch
  - checks out the repo
  - configures Pages
  - creates `_site`
  - copies `site/.` into `_site/`
  - copies `polished-populated.png`, `polished-app.png`, `final-look.png`, and `initial-load.png` into `_site/`
  - uploads `_site` as a Pages artifact
  - deploys to GitHub Pages

- [ ] **Step 2: Verify workflow syntax markers**

  Run: `rg -n "actions/configure-pages|actions/upload-pages-artifact|actions/deploy-pages|_site|polished-populated" .github/workflows/pages.yml`

  Expected: output shows all required workflow steps and screenshot copy references.

### Task 3: Update README Link

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add live landing page link near top**

  Add this link after the opening project description:

  ```markdown
  **Live landing page:** <https://caoool.github.io/comfyui-node-canvas/>
  ```

- [ ] **Step 2: Verify README link**

  Run: `rg -n "Live landing page|caoool.github.io/comfyui-node-canvas" README.md`

  Expected: output shows the live landing page link.

### Task 4: Verify Static Site

**Files:**
- Read: `site/index.html`
- Read: `site/styles.css`
- Read: `.github/workflows/pages.yml`
- Read: `README.md`

- [ ] **Step 1: Check rough-draft markers**

  Run: `rg -n "lorem|ipsum|fill me|draft only|unfinished copy" site .github/workflows/pages.yml README.md`

  Expected: no output.

- [ ] **Step 2: Build staged Pages artifact locally**

  Run:

  ```bash
  tmpdir=$(mktemp -d /tmp/comfyui-node-canvas-pages.XXXXXX)
  cp -R site/. "$tmpdir/"
  cp polished-populated.png polished-app.png final-look.png initial-load.png "$tmpdir/"
  test -f "$tmpdir/index.html"
  test -f "$tmpdir/styles.css"
  test -f "$tmpdir/polished-populated.png"
  echo pages-artifact-ok
  ```

  Expected: `pages-artifact-ok`

- [ ] **Step 3: Run project tests**

  Run: `npm run test`

  Expected: Vitest exits with code 0.

### Task 5: Publish To GitHub

**Files:**
- Commit: `site/index.html`
- Commit: `site/styles.css`
- Commit: `.github/workflows/pages.yml`
- Commit: `README.md`
- Commit: `docs/wiki/*.md`
- Commit: `docs/superpowers/specs/2026-05-12-*.md`
- Commit: `docs/superpowers/plans/2026-05-12-*.md`
- Commit: `polished-populated.png`
- Commit: `polished-app.png`
- Commit: `final-look.png`
- Commit: `initial-load.png`

- [ ] **Step 1: Review status**

  Run: `git status --short`

  Expected: only intended documentation, landing page, workflow, and screenshot files are staged or untracked for this work; unrelated `.claude` changes stay unstaged.

- [ ] **Step 2: Stage intended files**

  Run:

  ```bash
  git add README.md \
    docs/wiki \
    docs/superpowers/specs/2026-05-12-readme-wiki-documentation-design.md \
    docs/superpowers/specs/2026-05-12-github-pages-landing-page-design.md \
    docs/superpowers/plans/2026-05-12-readme-wiki-documentation.md \
    docs/superpowers/plans/2026-05-12-github-pages-landing-page.md \
    site \
    .github/workflows/pages.yml \
    polished-populated.png polished-app.png final-look.png initial-load.png
  ```

- [ ] **Step 3: Commit**

  Run:

  ```bash
  git commit -m "docs: add landing page and wiki"
  ```

- [ ] **Step 4: Push main**

  Run:

  ```bash
  git push origin main
  ```

- [ ] **Step 5: Report GitHub Pages URL**

  Confirm the configured URL:

  ```text
  https://caoool.github.io/comfyui-node-canvas/
  ```
