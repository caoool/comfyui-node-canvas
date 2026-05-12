import { describe, expect, it } from 'vitest'
import { handleMcpRequest } from '../../server/mcpServer'

describe('mcpServer', () => {
  it('lists builder MCP tools', async () => {
    const response = await handleMcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' })

    expect(response?.result.tools.map((tool: { name: string }) => tool.name)).toEqual(expect.arrayContaining([
      'builder.skills.list',
      'builder.action.schema',
      'builder.project.validate',
      'builder.pack.files',
    ]))
  })

  it('returns builder skills through tools/call', async () => {
    const response = await handleMcpRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'builder.skills.list', arguments: {} },
    })

    expect(response?.result.content[0].text).toContain('node-authoring')
    expect(response?.result.content[0].text).toContain('deploy-to-comfyui')
  })

  it('validates project JSON through tools/call', async () => {
    const response = await handleMcpRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'builder.project.validate',
        arguments: {
          project: {
            name: 'Bad',
            nodes: [{ id: 'n1', name: '', displayName: '', category: '', inputs: [], outputs: [], widgets: [], moduleCode: '', code: '', useReturnOverrides: false, returnTypes: [], returnNames: [] }],
            comfyuiUrl: 'http://127.0.0.1:8188',
            comfyuiInstallPath: '',
          },
        },
      },
    })

    expect(response?.result.content[0].text).toContain('Node name is required')
  })
})
