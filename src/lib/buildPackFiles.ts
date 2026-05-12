import { generatePython } from './generatePython'
import { nodeForPythonGeneration, pythonInstallScriptForNode, pythonRequirementsForNode } from './nodeTemplates'
import { isReservedPackFilePath, isReservedProjectFilePath, normalizeCustomNodeFilePath } from './nodeFilePaths'
import type { CustomNodeFileSpec, NodeSpec, Project, UiOutputSpec } from '../types/index'

const FRONTEND_EXTENSION_PATH = 'web/runtimeUiDisplays.js'
const CUSTOM_RENDERER_SUFFIX = '.customRenderer.js'

// Builds the pack's file map (filename → contents) used by both Export ZIP and
// Hot Reload, so the two paths stay byte-identical.
export function buildPackFiles(project: Project): Record<string, string> {
  const files: Record<string, string> = {}
  for (const rawNode of project.nodes) {
    const node = nodeForPythonGeneration(rawNode)
    files[`${node.name}.py`] = rawNode.pythonSource ?? generatePython(node)
  }
  for (const customFile of safeCustomFilesForProject(project)) {
    files[customFile.relativePath] = customFile.content
  }
  for (const rawNode of project.nodes) {
    for (const customFile of safeLegacyCustomFilesForNode(rawNode, project.nodes.map(node => node.name))) {
      if (!(customFile.relativePath in files)) files[customFile.relativePath] = customFile.content
    }
  }
  files['__init__.py'] = buildInitPy(project.nodes.map(n => n.name))
  files[FRONTEND_EXTENSION_PATH] = buildRuntimeUiDisplayExtension(project.nodes)
  for (const node of project.nodes) {
    if (nodeUsesCustomUiRenderer(node)) {
      files[customUiRendererPathForNode(node.name)] = customUiRendererCodeForNode(node)
    }
  }
  const requirements = buildRequirementsTxt(project)
  if (requirements) files['requirements.txt'] = requirements
  const installScript = buildInstallPy(project)
  if (installScript) files['install.py'] = installScript
  return files
}

function safeCustomFilesForProject(project: Project): CustomNodeFileSpec[] {
  const files: CustomNodeFileSpec[] = []
  const seen = new Set<string>()
  const nodeNames = project.nodes.map(node => node.name)
  for (const file of project.customFiles ?? []) {
    const relativePath = normalizeCustomNodeFilePath(file.relativePath)
    if (!relativePath || isReservedProjectFilePath(relativePath, nodeNames) || seen.has(relativePath)) continue
    seen.add(relativePath)
    files.push({ ...file, relativePath })
  }
  return files
}

function safeLegacyCustomFilesForNode(node: NodeSpec, nodeNames: string[]): CustomNodeFileSpec[] {
  const files: CustomNodeFileSpec[] = []
  const seen = new Set<string>()
  for (const file of node.customFiles ?? []) {
    const relativePath = normalizeCustomNodeFilePath(file.relativePath)
    if (
      !relativePath ||
      isReservedPackFilePath(relativePath, node.name) ||
      isReservedProjectFilePath(relativePath, nodeNames) ||
      seen.has(relativePath)
    ) continue
    seen.add(relativePath)
    files.push({ ...file, relativePath })
  }
  return files
}

export function customUiRendererPathForNode(nodeName: string): string {
  return `web/${nodeName}${CUSTOM_RENDERER_SUFFIX}`
}

export function nodeUsesCustomUiRenderer(node: Pick<NodeSpec, 'uiOutputs'>): boolean {
  return (node.uiOutputs ?? []).some(output => output.kind === 'custom')
}

export function customUiRendererCodeForNode(node: Pick<NodeSpec, 'name' | 'uiOutputs' | 'customUiRendererCode'>): string {
  const override = node.customUiRendererCode?.trimEnd()
  if (override) return `${override}\n`
  return buildDefaultCustomUiRenderer(node)
}

export function projectRequirements(project: Project): string[] {
  const explicit = project.pythonRequirements
    ?.map(requirement => requirement.trim())
    .filter(Boolean)
  if (explicit && explicit.length > 0) return explicit
  return project.nodes.flatMap(node => pythonRequirementsForNode(node))
}

export function projectInstallScript(project: Project): string {
  const explicit = project.pythonInstallScript?.trim()
  if (explicit) return explicit
  return project.nodes
    .map(node => pythonInstallScriptForNode(node).trim())
    .filter(Boolean)
    .join('\n\n')
}

