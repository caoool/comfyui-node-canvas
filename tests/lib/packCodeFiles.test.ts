import { describe, expect, it } from 'vitest'
import { buildPackCodeFileTree, buildPackCodeFiles } from '../../src/lib/packCodeFiles'
import type { NodeSpec, Project } from '../../src/types/index'

function makeNode(overrides: Partial<NodeSpec> = {}): NodeSpec {
  return {
    id: 'n1',
    name: 'TextUtility',
    displayName: 'Text Utility',
    category: 'ComfyUINodeBuilder',
    inputs: [],
    outputs: [],
    widgets: [],
    uiOutputs: [],
    moduleCode: '',
    code: 'text = "ok"',
    pythonRequirements: ['requests'],
    pythonInstallScript: 'print("install")',
    useReturnOverrides: false,
    returnTypes: [],
    returnNames: [],
    ...overrides,
  }
}

function makeProject(nodes: NodeSpec[] = [makeNode()]): Project {
  return {
    name: 'ComfyUINodeBuilder',
    packFolderName: 'MyBuilderPack',
    nodes,
    comfyuiUrl: 'http://127.0.0.1:8188',
    comfyuiInstallPath: '/home/lu/ComfyUI',
    pythonRequirements: ['pack-req'],
    pythonInstallScript: 'print("pack install")',
    customFiles: [
      { id: 'shared-1', relativePath: 'shared/helpers.py', content: '# shared\n' },
    ],
  }
}

