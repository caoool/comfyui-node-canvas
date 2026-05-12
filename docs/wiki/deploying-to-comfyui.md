# Deploying To ComfyUI

ComfyUI Node Builder supports two output paths: ZIP export and direct managed deploy.

## Export ZIP

Use **Export ZIP** when you want a portable pack archive or do not want the helper server to write into ComfyUI directly.

The ZIP contains the generated pack files. Install it manually by extracting it under:

```text
<ComfyUI install path>/custom_nodes/<pack-folder>/
```

Restart ComfyUI after installing or replacing Python custom node files.

## Direct Deploy

Use **Deploy & Restart** when Settings has a valid ComfyUI install path and URL.

Direct deploy writes the active pack to:

```text
<ComfyUI install path>/custom_nodes/<pack-folder>/
```

The deploy pipeline:

1. validates the active project
2. builds generated pack files
3. writes files through the helper server
4. removes stale generated Python, requirements, and generated web JavaScript files from the managed folder
5. installs dependencies when the pack has requirements or install script content
6. requests a ComfyUI restart
7. waits for ComfyUI to respond again
8. reports diagnostics in notifications and builder logs

## Required Settings

Direct deploy requires:

- **ComfyUI Install Path:** must contain a `custom_nodes` directory.
- **ComfyUI URL:** must be a loopback HTTP or HTTPS URL such as `http://127.0.0.1:8188`.
- **ComfyUI Folder:** the active pack folder name.

The helper server checks install paths before writing. ComfyUI proxy endpoints are limited to loopback URLs.

## Generated Pack Layout

A deployed builder pack can include:

```text
<pack-folder>/
  __init__.py
  builder.project.json
  NodeA.py
  NodeB.py
  requirements.txt
  install.py
  helpers.py
  web/
    runtimeUiDisplays.js
    NodeA.customRenderer.js
```

Not every pack has every file. Requirements, install scripts, custom files, and custom renderers are included only when the project uses them.

## Dependency Installation

If the pack includes requirements or an install script, the deploy pipeline asks the helper server to install dependencies for the managed pack. The helper runs against ComfyUI's Python environment when it can resolve it.

Use requirements for ordinary packages:

```text
numpy
opencv-python
```

Use install scripts for setup that cannot be expressed as pip requirements.

Dependency installation can fail for normal Python environment reasons: missing compilers, incompatible wheels, network failure, package conflicts, or a ComfyUI environment that does not expose the expected Python executable. Inspect the notification details and Builder Output logs.

## Restart Behavior

ComfyUI must reload Python custom nodes after generated Python changes. The builder requests restart through ComfyUI Extension Manager support. If restart is unavailable or times out, deploy may still have written files successfully.

When restart status is unknown:

1. Check the notification details for the path and files written.
2. Restart ComfyUI manually.
3. Refresh the ComfyUI browser tab.
4. Search for the node category and display name in ComfyUI.

## Loading A Managed Pack

Settings includes **Load Pack from ComfyUI** for the active pack folder. This reads:

```text
<ComfyUI install path>/custom_nodes/<active-pack-folder>/builder.project.json
```

Loading replaces the current local builder copy for that same pack. The UI requires an acknowledgement because local unsaved builder changes can be overwritten.

## Importing Discovered Packs

Settings can scan `custom_nodes` for builder-owned packs. A builder-owned pack is one with valid `builder.project.json` metadata.

Use **Scan Packs**, then **Import** the pack you want. Importing creates or replaces a local builder workspace from the deployed metadata.

## When To Use Each Path

Use **Export ZIP** when:

- you want to review files before installing
- you are sharing a pack
- ComfyUI is on another machine
- you do not want direct file writes

Use **Deploy & Restart** when:

- ComfyUI is local
- you are iterating quickly
- you want the builder to keep the deployed metadata current
- you want dependency installation and restart requests in one flow
