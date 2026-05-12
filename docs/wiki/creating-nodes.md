# Creating Nodes

Node authoring in ComfyUI Node Builder has two layers:

- the **contract**, which describes the ComfyUI node interface
- the **Python source**, which implements the node behavior

The builder generates the ComfyUI boilerplate around your contract and authored Python.

## Start From A Template

In the **Nodes** panel, choose a template and click **New**.

Available templates include:

- **Blank Node:** minimal scaffold.
- **Image Pass-through:** one `IMAGE` input and one `IMAGE` output.
- **Image Transform:** `IMAGE` input, `FLOAT` strength widget, and `IMAGE` output.
- **Latent Transform:** `LATENT` input and output.
- **Mask Utility:** `MASK` input and output.
- **Text Utility:** `STRING` widget input and `STRING` output.
- **String Concat Preview:** two strings, one string result, and a text Return UI preview.
- **Multi-output:** one image input returning image and mask outputs.

Templates are starting points. You can rename, duplicate, delete, and extend nodes after creation.

## Node Identity

Each node has:

- **Name:** Python class name and generated file name.
- **Display Name:** label shown in ComfyUI.
- **Category:** ComfyUI menu category.
- **Output Node:** optional flag for ComfyUI output-style nodes.

Use Python-friendly class names for **Name**. Keep names unique inside a pack because the builder generates one Python file per node.

## Inputs

Inputs can be regular ComfyUI inputs or widget-backed inputs.

Regular inputs are values connected from other nodes. Widget-backed inputs are shown as controls on the ComfyUI node. The contract editor supports common data types and widget presets, and you can add custom ports when the type you need is not in the catalog.

Common input details:

- name
- type
- optional flag
- widget flag
- widget kind
- default value
- widget configuration

For widgets, the builder generates the right shape inside `INPUT_TYPES`.

## Outputs

Outputs define the values returned by the node. By default, output ports are the source of truth for generated `RETURN_TYPES` and `RETURN_NAMES`.

Each output can have an expression. The expression is the Python variable or expression used in the generated return statement.

Example:

```text
Output name: image
Output type: IMAGE
Expression: processed_image
```

The generated execute method can then return `processed_image` as the node result.

## Return UI

Return UI describes values that ComfyUI can display inside the executed node. It is separate from normal node outputs.

Supported Return UI kinds include text, markdown, JSON, list, table, image, audio, video, color, chart, mesh, file, generic, and custom.

A Return UI item has:

- key
- kind
- label
- expression
- optional sample value

The generated runtime UI script reads UI payloads returned by Python and renders display widgets inside ComfyUI. For custom Return UI, the builder can generate a custom renderer file under `web/`.

## Python Source

The code workspace shows the full selected node Python file. The generated file includes:

- optional module-level code
- generated node class
- generated `INPUT_TYPES`
- generated return metadata
- generated `execute` method signature
- authored execute body
- generated return code
- `NODE_CLASS_MAPPINGS`
- `NODE_DISPLAY_NAME_MAPPINGS`

You can edit the full node source. The builder syncs supported changes back into the project model. If a change cannot be safely understood, the code panel reports an issue instead of silently corrupting the contract.

## Dependencies

Pack-level dependencies are represented as:

- `requirements.txt`
- `install.py`

Use `requirements.txt` for normal pip packages. Use `install.py` for setup that cannot be expressed as package requirements, such as cloning a model helper repository.

The code workspace can scan authored Python imports and suggest missing requirements. Suggestions are helpers, not a guarantee that every runtime dependency is correct for ComfyUI's Python environment.

## Shared Custom Files

Use **+ File** in the code workspace to add shared project files such as:

```text
helpers.py
web/shared.js
data/config.json
```

The builder rejects unsafe paths and reserved generated paths. Shared files are included in exports and direct deploys.

## Validation

Validation protects export and deploy. It checks the project model before writing files.

Common validation failures include:

- duplicate node names
- duplicate generated file names
- invalid node or port names
- output metadata mismatches
- missing ComfyUI install path for deploy/load actions

Fix validation errors before exporting or deploying. Notifications and disabled action tooltips show the most immediate problems.

## Practical Authoring Loop

1. Create a template node.
2. Rename the node and category.
3. Add inputs, widgets, outputs, and Return UI.
4. Write Python behavior in the selected node source.
5. Add dependencies or helper files if needed.
6. Run a terminal check.
7. Export or deploy.
8. Test in ComfyUI.
9. Load the managed pack later if you need to continue editing from the deployed copy.
