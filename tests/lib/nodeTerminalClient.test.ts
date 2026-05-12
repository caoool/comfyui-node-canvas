import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildNodeTerminalPayload, runNodeTerminalCommand } from '../../src/lib/nodeTerminalClient'
import type { Project } from '../../src/types/index'

function projectFixture(): Project {
  return {
    name: 'ComfyUINodeBuilder',
    packFolderName: 'TerminalPack',
    comfyuiUrl: 'http://127.0.0.1:8188',
    comfyuiInstallPath: '/ComfyUI',
    pythonRequirements: ['requests'],
    pythonInstallScript: 'print("installing")',
    customFiles: [{ id: 'helper-1', relativePath: 'helpers.py', content: 'VALUE = 1\n' }],
    nodes: [
      {
        id: 'node-1',
        name: 'CustomNode',
        displayName: 'Custom Node',
        category: 'ComfyUINodeBuilder',
        isOutputNode: false,
        inputs: [],
        outputs: [],
        widgets: [],
        uiOutputs: [],
        moduleCode: 'import requests',
        code: 'return ()',
        useReturnOverrides: false,
        returnTypes: [],
        returnNames: [],
      },
      {
        id: 'node-2',
        name: 'SecondNode',
        displayName: 'Second Node',
        category: 'ComfyUINodeBuilder',
        isOutputNode: false,
        inputs: [],
        outputs: [],
        widgets: [],
        uiOutputs: [],
        moduleCode: '',
        code: 'return ()',
        useReturnOverrides: false,
        returnTypes: [],
        returnNames: [],
      },
    ],
  }
}

describe('nodeTerminalClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('builds a pack-level terminal payload with all node and shared project files', () => {
    const payload = buildNodeTerminalPayload(projectFixture(), 'node-1', 'python CustomNode.py')

    expect(payload).toMatchObject({
      projectName: 'TerminalPack',
      selectedNodeId: 'node-1',
      command: 'python CustomNode.py',
      requirements: ['requests'],
      installScript: 'print("installing")',
    })
    expect(payload.files['CustomNode.py']).toContain('class CustomNode')
    expect(payload.files['SecondNode.py']).toContain('class SecondNode')
    expect(payload.files['helpers.py']).toBe('VALUE = 1\n')
    expect(payload.files['requirements.txt']).toBe('requests\n')
  })

  it('posts terminal commands to the helper server', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        command: 'python -V',
        exitCode: 0,
        stdout: 'Python 3.13.0\n',
        stderr: '',
        cwd: '/repo/.node-builder/terminal/comfyuinodebuilder',
        envPath: '/repo/.node-builder/terminal/comfyuinodebuilder/.venv',
      }),
    } as Response)

    const result = await runNodeTerminalCommand(projectFixture(), 'node-1', 'python -V')

    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(String((init as RequestInit).body))
    expect(fetchMock).toHaveBeenCalledWith('/helper/node-terminal/run', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }))
    expect(body).toMatchObject({
      selectedNodeId: 'node-1',
      projectName: 'TerminalPack',
      command: 'python -V',
      requirements: ['requests'],
    })
    expect(result.stdout).toBe('Python 3.13.0\n')
  })
})
