import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { nanoid } from 'nanoid'
import type { Project, NodeSpec } from '../types/index'

const STORAGE_KEY = 'comfyui-node-builder-project'

function defaultProject(): Project {
  return {
    name: 'My Node Pack',
    nodes: [],
    comfyuiUrl: 'http://127.0.0.1:8188',
    comfyuiInstallPath: '',
  }
}

function loadProject(): Project {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Project
  } catch {}
  return defaultProject()
}

export const useProjectStore = defineStore('project', () => {
  const project = ref<Project>(loadProject())

  // Auto-save to localStorage on any project change
  watch(project, (val) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
  }, { deep: true })

  function addNode(): NodeSpec {
    const node: NodeSpec = {
      id: nanoid(),
      name: 'NewNode',
      displayName: 'New Node',
      category: 'custom',
      inputs: [],
      outputs: [],
      widgets: [],
      code: '',
      returnTypes: [],
      returnNames: [],
    }
    project.value.nodes.push(node)
    return node
  }

  function removeNode(id: string) {
    project.value.nodes = project.value.nodes.filter(n => n.id !== id)
  }

  function updateNode(id: string, patch: Partial<NodeSpec>) {
    const node = project.value.nodes.find(n => n.id === id)
    if (node) Object.assign(node, patch)
  }

  function setProjectName(name: string) {
    project.value.name = name
  }

  function setComfyuiUrl(url: string) {
    project.value.comfyuiUrl = url
  }

  function setComfyuiInstallPath(path: string) {
    project.value.comfyuiInstallPath = path
  }

  return {
    project,
    addNode,
    removeNode,
    updateNode,
    setProjectName,
    setComfyuiUrl,
    setComfyuiInstallPath,
  }
})
