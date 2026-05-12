import type * as Monaco from 'monaco-editor'

export const COMFY_EDITOR_THEME_NAME = 'comfy-builder-dark'

export const COMFY_EDITOR_THEME: Monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', foreground: 'edf2fa', background: '0d131d' },
    { token: 'comment', foreground: '687386', fontStyle: 'italic' },
    { token: 'keyword', foreground: '68a7ff' },
    { token: 'number', foreground: 'd6a3ff' },
    { token: 'string', foreground: 'd8b75e' },
    { token: 'type', foreground: 'c785c7' },
    { token: 'identifier', foreground: 'edf2fa' },
  ],
  colors: {
    'editor.background': '#0d131d',
    'editor.foreground': '#edf2fa',
    'editorLineNumber.foreground': '#687386',
    'editorLineNumber.activeForeground': '#a7b0c2',
    'editor.lineHighlightBackground': '#111823',
    'editor.selectionBackground': '#223047',
    'editor.inactiveSelectionBackground': '#1a2433',
    'editorCursor.foreground': '#68a7ff',
    'editorIndentGuide.background1': '#223046',
    'editorIndentGuide.activeBackground1': '#34435b',
    'editorGutter.background': '#0b0f16',
    'editorWidget.background': '#151e2b',
    'editorWidget.border': '#34435b',
    'editorSuggestWidget.background': '#151e2b',
    'editorSuggestWidget.border': '#34435b',
    'editorSuggestWidget.selectedBackground': '#223047',
    'editorHoverWidget.background': '#151e2b',
    'editorHoverWidget.border': '#34435b',
  },
}
