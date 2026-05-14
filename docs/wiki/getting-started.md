# Getting Started

This guide takes you from a fresh clone to a running local ComfyUI Node Builder session.

## Prerequisites

You need:

- Node.js 22 or newer recommended.
- npm.
- A local browser.
- A local ComfyUI installation if you want direct deploy, load, scan, or restart behavior.
- ComfyUI Extension Manager if you want **Deploy & Restart** to request a ComfyUI restart automatically.

The app can still generate and export a ZIP without a configured ComfyUI install path. Direct deploy and load require a ComfyUI folder that contains `custom_nodes`.

## Install Dependencies

From the repository root:

```bash
npm install
```

This installs the Vue app, Vite, Vitest, Monaco editor integration, the Express helper server dependencies, and development tooling.

## Start The App

Run:

```bash
npm run dev
```

The script starts two processes:

- Vite frontend, usually reachable at `http://localhost:5173`
- local helper server at `http://127.0.0.1:3001`

In development, Vite proxies `/helper/*` requests to the helper server. That lets the browser use one frontend origin while the helper performs local file-system, terminal, AI, and ComfyUI requests.

## Open The Workbench

Open the Vite URL shown in your terminal. If the default port is available, it is usually:

```text
http://localhost:5173
```

The first screen is the workbench itself. There is no separate marketing or setup page inside the app. You can create a pack immediately, but direct deploy requires Settings.

## Configure Settings

Open Settings from the status bar.

Set:

- **Pack Name:** human-readable project name in the builder.
- **Pack Slug:** category and metadata slug for the active pack. It defaults to `ComfyUINodeBuilder/` so you can append a custom category path. Deploy mirrors each pack to `custom_nodes/ComfyUINodeBuilder/<pack slug>`.
- **ComfyUI URL:** usually `http://127.0.0.1:8188`.
- **ComfyUI Install Path:** local path to the ComfyUI repository or installation root, not the `custom_nodes` folder itself.

Use **Check ComfyUI** to verify the URL. Use **Check Install Path** to confirm that the install path contains `custom_nodes`.

Example install path:

```text
/home/you/ComfyUI
```

The deploy target for a pack named `MyNodes` would be:

```text
/home/you/ComfyUI/custom_nodes/MyNodes/
```

## Create Your First Pack

The toolbar includes pack controls:

- create a new pack
- switch active packs
- rename the active pack and its ComfyUI folder
- duplicate the active pack
- delete the active pack from the local builder workspace

The builder keeps a local project registry in browser local storage. A local pack exists in the browser until you export it, deploy it, or load it from a deployed builder-managed pack.

## Create Your First Node

In the **Nodes** panel:

1. Choose a template such as **Image Pass-through** or **Text Utility**.
2. Click **New**.
3. Select the node in the node list.
4. Use **Add to Node** to add inputs, outputs, widgets, or Return UI displays.
5. Edit the generated Python file in the code workspace.

For a detailed authoring walkthrough, continue with [Creating nodes](creating-nodes.md).

## Export Or Deploy

You have two main ways to get a pack into ComfyUI:

- **Export ZIP:** downloads a ZIP containing the generated pack files for manual installation.
- **Deploy & Restart:** writes the pack to the configured ComfyUI install path, installs dependencies when needed, requests a ComfyUI restart, and reports diagnostics.

Read [Deploying to ComfyUI](deploying-to-comfyui.md) before using direct deploy for the first time.

## Persistence Notes

The builder uses browser local storage for:

- local pack registry
- active pack selection
- UI layout dimensions
- AI Builder settings

Deploying writes a separate copy of the active builder project into `builder.project.json` inside the ComfyUI custom node pack. That deployed metadata is what lets the app load or import a builder-managed pack later.
