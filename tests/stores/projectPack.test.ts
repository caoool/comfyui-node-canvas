import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useProjectStore } from '../../src/stores/project'
import type { Project } from '../../src/types/index'

const STORAGE_KEY = 'comfyui-node-builder-project'

describe('project pack model', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('migrates legacy node dependencies and custom files into project-level pack fields', () => {
    const legacyProject = {
      name: 'Legacy Pack',
      comfyuiUrl: 'http://127.0.0.1:8188',
      comfyuiInstallPath: '/ComfyUI',
      nodes: [
        {
          id: 'n1',
          name: 'FirstNode',
          displayName: 'First Node',
          category: 'ComfyUINodeBuilder',
          inputs: [],
          outputs: [],
          widgets: [],
          moduleCode: '',
          code: 'return ()',
          pythonRequirements: ['requests'],
          pythonInstallScript: 'print("install first")',
          customFiles: [{ id: 'f1', relativePath: 'shared/helpers.py', content: '# helper\n' }],
          useReturnOverrides: false,
          returnTypes: [],
          returnNames: [],
        },
        {
          id: 'n2',
          name: 'SecondNode',
          displayName: 'Second Node',
          category: 'ComfyUINodeBuilder',
          inputs: [],
          outputs: [],
          widgets: [],
          moduleCode: '',
          code: 'return ()',
          pythonRequirements: ['numpy'],
          pythonInstallScript: 'print("install second")',
          useReturnOverrides: false,
          returnTypes: [],
          returnNames: [],
        },
      ],
    } satisfies Partial<Project>
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyProject))

    const projectStore = useProjectStore()

    expect(projectStore.project.pythonRequirements).toEqual(['requests', 'numpy'])
    expect(projectStore.project.pythonInstallScript).toBe('print("install first")\n\nprint("install second")')
    expect(projectStore.project.customFiles).toEqual([
      { id: 'f1', relativePath: 'shared/helpers.py', content: '# helper\n' },
    ])
    expect(projectStore.project.nodes[0].customFiles).toEqual([])
  })
})
