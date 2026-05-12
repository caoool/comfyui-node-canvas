# README And Wiki Documentation Design

Date: 2026-05-12

## Goal

Replace the default Vue/Vite README with a polished, detailed project introduction, then add wiki-style documentation that explains how to use ComfyUI Node Builder from setup through deployment.

## Audience

The primary audience is ComfyUI users who want to build custom nodes without hand-assembling every Python class, mapping, frontend display hook, dependency file, and deployment step. The secondary audience is developers evaluating the repository before contributing or adapting it.

## README Shape

The README should work as the public front page for the project. It should explain:

- what the project is: a local Vue/Vite workbench for creating ComfyUI custom node packs
- who should use it: ComfyUI node authors, workflow builders, Python developers, and AI-assisted prototypers
- what it does: node templates, contract editing, generated Python, pack files, requirements, install scripts, Return UI, export, deploy, restart, terminal checks, and AI-assisted actions
- how to start it locally with `npm install` and `npm run dev`
- how the managed pack workflow writes to `<ComfyUI>/custom_nodes/<pack-folder>/`
- where deeper documentation lives

The README should stay polished and scannable rather than becoming the only guide.

## Wiki Documentation Shape

Add a `docs/wiki/` documentation set:

- `index.md`: navigation and recommended reading order
- `getting-started.md`: prerequisites, install, run, connect to ComfyUI, first pack
- `using-the-workbench.md`: main UI areas, pack switcher, node library, contract tools, code workspace, notifications, terminal, AI panel
- `creating-nodes.md`: node templates, inputs, outputs, widgets, Return UI, generated Python, editable full-file source
- `deploying-to-comfyui.md`: export ZIP, deploy and restart, dependency installation, loading/importing managed packs
- `project-structure.md`: repository layout, generated pack layout, helper server endpoints, metadata
- `troubleshooting.md`: common setup, validation, deploy, restart, dependency, and ComfyUI connection issues

## Accuracy Constraints

Documentation should describe the current codebase behavior:

- the dev command runs Vite and the loopback helper server together
- the helper server listens on `127.0.0.1:3001`
- deploy uses the active pack folder name and writes `builder.project.json`
- ComfyUI restart is requested through ComfyUI Extension Manager support
- generated packs can include node Python files, `__init__.py`, `web/runtimeUiDisplays.js`, optional custom renderer files, `requirements.txt`, `install.py`, and custom files
- the builder stores local projects in browser local storage and can import builder-owned packs from ComfyUI

## Out Of Scope

Do not change application behavior, package metadata, screenshots, or tests as part of this documentation pass. Do not claim support for arbitrary reverse-engineering of existing custom node packs; the reliable round trip is for builder-owned packs that include `builder.project.json`.
