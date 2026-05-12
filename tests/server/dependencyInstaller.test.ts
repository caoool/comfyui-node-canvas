import { describe, expect, it, vi } from 'vitest'
import { installManagedPackDependencies, installScriptPathFor, requirementsPathFor, resolveComfyPython } from '../../server/dependencyInstaller'

describe('dependencyInstaller', () => {
  it('resolves requirements.txt inside the managed pack', () => {
    expect(requirementsPathFor('/ComfyUI')).toBe('/ComfyUI/custom_nodes/ComfyUINodeBuilder/requirements.txt')
    expect(installScriptPathFor('/ComfyUI')).toBe('/ComfyUI/custom_nodes/ComfyUINodeBuilder/install.py')
    expect(requirementsPathFor('/ComfyUI', 'MyPack')).toBe('/ComfyUI/custom_nodes/MyPack/requirements.txt')
    expect(installScriptPathFor('/ComfyUI', 'MyPack')).toBe('/ComfyUI/custom_nodes/MyPack/install.py')
  })

  it('prefers ComfyUI virtualenv python executables', () => {
    const exists = (candidate: string) => candidate === '/ComfyUI/.venv/bin/python'
    expect(resolveComfyPython('/ComfyUI', exists)).toBe('/ComfyUI/.venv/bin/python')
  })

  it('uses the embedded Windows python when present', () => {
    const exists = (candidate: string) => candidate.endsWith('python_embeded/python.exe')
    expect(resolveComfyPython('/ComfyUI', exists)).toBe('/ComfyUI/python_embeded/python.exe')
  })

  it('runs pip against the managed requirements file', async () => {
    const spawn = vi.fn((command: string, args: string[]) => ({
      stdout: { on: vi.fn((event: string, cb: (chunk: Buffer) => void) => { if (event === 'data') cb(Buffer.from('ok')) }) },
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, cb: (code?: number) => void) => { if (event === 'close') cb(0) }),
      kill: vi.fn(),
    }))
    const result = await installManagedPackDependencies('/ComfyUI', {
      exists: (candidate) => candidate === '/ComfyUI/.venv/bin/python' || candidate.endsWith('requirements.txt'),
      spawn,
    })
    expect(spawn).toHaveBeenCalledWith('/ComfyUI/.venv/bin/python', [
      '-m',
      'pip',
      'install',
      '-r',
      '/ComfyUI/custom_nodes/ComfyUINodeBuilder/requirements.txt',
    ], expect.objectContaining({ cwd: '/ComfyUI' }))
    expect(result.stdout).toBe('ok')
  })

  it('runs install.py before pip when both are present', async () => {
    const spawn = vi.fn(() => ({
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, cb: (code?: number) => void) => { if (event === 'close') cb(0) }),
      kill: vi.fn(),
    }))
    await installManagedPackDependencies('/ComfyUI', 'MyPack', {
      exists: (candidate) =>
        candidate === '/ComfyUI/.venv/bin/python' ||
        candidate === '/ComfyUI/custom_nodes/MyPack/requirements.txt' ||
        candidate === '/ComfyUI/custom_nodes/MyPack/install.py',
      spawn,
    })
    expect(spawn).toHaveBeenNthCalledWith(1, '/ComfyUI/.venv/bin/python', [
      '/ComfyUI/custom_nodes/MyPack/install.py',
    ], expect.objectContaining({ cwd: '/ComfyUI' }))
    expect(spawn).toHaveBeenNthCalledWith(2, '/ComfyUI/.venv/bin/python', [
      '-m',
      'pip',
      'install',
      '-r',
      '/ComfyUI/custom_nodes/MyPack/requirements.txt',
    ], expect.objectContaining({ cwd: '/ComfyUI' }))
  })

  it('falls back to uv when ComfyUI Python has no pip module', async () => {
    const spawn = vi.fn((_command: string, args: string[]) => ({
      stdout: { on: vi.fn((event: string, cb: (chunk: Buffer) => void) => {
        if (event === 'data' && args[0] === 'pip') cb(Buffer.from('uv ok'))
      }) },
      stderr: { on: vi.fn((event: string, cb: (chunk: Buffer) => void) => {
        if (event === 'data' && args[0] === '-m') cb(Buffer.from('No module named pip'))
      }) },
      on: vi.fn((event: string, cb: (value?: number | Error | null) => void) => {
        if (event === 'close') cb(args[0] === '-m' ? 1 : 0)
      }),
      kill: vi.fn(),
    }))

    const result = await installManagedPackDependencies('/ComfyUI', {
      exists: (candidate) => candidate === '/ComfyUI/.venv/bin/python' || candidate.endsWith('requirements.txt'),
      spawn,
    })

    expect(spawn).toHaveBeenNthCalledWith(1, '/ComfyUI/.venv/bin/python', [
      '-m',
      'pip',
      'install',
      '-r',
      '/ComfyUI/custom_nodes/ComfyUINodeBuilder/requirements.txt',
    ], expect.objectContaining({ cwd: '/ComfyUI' }))
    expect(spawn).toHaveBeenNthCalledWith(2, 'uv', [
      'pip',
      'install',
      '--python',
      '/ComfyUI/.venv/bin/python',
      '-r',
      '/ComfyUI/custom_nodes/ComfyUINodeBuilder/requirements.txt',
    ], expect.objectContaining({ cwd: '/ComfyUI' }))
    expect(result.stdout).toBe('uv ok')
  })
})
