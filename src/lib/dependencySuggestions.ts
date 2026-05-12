export interface DependencySuggestion {
  importName: string
  requirement: string
  reason: string
}

const PYTHON_STDLIB_MODULES = new Set([
  '__future__',
  'abc',
  'argparse',
  'asyncio',
  'base64',
  'collections',
  'contextlib',
  'copy',
  'csv',
  'dataclasses',
  'datetime',
  'decimal',
  'enum',
  'functools',
  'glob',
  'hashlib',
  'http',
  'importlib',
  'inspect',
  'io',
  'itertools',
  'json',
  'logging',
  'math',
  'multiprocessing',
  'os',
  'pathlib',
  'pickle',
  'platform',
  'random',
  're',
  'shutil',
  'statistics',
  'string',
  'subprocess',
  'sys',
  'tempfile',
  'threading',
  'time',
  'traceback',
  'typing',
  'urllib',
  'uuid',
  'wave',
  'weakref',
  'xml',
  'zipfile',
])

const COMFYUI_RUNTIME_MODULES = new Set([
  'comfy',
  'comfy_extras',
  'execution',
  'folder_paths',
  'latent_preview',
  'node_helpers',
  'nodes',
  'server',
  'torch',
])

const IMPORT_TO_REQUIREMENT: Record<string, string> = {
  bs4: 'beautifulsoup4',
  cv2: 'opencv-python',
  dateutil: 'python-dateutil',
  dotenv: 'python-dotenv',
  huggingface_hub: 'huggingface_hub',
  PIL: 'Pillow',
  skimage: 'scikit-image',
  sklearn: 'scikit-learn',
  x_transformers: 'x-transformers',
  yaml: 'PyYAML',
}

function stripInlineComment(line: string): string {
  let quote = ''
  let escaped = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (quote) {
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '#') return line.slice(0, i)
  }
  return line
}

function rootModuleName(rawName: string): string {
  return rawName.trim().split(/\s+as\s+/i)[0]?.split('.')[0]?.trim() ?? ''
}

export function requirementPackageKey(requirement: string): string {
  return requirement
    .trim()
    .replace(/\s+#.*$/, '')
    .split(/[<>=!~\[]/, 1)[0]
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
}

function isIgnoredImport(importName: string): boolean {
  return PYTHON_STDLIB_MODULES.has(importName) || COMFYUI_RUNTIME_MODULES.has(importName)
}

export function extractPythonImportRoots(source: string): string[] {
  const roots: string[] = []
  const seen = new Set<string>()

  for (const rawLine of source.split('\n')) {
    const line = stripInlineComment(rawLine).trim()
    if (!line) continue

    const importMatch = line.match(/^import\s+(.+)$/)
    if (importMatch) {
      for (const part of importMatch[1].split(',')) {
        const root = rootModuleName(part)
        if (!root || seen.has(root)) continue
        seen.add(root)
        roots.push(root)
      }
      continue
    }

    const fromMatch = line.match(/^from\s+([A-Za-z_][\w.]*)\s+import\s+/)
    if (fromMatch) {
      const root = rootModuleName(fromMatch[1])
      if (!root || seen.has(root)) continue
      seen.add(root)
      roots.push(root)
    }
  }

  return roots
}

export function suggestPythonRequirementsFromCode(
  moduleCode: string,
  executeCode: string,
  existingRequirements: string[] = [],
): DependencySuggestion[] {
  const existing = new Set(existingRequirements.map(requirementPackageKey).filter(Boolean))
  const suggestions: DependencySuggestion[] = []
  const suggested = new Set<string>()

  for (const importName of extractPythonImportRoots(`${moduleCode}\n${executeCode}`)) {
    if (isIgnoredImport(importName)) continue
    const requirement = IMPORT_TO_REQUIREMENT[importName] ?? importName
    const key = requirementPackageKey(requirement)
    if (!key || existing.has(key) || suggested.has(key)) continue
    suggested.add(key)
    suggestions.push({
      importName,
      requirement,
      reason: importName === requirement
        ? `Detected import ${importName}`
        : `${importName} is usually installed from ${requirement}`,
    })
  }

  return suggestions
}