function buildRequirementsTxt(project: Project): string {
  const lines: string[] = []
  const seen = new Set<string>()
  for (const rawRequirement of projectRequirements(project)) {
    const requirement = rawRequirement.trim()
    if (!requirement || seen.has(requirement)) continue
    seen.add(requirement)
    lines.push(requirement)
  }
  return lines.length > 0 ? `${lines.join('\n')}\n` : ''
}

function buildInstallPy(project: Project): string {
  const script = projectInstallScript(project)
  return script ? `${script}\n` : ''
}

function buildInitPy(nodeNames: string[]): string {
  // We only need the mapping dicts at the package level; ComfyUI doesn't import
  // the class names from __init__.py.
  const lines = [
    ...nodeNames.map(n =>
      `from .${n} import NODE_CLASS_MAPPINGS as ${n}_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS as ${n}_DISPLAY_MAPPINGS`,
    ),
    '',
    'NODE_CLASS_MAPPINGS = {}',
    'NODE_DISPLAY_NAME_MAPPINGS = {}',
    ...nodeNames.map(n => `NODE_CLASS_MAPPINGS.update(${n}_MAPPINGS)`),
    ...nodeNames.map(n => `NODE_DISPLAY_NAME_MAPPINGS.update(${n}_DISPLAY_MAPPINGS)`),
    '',
    'WEB_DIRECTORY = "./web"',
    '',
    '__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]',
  ]
  return lines.join('\n')
}

function uiSpecsForNode(node: NodeSpec): UiOutputSpec[] {
  return (node.uiOutputs ?? [])
    .filter(output => output.kind !== 'custom')
    .map(output => ({
      id: output.id,
      key: output.key,
      kind: output.kind,
      label: output.label,
      sample: output.sample,
    }))
}

function customUiSpecsForNode(node: Pick<NodeSpec, 'uiOutputs'>): Array<Pick<UiOutputSpec, 'key' | 'label'>> {
  return (node.uiOutputs ?? [])
    .filter(output => output.kind === 'custom')
    .map(output => ({
      key: output.key,
      label: output.label,
    }))
}

function buildDefaultCustomUiRenderer(node: Pick<NodeSpec, 'name' | 'uiOutputs'>): string {
  const specs = customUiSpecsForNode(node)
  return `import { app } from "../../scripts/app.js";

// Generated by ComfyUI Node Builder because this node uses Return UI type "custom".
// Edit renderCustomUi(...) below to control what appears inside the ComfyUI node.
// Python should return custom UI values like:
//   return {"ui": {"${specs[0]?.key ?? 'custom'}": (your_value,)}, "result": (...)}

const NODE_TYPE = ${JSON.stringify(node.name)};
const CUSTOM_UI_SPECS = ${JSON.stringify(specs, null, 2)};
const WIDGET_PREFIX = "builder_custom_ui_";

function normalizeKey(key) {
  return String(key ?? "").replace(/[^a-zA-Z0-9_]/g, "_");
}

function normalizeUiValue(value) {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

function stringifyValue(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function setWidgetVisible(widget, visible) {
  widget.hidden = !visible;
  widget.options = widget.options ?? {};
  widget.options.hidden = !visible;
}

function ensureCustomWidget(node, spec) {
  const widgetName = WIDGET_PREFIX + normalizeKey(spec.key);
  let widget = node.widgets?.find((candidate) => candidate.name === widgetName);
  if (widget) return widget;

  const root = document.createElement("div");
  root.className = "comfyui-node-builder-custom-render";

  const title = document.createElement("div");
  title.className = "comfyui-node-builder-custom-render-title";
  title.textContent = spec.label || spec.key;

  const body = document.createElement("div");
  body.className = "comfyui-node-builder-custom-render-body";

  root.append(title, body);
  widget = node.addDOMWidget(widgetName, widgetName, root);
  widget.label = spec.label || spec.key;
  widget.serialize = false;
  widget.options = widget.options ?? {};
  widget.options.serialize = false;
  setWidgetVisible(widget, false);
  return widget;
}

function renderCustomUi(body, value, context) {
  // Start here: replace this fallback renderer with your own DOM.
  // context contains { node, spec, message, app }.
  body.replaceChildren();
  const pre = document.createElement("pre");
  pre.textContent = stringifyValue(value);
  body.appendChild(pre);
}

app.registerExtension({
  name: "ComfyUINodeBuilder.CustomRenderer." + NODE_TYPE,

  setup() {
    const style = document.createElement("style");
    style.textContent = \`
      .comfyui-node-builder-custom-render {
        box-sizing: border-box;
        max-width: 100%;
        color: #d9d9de;
        background: rgba(0, 0, 0, 0.22);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 6px;
        padding: 6px;
        font: 12px Arial, sans-serif;
      }
      .comfyui-node-builder-custom-render-title {
        margin-bottom: 4px;
        color: rgba(255,255,255,0.64);
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .comfyui-node-builder-custom-render-body pre {
        max-height: 220px;
        overflow: auto;
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        font: 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
    \`;
    document.head.appendChild(style);
  },

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_TYPE) return;

    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      onNodeCreated?.apply(this, arguments);
      for (const spec of CUSTOM_UI_SPECS) {
        ensureCustomWidget(this, spec);
      }
    };

    const onExecuted = nodeType.prototype.onExecuted;
    nodeType.prototype.onExecuted = function (message) {
      onExecuted?.apply(this, arguments);

      for (const spec of CUSTOM_UI_SPECS) {
        const rawValue = message?.[spec.key];
        if (rawValue === undefined) continue;
        const widget = ensureCustomWidget(this, spec);
        const body = widget.element?.querySelector(".comfyui-node-builder-custom-render-body");
        if (body) renderCustomUi(body, normalizeUiValue(rawValue), { node: this, spec, message, app });
        widget.value = rawValue;
        setWidgetVisible(widget, true);
      }

      const nextSize = this.computeSize?.();
      if (nextSize) this.setSize(nextSize);
      app.graph?.setDirtyCanvas?.(true, true);
    };
  },
});
`
}

