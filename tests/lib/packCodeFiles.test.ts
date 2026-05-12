import { describe, expect, it } from 'vitest'
import { buildPackCodeFiles } from '../../src/lib/packCodeFiles'
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
  it('lists project files plus only the selected node Python file', () => {
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

    expect(paths).toContain('/home/lu/ComfyUI/custom_nodes/MyBuilderPack/TextUtility.py')
    expect(paths).toContain('/home/lu/ComfyUI/custom_nodes/MyBuilderPack/requirements.txt')
    expect(paths).toContain('/home/lu/ComfyUI/custom_nodes/MyBuilderPack/install.py')
    expect(paths).toContain('/home/lu/ComfyUI/custom_nodes/MyBuilderPack/shared/helpers.py')
    expect(paths).not.toContain('/home/lu/ComfyUI/custom_nodes/MyBuilderPack/ImageUtility.py')
    expect(paths).not.toContain('/home/lu/ComfyUI/custom_nodes/MyBuilderPack/__init__.py')
    expect(paths).not.toContain('/home/lu/ComfyUI/custom_nodes/MyBuilderPack/builder.project.json')
    expect(paths).not.toContain('/home/lu/ComfyUI/custom_nodes/MyBuilderPack/web/runtimeUiDisplays.js')

    expect(files.find(file => file.filename === 'requirements.txt')?.text).toBe('pack-req\n')
    expect(files.find(file => file.filename === 'install.py')?.text).toBe('print("pack install")\n')
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

  it('switches file sets when the selected node changes', () => {
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

    expect(files.map(file => file.relativePath)).toEqual(['PlainNode.py', 'requirements.txt', 'install.py', 'shared/helpers.py'])
    expect(files.find(file => file.relativePath === 'requirements.txt')?.text).toBe('pack-req\n')
    expect(files.find(file => file.relativePath === 'install.py')?.text).toBe('print("pack install")\n')
  })

  it('hides shared runtime UI support from selected-node code tabs', () => {
    const files = buildPackCodeFiles(makeProject([
      makeNode({
        uiOutputs: [{ id: 'ui1', key: 'text', kind: 'text', label: 'Text' }],
      }),
    ]), 'n1')

    expect(files.map(file => file.relativePath)).not.toContain('web/runtimeUiDisplays.js')
  })

  it('shows an editable custom UI renderer file only for nodes that use custom Return UI', () => {
    const files = buildPackCodeFiles(makeProject([
      makeNode({
        uiOutputs: [{ id: 'ui1', key: 'preview', kind: 'custom', label: 'Preview' }],
      }),
    ]), 'n1')
    const customFile = files.find(file => file.relativePath === 'web/TextUtility.customRenderer.js')

    expect(customFile).toMatchObject({
      kind: 'custom-ui',
      nodeId: 'n1',
      language: 'javascript',
    })
    expect(customFile?.text).toContain('Edit renderCustomUi')
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
})
