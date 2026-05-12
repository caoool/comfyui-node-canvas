# GitHub Pages Landing Page Design

Date: 2026-05-12

## Goal

Add a polished public landing page for ComfyUI Node Builder, publish it with GitHub Pages, and update the README so visitors can open the live page before reading the detailed documentation.

## Approved Direction

Use the selected "Product Launch Hero" direction:

- first viewport led by the product name and a concise value proposition
- real workbench screenshots as primary visual proof
- clear calls to action for the GitHub repository and the wiki starting point
- follow-up sections that explain what the project is, who it is for, the authoring workflow, deployment model, and where to start

## Hosting Approach

Use GitHub Pages from this repository at:

```text
https://caoool.github.io/comfyui-node-canvas/
```

Implement the landing page as a static site in `site/` and deploy it with a GitHub Actions Pages workflow. Keep it separate from the local Vite workbench app so the hosted marketing/docs page does not need the loopback helper server and does not change local app startup behavior.

The workflow will build a Pages artifact from `site/` and copy the existing screenshot assets into that artifact.

## Landing Page Content

The page should include:

- navigation with links to GitHub, README, and wiki
- hero section with product title, concise description, quick proof points, and screenshot
- screenshot gallery using existing project screenshots
- "What it is" explanation
- "Who should use it" audience section
- feature highlights
- authoring workflow steps
- managed deploy explanation
- final "start here" section linking to the wiki index

## README Update

Add a visible live-site link near the top of `README.md`:

```text
Live landing page: https://caoool.github.io/comfyui-node-canvas/
```

Keep the existing detailed README and wiki links.

## Out Of Scope

Do not convert the full Vue workbench into a hosted app. The workbench remains a local development tool because deploy, terminal, helper-server, and ComfyUI restart behavior require local loopback access.

Do not move screenshots or rewrite the existing wiki content unless a link target needs to be added.
