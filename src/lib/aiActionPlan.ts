import type { CustomNodeFileSpec, NodeSpec, PortSpec, UiOutputSpec, WidgetSpec } from '../types/index'
import type { NodeTemplateId } from './nodeTemplates'

export type BuilderAction =
  | { type: 'create_pack'; name?: string; packFolderName?: string }
  | { type: 'switch_pack'; packFolderName?: string; name?: string }
  | { type: 'rename_pack'; name?: string; packFolderName?: string }
  | { type: 'create_node'; templateId?: NodeTemplateId; node?: Partial<NodeSpec> }
  | { type: 'update_node'; nodeId?: string; nodeName?: string; patch?: Partial<NodeSpec>; node?: Partial<NodeSpec> }
  | { type: 'delete_node'; nodeId?: string; nodeName?: string }
  | { type: 'set_requirements'; requirements: string[] }
  | { type: 'set_install_script'; code: string }
  | { type: 'upsert_file'; relativePath: string; content: string }
  | { type: 'delete_file'; relativePath: string }
  | { type: 'select_node'; nodeId?: string; nodeName?: string }
  | { type: 'validate_project' }
  | { type: 'run_terminal'; command: string; nodeId?: string; nodeName?: string }
  | { type: 'deploy_pack' }

export interface AiActionPlan {
  reply: string
  actions: BuilderAction[]
}

export type AiPortDraft = Omit<PortSpec, 'id'> & { id?: string }
export type AiWidgetDraft = Omit<WidgetSpec, 'id'> & { id?: string }
export type AiUiOutputDraft = Omit<UiOutputSpec, 'id'> & { id?: string }
export type AiFileDraft = Omit<CustomNodeFileSpec, 'id'> & { id?: string }

function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) return text.slice(firstBrace, lastBrace + 1)
  return null
}

function isAction(value: unknown): value is BuilderAction {
  return Boolean(value && typeof value === 'object' && typeof (value as { type?: unknown }).type === 'string')
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string')
}

function normalizeAction(value: unknown): BuilderAction | null {
  if (!isAction(value)) return null
  const action = { ...(value as Record<string, unknown>) }
  if (action.type === 'set_install_script' && typeof action.code !== 'string') {
    const code = firstString(action.script, action.content, action.source, action.installScript)
    if (code !== undefined) action.code = code
  }
  if (action.type === 'upsert_file') {
    if (typeof action.relativePath !== 'string') {
      const relativePath = firstString(action.path, action.file, action.filename)
      if (relativePath !== undefined) action.relativePath = relativePath
    }
    if (typeof action.content !== 'string') {
      const content = firstString(action.code, action.source, action.text)
      if (content !== undefined) action.content = content
    }
  }
  return action as BuilderAction
}

export function parseAiActionPlan(text: string): AiActionPlan {
  const rawJson = extractJson(text)
  if (!rawJson) return { reply: text.trim(), actions: [] }
  try {
    const parsed = JSON.parse(rawJson) as Partial<AiActionPlan>
    const actions = Array.isArray(parsed.actions)
      ? parsed.actions.map(normalizeAction).filter((action): action is BuilderAction => Boolean(action))
      : []
    const reply = typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : text.replace(rawJson, '').trim()
    return { reply, actions }
  } catch {
    return { reply: text.trim(), actions: [] }
  }
}
