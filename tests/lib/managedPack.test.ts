import { describe, expect, it } from 'vitest'
import {
  BUILDER_METADATA_FILE,
  MANAGED_PACK_NAME,
  buildManagedPackFiles,
  parseManagedProjectFile,
} from '../../src/lib/managedPack'
import type { NodeSpec, Project } from '../../src/types/index'

function makeNode(overrides: Partial<NodeSpec> = {}): NodeSpec {
  return {
    id: 'n1',
    name: 'ImageNode',
    displayName: 'Image Node',
    category: 'custom',
    inputs: [],
    outputs: [],
    widgets: [],
    moduleCode: '',
    code: 'return (image,)',
    useReturnOverrides: false,
    returnTypes: [],
    returnNames: [],
    ...overrides,
  }
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    name: 'My Pack',
    nodes: [makeNode()],
    comfyuiUrl: 'http://127.0.0.1:8188',
    comfyuiInstallPath: '/tmp/ComfyUI',
    pythonRequirements: [],
    pythonInstallScript: '',
    customFiles: [],
    ...overrides,
  }
}

describe('managedPack', () => {
  it('uses the fixed builder-managed pack name', () => {
    expect(MANAGED_PACK_NAME).toBe('ComfyUINodeBuilder')
  })

  it('adds builder.project.json beside generated Python files', () => {
    const files = buildManagedPackFiles(makeProject())
    expect(Object.keys(files).sort()).toEqual([
      'ImageNode.py',
      '__init__.py',
      BUILDER_METADATA_FILE,
      'web/runtimeUiDisplays.js',
    ])
  })

  it('emits project-level shared files, requirements, and install script for the whole pack', () => {
    const files = buildManagedPackFiles(makeProject({
      pythonRequirements: ['requests', 'numpy'],
      pythonInstallScript: 'print("pack install")',
      customFiles: [
        { id: 'helper', relativePath: 'shared/audio_tools.py', content: 'VALUE = 1\n' },
      ],
    }))

    expect(files['requirements.txt']).toBe('requests\nnumpy\n')
    expect(files['install.py']).toBe('print("pack install")\n')
    expect(files['shared/audio_tools.py']).toBe('VALUE = 1\n')
  })

  it('stores the editable project model in metadata', () => {
    const project = makeProject({ name: 'Editable Source' })
    const files = buildManagedPackFiles(project)
    const parsed = JSON.parse(files[BUILDER_METADATA_FILE])
    expect(parsed.builder).toBe('comfyui-node-builder')
    expect(parsed.schemaVersion).toBe(1)
    expect(parsed.project.name).toBe('Editable Source')
    expect(parsed.project.nodes[0].name).toBe('ImageNode')
  })

  it('stores generated Python source in sync with current node fields', () => {
    const staleSource = buildManagedPackFiles(makeProject({
      nodes: [makeNode({
        moduleCode: 'OLD_VALUE = 1',
        code: 'value = "old"',
      })],
    }))['ImageNode.py']
    const files = buildManagedPackFiles(makeProject({
      nodes: [makeNode({
        moduleCode: 'NEW_VALUE = 2',
        code: 'value = "new"',
        pythonSource: staleSource,
      })],
    }))
    const parsed = JSON.parse(files[BUILDER_METADATA_FILE])
    const node = parsed.project.nodes[0]

    expect(files['ImageNode.py']).toContain('NEW_VALUE = 2')
    expect(files['ImageNode.py']).toContain('value = "new"')
    expect(node.moduleCode).toBe('NEW_VALUE = 2')
    expect(node.code).toBe('value = "new"')
    expect(node.pythonSource).toContain('NEW_VALUE = 2')
    expect(node.pythonSource).toContain('value = "new"')
    expect(node.pythonSource).not.toContain('OLD_VALUE = 1')
    expect(node.pythonSource).not.toContain('value = "old"')
  })

  it('parses current managed metadata wrapper', () => {
    const project = makeProject({ name: 'Loaded' })
    const loaded = parseManagedProjectFile(buildManagedPackFiles(project)[BUILDER_METADATA_FILE])
    expect(loaded.name).toBe('Loaded')
  })

  it('rejects older raw project metadata without builder ownership marker', () => {
    const project = makeProject({ name: 'Legacy' })
    expect(() => parseManagedProjectFile(JSON.stringify(project))).toThrow('not owned')
  })

  it('rejects metadata owned by another tool', () => {
    const project = makeProject({ name: 'Other Tool' })
    expect(() => parseManagedProjectFile(JSON.stringify({
      builder: 'other-builder',
      schemaVersion: 1,
      project,
    }))).toThrow('not owned')
  })
})
