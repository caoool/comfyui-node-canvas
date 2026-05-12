import { nanoid } from 'nanoid'
import type { NodeSpec, PaletteItem, PortSpec, UiOutputKind, UiOutputSpec, WidgetSpec } from '../types/index'
import { createWidgetFromPalette } from './comfyCatalog'
import { extractPythonVariableNames } from './returnCode'
import { returnUiItemForKind } from './returnUiCatalog'

export type IdFactory = () => string

function defaultId(): string {
  return nanoid()
}

function cleanPortName(value: string): string {
  return (value || 'value')
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^[0-9]/, '_$&')
    .toLowerCase() || 'value'
}

function uniquePortName(base: string, ports: PortSpec[]): string {
  const cleaned = cleanPortName(base)
  const taken = new Set(ports.map(port => port.name))
  if (!taken.has(cleaned)) return cleaned
  let n = 2
  while (taken.has(`${cleaned}_${n}`)) n++
  return `${cleaned}_${n}`
}

function sanitizeUiKey(value: string): string {
  return (value || 'text').trim().replace(/[^a-zA-Z0-9_]/g, '_') || 'text'
}

function uniqueUiKey(base: string, uiOutputs: UiOutputSpec[]): string {
  const cleaned = sanitizeUiKey(base)
  const taken = new Set(uiOutputs.map(output => output.key))
  if (!taken.has(cleaned)) return cleaned
  let n = 2
  while (taken.has(`${cleaned}_${n}`)) n++
  return `${cleaned}_${n}`
}

function returnExpressionDefault(node: NodeSpec): string {
  const outputExpression = node.outputs.find(output => output.expression)?.expression
  if (outputExpression) return outputExpression
  const variables = extractPythonVariableNames(node.code, node.inputs.map(input => input.name))
  return variables.at(-1) ?? node.outputs[0]?.name ?? ''
}

export function addPalettePortToNode(
  node: NodeSpec,
  zone: 'inputs' | 'outputs',
  item: PaletteItem,
  idFactory: IdFactory = defaultId,
): { node: NodeSpec; port: PortSpec; widget?: WidgetSpec } {
  const current = zone === 'inputs' ? node.inputs : node.outputs
  const isWidget = zone === 'inputs' && item.isWidget && item.widgetType !== null
  const port: PortSpec = {
    id: idFactory(),
    name: uniquePortName(item.name, current),
    type: item.type,
    optional: false,
    isWidget,
  }
  const widget = isWidget ? { ...createWidgetFromPalette(item, port.id), id: idFactory() } : undefined
  const nextNode: NodeSpec = zone === 'inputs'
    ? { ...node, inputs: [...node.inputs, port], widgets: widget ? [...node.widgets, widget] : node.widgets }
    : { ...node, outputs: [...node.outputs, port] }

  return { node: nextNode, port, widget }
}

export function addCustomPortToNode(
  node: NodeSpec,
  zone: 'inputs' | 'outputs',
  name: string,
  type: string,
  idFactory: IdFactory = defaultId,
): { node: NodeSpec; port: PortSpec } {
  const normalizedType = type.trim().toUpperCase()
  const item: PaletteItem = {
    label: normalizedType,
    name: name.trim() || normalizedType.toLowerCase(),
    type: normalizedType,
    isWidget: false,
    widgetType: null,
    group: 'Custom',
    description: 'Custom extension type.',
  }
  return addPalettePortToNode(node, zone, item, idFactory)
}

export function removePortFromNode(node: NodeSpec, portId: string): NodeSpec {
  return {
    ...node,
    inputs: node.inputs.filter(port => port.id !== portId),
    outputs: node.outputs.filter(port => port.id !== portId),
    widgets: node.widgets.filter(widget => widget.portId !== portId),
  }
}

export function addUiOutputToNode(
  node: NodeSpec,
  kind: UiOutputKind = 'text',
  idFactory: IdFactory = defaultId,
): { node: NodeSpec; uiOutput: UiOutputSpec } {
  const uiOutputs = node.uiOutputs ?? []
  const item = returnUiItemForKind(kind)
  const uiOutput: UiOutputSpec = {
    id: idFactory(),
    key: uniqueUiKey(item.key, uiOutputs),
    kind,
    label: item.label,
    expression: returnExpressionDefault(node),
    sample: item.sample,
  }
  return {
    node: {
      ...node,
      uiOutputs: [...uiOutputs, uiOutput],
    },
    uiOutput,
  }
}

export function removeUiOutputFromNode(node: NodeSpec, uiOutputId: string): NodeSpec {
  return {
    ...node,
    uiOutputs: (node.uiOutputs ?? []).filter(output => output.id !== uiOutputId),
  }
}