describe('packCodeFiles', () => {
  it('lists all managed pack files, not only the selected node Python file', () => {
    const files = buildPackCodeFiles(makeProject([
      makeNode(),
      makeNode({
        id: 'n2',
        name: 'ImageUtility',
        displayName: 'Image Utility',
        pythonRequirements: ['numpy'],
        pythonInstallScript: 'print("image install")',
      }),
    ]), 'n1')
    const paths = files.map(file => file.path)

    expect(paths).toContain('/home/lu/ComfyUI/custom_nodes/ComfyUINodeBuilder/MyBuilderPack/TextUtility.py')
    expect(paths).toContain('/home/lu/ComfyUI/custom_nodes/ComfyUINodeBuilder/MyBuilderPack/ImageUtility.py')
    expect(paths).toContain('/home/lu/ComfyUI/custom_nodes/ComfyUINodeBuilder/MyBuilderPack/requirements.txt')
    expect(paths).toContain('/home/lu/ComfyUI/custom_nodes/ComfyUINodeBuilder/MyBuilderPack/install.py')
    expect(paths).toContain('/home/lu/ComfyUI/custom_nodes/ComfyUINodeBuilder/MyBuilderPack/shared/helpers.py')
    expect(paths).toContain('/home/lu/ComfyUI/custom_nodes/ComfyUINodeBuilder/MyBuilderPack/__init__.py')
    expect(paths).toContain('/home/lu/ComfyUI/custom_nodes/ComfyUINodeBuilder/MyBuilderPack/builder.project.json')
    expect(paths).toContain('/home/lu/ComfyUI/custom_nodes/ComfyUINodeBuilder/MyBuilderPack/web/runtimeUiDisplays.js')

    expect(files.find(file => file.filename === 'requirements.txt')?.text).toBe('pack-req\n')
    expect(files.find(file => file.filename === 'install.py')?.text).toBe('print("pack install")\n')
    expect(files.find(file => file.relativePath === 'ImageUtility.py')).toMatchObject({
      kind: 'node-python',
      nodeId: 'n2',
      persistent: true,
      deletable: false,
    })
    expect(files.find(file => file.relativePath === '__init__.py')).toMatchObject({
      kind: 'generated',
      language: 'python',
      deletable: false,
    })
    expect(files.find(file => file.relativePath === 'builder.project.json')).toMatchObject({
      kind: 'generated',
      language: 'json',
      protected: true,
      deletable: false,
    })
  })

  it('marks node Python files with node ids and readable language ids', () => {
    const files = buildPackCodeFiles(makeProject(), 'n1')
    const nodeFile = files.find(file => file.filename === 'TextUtility.py')
    const requirementsFile = files.find(file => file.filename === 'requirements.txt')
    const installFile = files.find(file => file.filename === 'install.py')

    expect(nodeFile).toMatchObject({ kind: 'node-python', nodeId: 'n1', language: 'python', persistent: true, deletable: false })
    expect(requirementsFile).toMatchObject({ kind: 'requirements', nodeId: undefined, language: 'plaintext', persistent: true, deletable: false, scope: 'project' })
    expect(installFile).toMatchObject({ kind: 'install', nodeId: undefined, language: 'python', persistent: true, deletable: false, scope: 'project' })
  })

  it('keeps all pack files visible when the selected node changes', () => {
    const project = makeProject([
      makeNode(),
      makeNode({
        id: 'n2',
        name: 'PlainNode',
        displayName: 'Plain Node',
        pythonRequirements: [],
        pythonInstallScript: '',
      }),
    ])

    const files = buildPackCodeFiles(project, 'n2')

    expect(files.map(file => file.relativePath)).toEqual([
      'PlainNode.py',
      'TextUtility.py',
      'requirements.txt',
      'install.py',
      'shared/helpers.py',
      '__init__.py',
      'builder.project.json',
      'web/runtimeUiDisplays.js',
    ])
    expect(files.find(file => file.relativePath === 'requirements.txt')?.text).toBe('pack-req\n')
    expect(files.find(file => file.relativePath === 'install.py')?.text).toBe('print("pack install")\n')
  })

  it('shows shared runtime UI support in the pack file tree', () => {
    const files = buildPackCodeFiles(makeProject([
      makeNode({
        uiOutputs: [{ id: 'ui1', key: 'text', kind: 'text', label: 'Text' }],
      }),
    ]), 'n1')

    expect(files.find(file => file.relativePath === 'web/runtimeUiDisplays.js')).toMatchObject({
      kind: 'generated',
      language: 'javascript',
      protected: true,
      deletable: false,
    })
  })

  it('shows editable custom UI renderer files for every node that uses custom Return UI', () => {
    const files = buildPackCodeFiles(makeProject([
      makeNode({
        uiOutputs: [{ id: 'ui1', key: 'preview', kind: 'custom', label: 'Preview' }],
      }),
      makeNode({
        id: 'n2',
        name: 'OtherUtility',
        displayName: 'Other Utility',
        uiOutputs: [{ id: 'ui2', key: 'preview', kind: 'custom', label: 'Preview' }],
      }),
    ]), 'n1')
    const customFile = files.find(file => file.relativePath === 'web/TextUtility.customRenderer.js')
    const otherCustomFile = files.find(file => file.relativePath === 'web/OtherUtility.customRenderer.js')

    expect(customFile).toMatchObject({
      kind: 'custom-ui',
      nodeId: 'n1',
      language: 'javascript',
    })
    expect(customFile?.text).toContain('Edit renderCustomUi')
    expect(otherCustomFile).toMatchObject({
      kind: 'custom-ui',
      nodeId: 'n2',
      language: 'javascript',
    })
  })

  it('uses persistent full node Python source and lists deletable shared custom files for the project', () => {
    const source = 'class TextUtility:\n    pass\n'
    const project = makeProject([makeNode({ pythonSource: source })])
    project.customFiles = [
      { id: 'f1', relativePath: 'helpers/text_tools.py', content: '# helper\n' },
    ]
    const files = buildPackCodeFiles(project, 'n1')
    const nodeFile = files.find(file => file.relativePath === 'TextUtility.py')
    const helperFile = files.find(file => file.relativePath === 'helpers/text_tools.py')

    expect(nodeFile?.text).toBe(source)
    expect(nodeFile).toMatchObject({ persistent: true, deletable: false })
    expect(helperFile).toMatchObject({
      kind: 'custom-file',
      nodeId: undefined,
      scope: 'project',
      language: 'python',
      text: '# helper\n',
      persistent: false,
      deletable: true,
    })
  })

  it('can list generated pack files before a node is selected', () => {
    const files = buildPackCodeFiles(makeProject(), null)

    expect(files.map(file => file.relativePath)).toContain('TextUtility.py')
    expect(files.map(file => file.relativePath)).toContain('__init__.py')
    expect(files.map(file => file.relativePath)).toContain('builder.project.json')
  })

  it('preserves directory structure in a file-tree model', () => {
    const files = buildPackCodeFiles(makeProject([makeNode({
      uiOutputs: [{ id: 'ui1', key: 'preview', kind: 'custom', label: 'Preview' }],
    })]), 'n1')
    const tree = buildPackCodeFileTree(files)

    expect(tree.map(entry => [entry.kind, entry.depth, entry.relativePath, entry.name])).toEqual([
      ['file', 0, 'TextUtility.py', 'TextUtility.py'],
      ['file', 0, 'requirements.txt', 'requirements.txt'],
      ['file', 0, 'install.py', 'install.py'],
      ['directory', 0, 'shared', 'shared'],
      ['file', 1, 'shared/helpers.py', 'helpers.py'],
      ['directory', 0, 'web', 'web'],
      ['file', 1, 'web/TextUtility.customRenderer.js', 'TextUtility.customRenderer.js'],
      ['file', 1, 'web/runtimeUiDisplays.js', 'runtimeUiDisplays.js'],
      ['file', 0, '__init__.py', '__init__.py'],
      ['file', 0, 'builder.project.json', 'builder.project.json'],
    ])
    expect(tree.find(entry => entry.relativePath === 'builder.project.json')).toMatchObject({
      kind: 'file',
      protected: true,
    })
    expect(tree.find(entry => entry.relativePath === 'shared/helpers.py')).toMatchObject({
      kind: 'file',
      protected: false,
    })
  })

  it('marks directories deletable only when they contain no protected files', () => {
    const project = makeProject()
    project.customDirectories = [
      { id: 'scratch', relativePath: 'scratch' },
      { id: 'web-extra', relativePath: 'web/extra' },
    ]
    project.customFiles = [
      { id: 'scratch-file', relativePath: 'scratch/tmp.txt', content: 'temp\n' },
      { id: 'extra-file', relativePath: 'web/extra/readme.md', content: '# ok\n' },
    ]
    const tree = buildPackCodeFileTree(buildPackCodeFiles(project, 'n1'), project.customDirectories)

    expect(tree.find(entry => entry.relativePath === 'scratch')).toMatchObject({
      kind: 'directory',
      protected: false,
      deletable: true,
    })
    expect(tree.find(entry => entry.relativePath === 'web')).toMatchObject({
      kind: 'directory',
      protected: true,
      deletable: false,
    })
    expect(tree.find(entry => entry.relativePath === 'web/extra')).toMatchObject({
      kind: 'directory',
      protected: false,
      deletable: true,
    })
  })

  it('merges deployed filesystem-only files and directories into the protected file tree', () => {
    const project = makeProject()
    const filesystemEntries = [
      { kind: 'directory' as const, relativePath: 'vendor' },
      { kind: 'directory' as const, relativePath: 'vendor/CosyVoice' },
      { kind: 'file' as const, relativePath: 'vendor/CosyVoice/README.md' },
      { kind: 'directory' as const, relativePath: 'external/empty' },
    ]
    const files = buildPackCodeFiles(project, 'n1', filesystemEntries)
    const tree = buildPackCodeFileTree(files, project.customDirectories, filesystemEntries)

    expect(files.find(file => file.relativePath === 'vendor/CosyVoice/README.md')).toMatchObject({
      kind: 'filesystem',
      protected: true,
      deletable: false,
      language: 'markdown',
    })
    expect(tree.find(entry => entry.relativePath === 'vendor')).toMatchObject({
      kind: 'directory',
      protected: true,
      deletable: false,
    })
    expect(tree.find(entry => entry.relativePath === 'external/empty')).toMatchObject({
      kind: 'directory',
      protected: true,
      deletable: false,
    })
  })
})
