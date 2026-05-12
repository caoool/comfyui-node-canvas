import { describe, expect, it, vi } from 'vitest'
import { isSafeTerminalFilePath, runNodeTerminalCommand, terminalPathsForPack } from '../../server/nodeTerminal'

function fakeProcess(stdout = '', stderr = '', code = 0) {
  return {
    stdout: {
      on: vi.fn((event: string, cb: (chunk: Buffer) => void) => {
        if (event === 'data' && stdout) cb(Buffer.from(stdout))
      }),
    },
    stderr: {
      on: vi.fn((event: string, cb: (chunk: Buffer) => void) => {
        if (event === 'data' && stderr) cb(Buffer.from(stderr))
      }),
    },
    on: vi.fn((event: string, cb: (value?: number | Error | null) => void) => {
      if (event === 'close') cb(code)
    }),
    kill: vi.fn(),
  }
}

describe('nodeTerminal server helpers', () => {
  it('keeps terminal paths inside one shared pack-level uv workspace', () => {
    expect(terminalPathsForPack('/repo/.node-builder/terminal', 'My Custom Pack')).toMatchObject({
      workspaceDir: '/repo/.node-builder/terminal/my-custom-pack',
      envDir: '/repo/.node-builder/terminal/my-custom-pack/.venv',
      requirementsPath: '/repo/.node-builder/terminal/my-custom-pack/requirements.txt',
    })
  })

  it('rejects unsafe workspace file paths', () => {
    expect(isSafeTerminalFilePath('CustomNode.py')).toBe(true)
    expect(isSafeTerminalFilePath('helpers/audio.py')).toBe(true)
    expect(isSafeTerminalFilePath('../secret.py')).toBe(false)
    expect(isSafeTerminalFilePath('/tmp/secret.py')).toBe(false)
  })

  it('creates one pack uv env, syncs all pack files and requirements, then runs the command in that workspace', async () => {
    const spawn = vi.fn((_command: string, _args: string[]) => fakeProcess('ok\n'))
    const writeFile = vi.fn()
    const mkdir = vi.fn()
    const readFile = vi.fn().mockRejectedValue(new Error('missing hash'))

    const result = await runNodeTerminalCommand({
      projectName: 'My Custom Pack',
      selectedNodeId: 'node-1',
      command: 'python -V',
      files: {
        'CustomNode.py': 'print("node")\n',
        'SecondNode.py': 'print("second")\n',
        'requirements.txt': 'requests\n',
      },
      requirements: ['requests'],
      installScript: '',
    }, {
      rootDir: '/repo/.node-builder/terminal',
      exists: () => false,
      mkdir,
      writeFile,
      readFile,
      spawn,
    })

    expect(mkdir).toHaveBeenCalledWith('/repo/.node-builder/terminal/my-custom-pack', { recursive: true })
    expect(writeFile).toHaveBeenCalledWith(
      '/repo/.node-builder/terminal/my-custom-pack/CustomNode.py',
      'print("node")\n',
      'utf8',
    )
    expect(spawn).toHaveBeenNthCalledWith(1, 'uv', [
      'venv',
      '/repo/.node-builder/terminal/my-custom-pack/.venv',
    ], expect.objectContaining({ cwd: '/repo/.node-builder/terminal/my-custom-pack' }))
    expect(spawn).toHaveBeenNthCalledWith(2, 'uv', [
      'pip',
      'install',
      '--python',
      '/repo/.node-builder/terminal/my-custom-pack/.venv/bin/python',
      '-r',
      '/repo/.node-builder/terminal/my-custom-pack/requirements.txt',
    ], expect.objectContaining({ cwd: '/repo/.node-builder/terminal/my-custom-pack' }))
    expect(spawn.mock.calls[2][2]).toMatchObject({
      cwd: '/repo/.node-builder/terminal/my-custom-pack',
    })
    expect(String(spawn.mock.calls[2][2].env.PATH)).toContain('/repo/.node-builder/terminal/my-custom-pack/.venv/bin')
    expect(result.stdout).toBe('ok\n')
  })
})