function buildRuntimeUiDisplayExtension(nodes: NodeSpec[]): string {
  const nodeSpecs = Object.fromEntries(nodes.map(node => [node.name, uiSpecsForNode(node)]))
  return `import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const BUILDER_UI_SPECS = ${JSON.stringify(nodeSpecs, null, 2)};
const BUILDER_NODES = new Set(Object.keys(BUILDER_UI_SPECS));
const WIDGET_PREFIX = "builder_ui_";

const FALLBACK_LABELS = {
  text: "Text",
  markdown: "Markdown",
  images: "Images",
  image: "Image",
  audio: "Audio",
  video: "Video",
  videos: "Videos",
  json: "JSON",
  list: "List",
  table: "Table",
  color: "Color",
  chart: "Chart",
  mesh: "3D",
  files: "Files",
};

function setWidgetVisible(widget, visible) {
  widget.hidden = !visible;
  widget.options = widget.options ?? {};
  widget.options.hidden = !visible;
}

function normalizeKey(key) {
  return String(key ?? "").replace(/[^a-zA-Z0-9_]/g, "_");
}

function inferKind(key, value) {
  const lowered = String(key).toLowerCase();
  if (lowered.includes("image")) return "image";
  if (lowered.includes("audio")) return "audio";
  if (lowered.includes("video")) return "video";
  if (lowered.includes("3d") || lowered.includes("mesh")) return "mesh";
  if (lowered.includes("color")) return "color";
  if (lowered.includes("chart") || lowered.includes("histogram") || lowered.includes("curve")) return "chart";
  if (lowered.includes("table")) return "table";
  if (lowered.includes("json")) return "json";
  if (Array.isArray(value)) return "list";
  if (value && typeof value === "object") return "json";
  return "text";
}

function specsForMessage(nodeName, message) {
  const configured = BUILDER_UI_SPECS[nodeName] ?? [];
  const configuredKeys = new Set(configured.map((spec) => spec.key));
  const fallback = Object.keys(message ?? {})
    .filter((key) => key !== "result" && !configuredKeys.has(key))
    .map((key) => ({
      key,
      kind: inferKind(key, message[key]),
      label: FALLBACK_LABELS[key] ?? key,
    }));
  return [...configured, ...fallback];
}

function ensureDisplayWidget(node, spec) {
  const widgetName = WIDGET_PREFIX + normalizeKey(spec.key);
  let widget = node.widgets?.find((candidate) => candidate.name === widgetName);
  if (widget) return widget;

  const root = document.createElement("div");
  root.className = "comfyui-node-builder-display";
  root.dataset.kind = spec.kind ?? "generic";

  const label = document.createElement("div");
  label.className = "comfyui-node-builder-display-label";
  label.textContent = spec.label || spec.key;

  const body = document.createElement("div");
  body.className = "comfyui-node-builder-display-body";

  root.append(label, body);

  widget = node.addDOMWidget(widgetName, widgetName, root);
  widget.label = spec.label || spec.key;
  widget.options = widget.options ?? {};
  widget.options.serialize = false;
  widget.serialize = false;
  setWidgetVisible(widget, false);

  return widget;
}

function recordToUrl(record) {
  if (!record || typeof record !== "object") return "";
  const params = new URLSearchParams(record);
  return api.apiURL("/view?" + params.toString() + (app.getRandParam?.() ?? ""));
}

function stringifyValue(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function renderMediaList(body, value, tagName) {
  const values = Array.isArray(value) ? value : [value];
  for (const item of values) {
    const el = document.createElement(tagName);
    el.controls = tagName !== "img";
    if (tagName === "img") el.loading = "lazy";
    el.src = typeof item === "string" ? item : recordToUrl(item);
    body.appendChild(el);
  }
}

function renderValue(body, spec, value) {
  body.replaceChildren();
  const kind = spec.kind ?? inferKind(spec.key, value);
  if (kind === "image") {
    renderMediaList(body, value, "img");
    return;
  }
  if (kind === "audio") {
    renderMediaList(body, value, "audio");
    return;
  }
  if (kind === "video") {
    renderMediaList(body, value, "video");
    return;
  }
  if (kind === "color") {
    const swatch = document.createElement("div");
    swatch.className = "comfyui-node-builder-color";
    swatch.style.background = String(Array.isArray(value) ? value[0] : value || "transparent");
    const text = document.createElement("pre");
    text.textContent = stringifyValue(value);
    body.append(swatch, text);
    return;
  }

  const pre = document.createElement("pre");
  pre.textContent = stringifyValue(value);
  body.appendChild(pre);
}

app.registerExtension({
  name: "ComfyUINodeBuilder.RuntimeUiDisplays",

  setup() {
    const style = document.createElement("style");
    style.textContent = \`
      .comfyui-node-builder-display {
        box-sizing: border-box;
        max-width: 100%;
        color: #d9d9de;
        background: rgba(0, 0, 0, 0.22);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 6px;
        padding: 6px;
        font: 12px Arial, sans-serif;
      }
      .comfyui-node-builder-display-label {
        margin-bottom: 4px;
        color: rgba(255,255,255,0.64);
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .comfyui-node-builder-display-body {
        display: grid;
        gap: 6px;
      }
      .comfyui-node-builder-display img,
      .comfyui-node-builder-display video {
        max-width: 100%;
        border-radius: 4px;
        background: #111;
      }
      .comfyui-node-builder-display audio {
        width: 100%;
      }
      .comfyui-node-builder-display pre {
        max-height: 220px;
        overflow: auto;
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        font: 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      .comfyui-node-builder-color {
        width: 100%;
        height: 32px;
        border-radius: 4px;
        border: 1px solid rgba(255,255,255,0.18);
      }
    \`;
    document.head.appendChild(style);
  },

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (!BUILDER_NODES.has(nodeData.name)) return;

    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      onNodeCreated?.apply(this, arguments);
      for (const spec of BUILDER_UI_SPECS[nodeData.name] ?? []) {
        ensureDisplayWidget(this, spec);
      }
    };

    const onExecuted = nodeType.prototype.onExecuted;
    nodeType.prototype.onExecuted = function (message) {
      onExecuted?.apply(this, arguments);

      for (const spec of specsForMessage(nodeData.name, message)) {
        const value = message?.[spec.key];
        if (value === undefined) continue;
        const widget = ensureDisplayWidget(this, spec);
        const body = widget.element?.querySelector(".comfyui-node-builder-display-body");
        if (body) renderValue(body, spec, value);
        widget.value = value;
        setWidgetVisible(widget, true);
      }

      const nextSize = this.computeSize?.();
      if (nextSize) this.setSize(nextSize);
      app.graph?.setDirtyCanvas?.(true, true);
    };
  },
});
`
}
