import { describe, expect, it } from 'vitest'
import { COMFY_EDITOR_THEME, COMFY_EDITOR_THEME_NAME } from '../../src/lib/editorTheme'

describe('editorTheme', () => {
  it('uses app surface colors for the Monaco editor shell', () => {
    expect(COMFY_EDITOR_THEME_NAME).toBe('comfy-builder-dark')
    expect(COMFY_EDITOR_THEME.colors['editor.background']).toBe('#0d131d')
    expect(COMFY_EDITOR_THEME.colors['editorGutter.background']).toBe('#0b0f16')
    expect(COMFY_EDITOR_THEME.colors['editor.lineHighlightBackground']).toBe('#111823')
    expect(COMFY_EDITOR_THEME.colors['editor.selectionBackground']).toBe('#223047')
    expect(COMFY_EDITOR_THEME.rules.find(rule => rule.token === '')).toMatchObject({
      foreground: 'edf2fa',
    })
  })
})
