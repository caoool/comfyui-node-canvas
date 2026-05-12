import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../../src/stores/ui'

describe('ui terminal state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('toggles the bottom terminal panel from shared UI state', () => {
    const uiStore = useUiStore()

    expect(uiStore.terminalOpen).toBe(false)

    uiStore.toggleTerminal()
    expect(uiStore.terminalOpen).toBe(true)

    uiStore.setTerminalOpen(false)
    expect(uiStore.terminalOpen).toBe(false)
  })

  it('mirrors diagnostics into builder logs for the output panel', () => {
    const uiStore = useUiStore()

    uiStore.addDiagnostic('warning', 'Deploy warning', 'Restart status unknown', false)

    expect(uiStore.builderLogs[0]).toMatchObject({
      source: 'diagnostic',
      level: 'warning',
      message: 'Deploy warning\nRestart status unknown',
    })
  })
})
