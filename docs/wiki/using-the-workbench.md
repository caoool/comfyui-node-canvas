# Using The Workbench

ComfyUI Node Builder is organized as a resizable workbench. The main editing loop is: select a pack, select a node, adjust the node contract, edit the generated files, then export or deploy.

## Toolbar

The top toolbar contains the project identity, pack controls, and pack output actions.

Pack controls let you:

- create a new pack
- switch between local packs
- rename the active pack and ComfyUI folder
- duplicate the active pack
- delete the active pack from the local builder workspace

Output actions:

- **Export ZIP:** package the active pack for manual installation.
- **Deploy & Restart:** write the active pack to ComfyUI, install dependencies when needed, request a restart, and show diagnostics.

Validation errors can disable export and deploy. Hover the disabled action to see the first few validation messages.

## Left Panel: Nodes And Contract Tools

The left panel has two stacked areas.

### Nodes

The **Nodes** area lists nodes in the active pack, grouped by category. It includes:

- a template selector
- a **New** button
- node search
- duplicate and delete controls for existing nodes

Templates provide practical starting points, including blank, image, latent, mask, text, string preview, and multi-output nodes.

### Add To Node

The **Add to Node** area is a searchable catalog for extending the selected node. It includes:

- standard ComfyUI data types
- widget presets
- custom input and output ports
- Return UI displays

For data types, use **In** to add an input and **Out** to add an output. Widget presets add widget-backed inputs. Custom ports can be renamed and retyped after you add them.

## Center Panel: Node Preview

The center panel previews the selected node. It shows the node title, category, inputs, outputs, widgets, and Return UI areas.

Click an item in the preview to edit it:

- input port
- output port
- widget
- Return UI display

The edit form opens below the preview. Closing the form returns selection to the node itself.

## Right Panel: Code Workspace

The code workspace shows the generated pack files for the selected node and project. It uses Monaco for editing and previewing source.

Common file types:

- selected node Python file
- `__init__.py`
- `requirements.txt`
- `install.py`
- `web/runtimeUiDisplays.js`
- custom renderer files for Return UI type `custom`
- shared custom files such as `helpers.py`

Editable files are marked in the workspace. Generated pack files that should not be edited directly are marked read-only.

Useful controls:

- **Wrap:** toggle word wrap.
- **Map:** toggle the minimap.
- **Copy:** copy the active file contents.
- Full-screen icon: expand or collapse the code editor.
- **+ File:** add a shared custom file to the pack.
- **Re-scan Imports:** inspect authored Python and suggest missing requirements.

When editing a node Python file, the builder attempts to sync supported changes back into the node contract. If it cannot safely sync a change, it shows issues in the code panel so you can adjust the file.

## Status Bar

The bottom status bar shows current app status and provides quick access to:

- terminal panel
- AI Builder panel
- notifications
- Settings

Notifications collect validation, deploy, load, terminal, and helper-server messages. Use them to inspect the exact path written during deploy or the reason a connection check failed.

## Terminal Panel

The terminal panel runs commands in a generated pack workspace. It is intended for lightweight checks, not as a full replacement for your system terminal.

Typical commands:

```bash
python -V
python -m py_compile MyNode.py
```

The terminal uses a shared pack-level environment and logs stdout, stderr, exit codes, and command history. The **Builder Output** tab shows logs from deploy, terminal, and diagnostics actions.

## AI Builder Panel

The AI Builder is optional. It can use OpenAI, OpenRouter, OpenAI-compatible servers, Anthropic, Gemini, or Ollama. Configure provider, model, API key, and base URL from the AI settings popover.

The AI Builder can request actions such as:

- create or update a pack
- create, update, delete, or select nodes
- set requirements or install scripts
- add or delete custom files
- validate the project
- run terminal commands
- request deploy

Deployment is gated by the **Allow deploy** toggle. The assistant can ask for a deploy action, but the UI only emits deploy when that permission is enabled.

Provider settings are kept in browser local storage. The helper server receives provider requests so the browser does not call provider APIs directly.
