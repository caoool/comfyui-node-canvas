# ComfyUI Node Builder Wiki

This wiki is the detailed user guide for ComfyUI Node Builder. Start here if you want to install the app, understand the workbench, create a node, deploy a pack, or troubleshoot a local ComfyUI setup.

## Recommended Reading Order

1. [Getting started](getting-started.md) - install dependencies, run the app, connect it to ComfyUI, and create your first pack.
2. [Using the workbench](using-the-workbench.md) - learn the main panels, controls, terminal, notifications, and AI Builder.
3. [Creating nodes](creating-nodes.md) - design node contracts, edit Python, use Return UI, manage dependencies, and validate a pack.
4. [Deploying to ComfyUI](deploying-to-comfyui.md) - export ZIPs, deploy directly, restart ComfyUI, and load builder-managed packs.
5. [Project structure](project-structure.md) - understand the repository, generated pack files, helper server, and metadata.
6. [Troubleshooting](troubleshooting.md) - diagnose common setup, validation, deploy, restart, dependency, and AI issues.

## What The Builder Owns

ComfyUI Node Builder is designed around builder-owned packs. A builder-owned pack contains `builder.project.json`, which records the editable project model. That file lets the app reload the pack later and keep the visual contract, Python source, dependency files, and generated files aligned.

The builder does not claim to reverse-engineer arbitrary third-party custom node packs. You can add shared files and edit node Python inside the workbench, but reliable round-trip editing depends on the builder metadata.

## Common Paths

Development app:

```text
http://localhost:5173
```

Helper server:

```text
http://127.0.0.1:3001
```

Managed ComfyUI pack:

```text
<ComfyUI install path>/custom_nodes/<pack-folder>/
```

Builder metadata inside a deployed pack:

```text
builder.project.json
```

## Quick Task Map

- To make your first node, read [Getting started](getting-started.md), then [Creating nodes](creating-nodes.md).
- To understand the UI, read [Using the workbench](using-the-workbench.md).
- To install generated nodes into ComfyUI, read [Deploying to ComfyUI](deploying-to-comfyui.md).
- To understand what gets written to disk, read [Project structure](project-structure.md).
- To debug a broken setup, read [Troubleshooting](troubleshooting.md).
