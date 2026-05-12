import { describe, expect, it, vi } from 'vitest'
import { runDeployPipeline } from '../../src/lib/deployPipeline'

describe('deployPipeline', () => {
  it('deploys, installs dependencies when dependency files exist, then restarts in order', async () => {
    const order: string[] = []
    const result = await runDeployPipeline({
      deploy: vi.fn(async () => {
        order.push('deploy')
        return { success: true, path: '/ComfyUI/custom_nodes/ComfyUINodeBuilder', filesWritten: ['Text.py', 'requirements.txt'], restartRequired: true }
      }),
      installDependencies: vi.fn(async () => {
        order.push('install')
        return { success: true, python: 'python', requirementsPath: 'requirements.txt', installScriptPath: '', stdout: '', stderr: '' }
      }),
      restart: vi.fn(async () => {
        order.push('restart')
      }),
      waitForRestart: vi.fn(async () => {
        order.push('wait')
        return true
      }),
    })

    expect(order).toEqual(['deploy', 'install', 'restart', 'wait'])
    expect(result.installedDependencies).toBe(true)
    expect(result.backOnline).toBe(true)
  })

  it('skips dependency install when the deployed pack has no dependency files', async () => {
    const installDependencies = vi.fn()

    const result = await runDeployPipeline({
      deploy: vi.fn(async () => ({ success: true, path: '/pack', filesWritten: ['Text.py', '__init__.py'], restartRequired: true })),
      installDependencies,
      restart: vi.fn(async () => {}),
      waitForRestart: vi.fn(async () => false),
    })

    expect(installDependencies).not.toHaveBeenCalled()
    expect(result.installedDependencies).toBe(false)
    expect(result.backOnline).toBe(false)
  })
})
