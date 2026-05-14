import { stdin, stdout } from 'process'
import { AI_SKILLS, systemPromptForSkills } from '../src/lib/aiSkills.ts'
import { buildManagedPackFiles } from '../src/lib/managedPack.ts'
import { validateProject } from '../src/lib/validate.ts'
import type { Project } from '../src/types/index.ts'

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number | null
  result?: unknown
  error?: { code: number; message: string }
}

const ACTION_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            type: 'string',
            enum: [
              'create_pack',
              'switch_pack',
              'rename_pack',
              'create_node',
              'update_node',
              'delete_node',
              'set_requirements',
              'set_install_script',
              'upsert_file',
              'delete_file',
              'select_node',
              'validate_project',
              'run_terminal',
              'deploy_pack',
            ],
          },
        },
        additionalProperties: true,
      },
    },
  },
  required: ['actions'],
}

const TOOLS = [
  {
    name: 'builder.skills.list',
    description: 'List built-in ComfyUI Node Builder AI skills and prompt guidance.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'builder.action.schema',
    description: 'Return the JSON action-plan schema understood by the in-app AI builder.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'builder.project.validate',
    description: 'Validate a ComfyUI Node Builder project JSON object.',
    inputSchema: {
      type: 'object',
      properties: { project: { type: 'object' } },
      required: ['project'],
    },
  },
  {
    name: 'builder.pack.files',
    description: 'Generate builder-owned pack files from a project JSON object.',
    inputSchema: {
      type: 'object',
      properties: { project: { type: 'object' } },
      required: ['project'],
    },
  },
]

function buildMcpPackFiles(project: Project): Record<string, string> {
  return buildManagedPackFiles(project)
}

function textContent(value: unknown) {
  return {
    content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
  }
}

async function callTool(name: string, args: Record<string, unknown> = {}) {
  if (name === 'builder.skills.list') {
    return textContent({ skills: AI_SKILLS, systemPrompt: systemPromptForSkills() })
  }
  if (name === 'builder.action.schema') {
    return textContent(ACTION_SCHEMA)
  }
  if (name === 'builder.project.validate') {
    const project = args.project as Project
    const errors = validateProject(project)
    return textContent({ ok: errors.length === 0, errors })
  }
  if (name === 'builder.pack.files') {
    const project = args.project as Project
    const files = buildMcpPackFiles(project)
    return textContent({ files })
  }
  throw new Error(`Unknown tool: ${name}`)
}

export async function handleMcpRequest(request: JsonRpcRequest): Promise<JsonRpcResponse | null> {
  if (request.id === undefined && request.method.startsWith('notifications/')) return null
  try {
    if (request.method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id: request.id ?? null,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'comfyui-node-builder', version: '0.1.0' },
        },
      }
    }
    if (request.method === 'tools/list') {
      return { jsonrpc: '2.0', id: request.id ?? null, result: { tools: TOOLS } }
    }
    if (request.method === 'tools/call') {
      const params = request.params as { name?: string; arguments?: Record<string, unknown> } | undefined
      if (!params?.name) throw new Error('tools/call requires params.name')
      return { jsonrpc: '2.0', id: request.id ?? null, result: await callTool(params.name, params.arguments ?? {}) }
    }
    throw new Error(`Unsupported MCP method: ${request.method}`)
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id: request.id ?? null,
      error: { code: -32000, message: error instanceof Error ? error.message : String(error) },
    }
  }
}

function writeMessage(message: JsonRpcResponse) {
  const json = JSON.stringify(message)
  stdout.write(`Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`)
}

function startStdioServer() {
  let buffer = Buffer.alloc(0)
  stdin.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk])
    void drain()
  })

  async function drain() {
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n')
      if (headerEnd < 0) return
      const header = buffer.slice(0, headerEnd).toString('utf8')
      const match = header.match(/Content-Length:\s*(\d+)/i)
      if (!match) {
        buffer = buffer.slice(headerEnd + 4)
        continue
      }
      const length = Number(match[1])
      const messageStart = headerEnd + 4
      if (buffer.length < messageStart + length) return
      const raw = buffer.slice(messageStart, messageStart + length).toString('utf8')
      buffer = buffer.slice(messageStart + length)
      const response = await handleMcpRequest(JSON.parse(raw) as JsonRpcRequest)
      if (response) writeMessage(response)
    }
  }
}

if (process.argv[1]?.endsWith('mcpServer.ts')) {
  startStdioServer()
}
