<template>
  <div class="code-panel" :class="{ 'code-panel-focus': focusMode }">
    <div v-if="!activeFile" class="no-node">
      No pack files to preview.
    </div>
    <template v-else>
      <div class="code-toolbar">
        <div class="code-title-wrap">
          <div class="code-title" :class="{ 'code-title-error': activeIssueCount > 0 }" :title="activeFile.path">
            {{ activeFile.path }}
            <span v-if="activeIssueCount" class="lint-badge">{{ activeIssueCount }}</span>
          </div>
          <div class="code-legend">
            <span v-if="activeFileIsEditable" class="legend-chip legend-editable">Editable</span>
            <span>{{ activeFileLegendText }}</span>
            <span v-if="activeFile.protected" class="legend-chip legend-generated">Protected</span>
            <span v-if="activeFile.kind === 'node-python'">whole file syncs with node preview</span>
            <span v-else-if="activeFile.kind === 'generated'">pack file read-only</span>
          </div>
        </div>
        <div class="editor-actions">
          <button class="tool-btn" :class="{ active: wordWrap }" @click="wordWrap = !wordWrap">Wrap</button>
          <button class="tool-btn" :class="{ active: minimapEnabled }" @click="minimapEnabled = !minimapEnabled">Map</button>
          <button class="tool-btn" @click="copyActiveFile">Copy</button>
          <button
            class="tool-btn icon-tool-btn"
            :class="{ active: focusMode }"
            :aria-label="focusMode ? 'Exit full screen code editor' : 'Expand code editor full screen'"
            :title="focusMode ? 'Exit full screen' : 'Expand full screen'"
            @click="focusMode = !focusMode"
          >
            <svg v-if="!focusMode" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3H3v3" />
              <path d="M3 3l4 4" />
              <path d="M10 13h3v-3" />
              <path d="M13 13l-4-4" />
            </svg>
            <svg v-else viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 6h3V3" />
              <path d="M6 6 2.5 2.5" />
              <path d="M13 10h-3v3" />
              <path d="m10 10 3.5 3.5" />
            </svg>
          </button>
        </div>
      </div>

      <div class="code-workspace">
        <aside class="file-explorer" aria-label="Pack files">
          <div class="file-explorer-head">
            <span>Files</span>
            <div class="file-create-actions">
              <button class="tool-btn tool-btn-compact" @click="startCreatingFile">+ File</button>
              <button data-testid="start-create-directory" class="tool-btn tool-btn-compact" @click="startCreatingDirectory">+ Dir</button>
            </div>
          </div>
          <form v-if="creatingFile" class="new-file-form" @submit.prevent="createCustomFile">
            <input
              v-model="newFilePath"
              class="new-file-input"
              placeholder="helpers.py"
              spellcheck="false"
              aria-label="New custom file path"
            />
            <div class="new-file-actions">
              <button class="tool-btn tool-btn-compact" type="submit">Create</button>
              <button class="tool-btn tool-btn-compact" type="button" @click="cancelCreatingFile">Cancel</button>
            </div>
            <div v-if="newFileError" class="new-file-error">{{ newFileError }}</div>
          </form>
          <form
            v-if="creatingDirectory"
            data-testid="create-directory"
            class="new-file-form"
            @submit.prevent="createCustomDirectory"
          >
            <input
              v-model="newDirectoryPath"
              data-testid="new-directory-path"
              class="new-file-input"
              placeholder="assets/audio"
              spellcheck="false"
              aria-label="New custom directory path"
            />
            <div class="new-file-actions">
              <button class="tool-btn tool-btn-compact" type="submit">Create</button>
              <button class="tool-btn tool-btn-compact" type="button" @click="cancelCreatingDirectory">Cancel</button>
            </div>
            <div v-if="newDirectoryError" class="new-file-error">{{ newDirectoryError }}</div>
          </form>
          <div class="file-list" role="tablist">
            <template v-for="entry in visibleFileTreeEntries" :key="entry.id">
              <div
                v-if="entry.kind === 'directory'"
                class="file-tree-directory"
                :style="{ paddingLeft: `${6 + entry.depth * 14}px` }"
                :data-testid="`directory-${entry.relativePath}`"
                @click="toggleDirectory(entry.relativePath)"
              >
                <span
                  class="file-dir-chevron"
                  :class="{ collapsed: isDirectoryCollapsed(entry.relativePath) }"
                  aria-hidden="true"
                ></span>
                <span class="file-tab-name">{{ entry.name }}</span>
                <button
                  v-if="entry.deletable"
                  class="file-delete"
                  :data-testid="`delete-directory-${entry.relativePath}`"
                  title="Delete directory"
                  @click.stop="deleteDirectory(entry.relativePath)"
                >
                  ×
                </button>
              </div>
              <button
                v-else
                class="file-row"
                :class="{
                  active: entry.file.path === activeFile.path,
                  'file-row-error': entry.file.path === activeFile.path && activeIssueCount > 0,
                  'file-row-node': entry.file.kind === 'node-python',
                  'file-row-custom': entry.file.kind === 'custom-file',
                }"
                role="tab"
                :aria-selected="entry.file.path === activeFile.path"
                :title="entry.file.path"
                :style="{ paddingLeft: `${6 + entry.depth * 14}px` }"
                @click="selectFile(entry.file.path)"
              >
                <span class="file-kind-dot"></span>
                <span class="file-tab-name">{{ entry.name }}</span>
                <span v-if="entry.protected" class="file-protect-chip">Protected</span>
                <button
                  v-if="entry.file.deletable"
                  class="file-delete"
                  title="Delete custom file"
                  @click.stop="deleteCustomFile(entry.file)"
                >
                  ×
                </button>
              </button>
            </template>
          </div>
        </aside>

        <section class="file-viewer">
          <div v-if="activeIssues.length" class="sync-error-panel">
            <div class="sync-error-title">Code needs attention</div>
            <div v-for="item in activeIssues" :key="`${item.line}-${item.startCol}-${item.message}`" class="sync-error-item">
              <span>{{ item.line }}:{{ item.startCol }}</span>
              <strong>{{ item.message }}</strong>
            </div>
          </div>

          <div class="file-viewer-header" :class="{ 'file-viewer-header-error': activeIssueCount > 0 }">
            <span>{{ activeFile.relativePath }}</span>
            <div class="dependency-file-actions">
              <span v-if="activeFileIsEditable" class="block-badge editable-badge">editable</span>
              <span v-else class="block-badge">read-only</span>
              <button v-if="activeFile.kind === 'requirements'" class="tool-btn" @click="refreshImportSuggestions(true)">
                Re-scan Imports
              </button>
            </div>
          </div>
          <div v-if="activeFile.kind === 'requirements' && (visibleImportSuggestions.length > 0 || scanRan)" class="dependency-suggestion-bar">
            <span class="dependency-suggestion-label">Detected imports</span>
            <button
              v-for="suggestion in visibleImportSuggestions"
              :key="suggestion.requirement"
              class="suggestion-chip"
              :title="suggestion.reason"
              @click="addRequirement(suggestion.requirement)"
            >
              + {{ suggestion.requirement }}
            </button>
            <button
              v-if="visibleImportSuggestions.length > 1"
              class="suggestion-chip add-all"
              @click="addAllSuggestions"
            >
              Add all
            </button>
            <span v-if="visibleImportSuggestions.length === 0" class="dependency-empty">No missing packages found.</span>
          </div>
          <div class="full-file-editor-wrap">
            <VueMonacoEditor
              :language="activeFile.language"
              :theme="monacoTheme"
              :value="activeFile.text"
              :options="activeFileIsEditable ? editableFileEditorOptions : readonlyFileEditorOptions"
              @mount="onFileEditorMount"
              @change="updateActiveFile"
            />
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'
import type * as Monaco from 'monaco-editor'
import { nanoid } from 'nanoid'
import { useProjectStore } from '../stores/project'
import { useUiStore } from '../stores/ui'
import { lintPython, type LintIssue } from '../lib/lintPython'
import { extractPythonVariableNames } from '../lib/returnCode'
import { buildPackCodeFileTree, buildPackCodeFiles, type PackCodeFile } from '../lib/packCodeFiles'
import { isReservedProjectFilePath, normalizeCustomNodeDirectoryPath, normalizeCustomNodeFilePath } from '../lib/nodeFilePaths'
import { packFolderRelativePath } from '../lib/packIdentity'
import { listManagedPackFiles, type ManagedPackFilesystemEntry } from '../lib/writeToFilesystem'
import { syncNodeFromPythonSource, type PythonSourceSyncIssue } from '../lib/pythonSourceSync'
import { COMFY_EDITOR_THEME, COMFY_EDITOR_THEME_NAME } from '../lib/editorTheme'
import {
  requirementPackageKey,
  suggestPythonRequirementsFromCode,
  type DependencySuggestion,
} from '../lib/dependencySuggestions'

const projectStore = useProjectStore()
const uiStore = useUiStore()

const wordWrap = ref(true)
const minimapEnabled = ref(false)
const focusMode = ref(false)
const monacoTheme = COMFY_EDITOR_THEME_NAME
const monacoRef = shallowRef<typeof Monaco | null>(null)
const monacoThemeDefined = ref(false)
const completionDisposable = shallowRef<Monaco.IDisposable | null>(null)
const fileEditorRef = shallowRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
const activeFilePath = ref('')
const importSuggestions = ref<DependencySuggestion[]>([])
const scanRan = ref(false)
const creatingFile = ref(false)
const newFilePath = ref('')
const newFileError = ref('')
const creatingDirectory = ref(false)
const newDirectoryPath = ref('')
const newDirectoryError = ref('')
const collapsedDirectories = ref(new Set<string>())
const filesystemEntries = ref<ManagedPackFilesystemEntry[]>([])
const filesystemSyncKey = ref('')
const filesystemRefreshTick = ref(0)

const baseEditorOptions = computed(() => ({
  minimap: { enabled: minimapEnabled.value },
  fontSize: 13,
  lineNumbers: 'on' as const,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 4,
  insertSpaces: true,
  renderLineHighlight: 'all' as const,
  smoothScrolling: true,
  cursorSmoothCaretAnimation: 'on' as const,
  fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontLigatures: true,
  padding: { top: 10, bottom: 10 },
  wordWrap: wordWrap.value ? 'on' as const : 'off' as const,
  tabCompletion: 'on' as const,
  quickSuggestions: { other: true, comments: false, strings: true },
  suggestOnTriggerCharacters: true,
  acceptSuggestionOnEnter: 'on' as const,
}))

const readonlyFileEditorOptions = computed(() => ({
  ...baseEditorOptions.value,
  readOnly: true,
  domReadOnly: true,
  cursorStyle: 'line-thin' as const,
  links: false,
  quickSuggestions: false,
  suggestOnTriggerCharacters: false,
}))

const editableFileEditorOptions = computed(() => ({
  ...baseEditorOptions.value,
  readOnly: false,
}))

const selectedNode = computed(() => {
  if (!uiStore.selectedNodeId) return null
  return projectStore.project.nodes.find(n => n.id === uiStore.selectedNodeId) ?? null
})

const hasActiveProject = computed(() => Boolean(projectStore.activeProjectId))
const packFiles = computed(() =>
  hasActiveProject.value
    ? buildPackCodeFiles(projectStore.project, selectedNode.value?.id ?? null, filesystemEntries.value)
    : [],
)
const fileTreeEntries = computed(() =>
  hasActiveProject.value
    ? buildPackCodeFileTree(packFiles.value, projectStore.project.customDirectories ?? [], filesystemEntries.value)
    : [],
)
const visibleFileTreeEntries = computed(() =>
  fileTreeEntries.value.filter(entry => {
    const parts = entry.relativePath.split('/')
    for (let index = 1; index < parts.length; index += 1) {
      if (collapsedDirectories.value.has(parts.slice(0, index).join('/'))) return false
    }
    return true
  }),
)

const activeFile = computed<PackCodeFile | null>(() => {
  if (packFiles.value.length === 0) return null
  return packFiles.value.find(file => file.path === activeFilePath.value) ?? packFiles.value[0]
})

const activePythonNode = computed(() => {
  if (activeFile.value?.kind !== 'node-python') return null
  const nodeId = activeFile.value?.nodeId
  if (!nodeId) return null
  return projectStore.project.nodes.find(node => node.id === nodeId) ?? null
})

type EditorIssue = LintIssue | PythonSourceSyncIssue

const activeLintIssues = computed<LintIssue[]>(() => {
  if (activeFile.value?.language !== 'python') return []
  return lintPython(activeFile.value.text)
})
const activeSyncIssues = computed<PythonSourceSyncIssue[]>(() => {
  const node = activePythonNode.value
  if (!node || activeFile.value?.kind !== 'node-python') return []
  return syncNodeFromPythonSource(activeFile.value.text, node, () => '__preview_id__').issues
})
const activeIssues = computed<EditorIssue[]>(() => [...activeLintIssues.value, ...activeSyncIssues.value])
const activeIssueCount = computed(() => activeIssues.value.length)
const currentRequirementKeys = computed(() =>
  new Set((projectStore.project.pythonRequirements ?? []).map(requirementPackageKey).filter(Boolean)),
)
const visibleImportSuggestions = computed(() =>
  importSuggestions.value.filter(suggestion => !currentRequirementKeys.value.has(requirementPackageKey(suggestion.requirement))),
)
const activeFileLegendText = computed(() => {
  switch (activeFile.value?.kind) {
    case 'node-python':
      return 'full node Python source'
    case 'requirements':
      return 'manual requirements override + import scan'
    case 'install':
      return 'custom install script'
    case 'custom-ui':
      return 'custom ComfyUI frontend renderer'
    case 'custom-file':
      return 'shared project file'
    case 'generated':
      return 'generated pack file'
    case 'filesystem':
      return 'deployed filesystem file'
    default:
      return ''
  }
})
const activeFileIsEditable = computed(() =>
  activeFile.value?.kind === 'node-python' ||
  activeFile.value?.kind === 'requirements' ||
  activeFile.value?.kind === 'install' ||
  activeFile.value?.kind === 'custom-ui' ||
  activeFile.value?.kind === 'custom-file',
)

async function copyActiveFile() {
  if (!activeFile.value) return
  try {
    await navigator.clipboard.writeText(activeFile.value.text)
  } catch {}
}

function selectFile(path: string) {
  activeFilePath.value = path
  const file = packFiles.value.find(candidate => candidate.path === path)
  if (file?.nodeId) uiStore.selectNode(file.nodeId)
  nextTick(scheduleAllEditorLayouts)
}

function onFileEditorMount(editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) {
  fileEditorRef.value = editor
  monacoRef.value = monaco
  defineMonacoTheme(monaco)
  registerCompletionProvider(monaco)
  updateMarkers()
  requestAnimationFrame(() => editor.layout())
}

function updateActiveFile(value: string | undefined) {
  if (value === undefined || !activeFile.value) return
  switch (activeFile.value.kind) {
    case 'node-python':
      updateNodePythonSource(value)
      break
    case 'requirements':
      updateRequirements(value)
      break
    case 'install':
      updateInstallScript(value)
      break
    case 'custom-ui':
      updateCustomUiRenderer(value)
      break
    case 'custom-file':
      updateCustomFile(value)
      break
    case 'filesystem':
      break
  }
}

function updateNodePythonSource(value: string) {
  const node = activePythonNode.value
  if (!node) return
  const sync = syncNodeFromPythonSource(value, node, nanoid)
  projectStore.updateNode(node.id, sync.patch)
}

function updateCustomFile(value: string) {
  const file = activeFile.value
  if (!file || file.kind !== 'custom-file') return
  projectStore.updateProject({
    customFiles: (projectStore.project.customFiles ?? []).map(customFile => {
      const relativePath = normalizeCustomNodeFilePath(customFile.relativePath)
      return relativePath === file.relativePath
        ? { ...customFile, relativePath: file.relativePath, content: value }
        : customFile
    }),
  })
}

function defaultCustomFileContent(relativePath: string): string {
  const projectName = projectStore.project.name || 'this ComfyUI pack'
  if (relativePath.endsWith('.py')) return `# Shared helper module for ${projectName}.\n\n`
  if (relativePath.endsWith('.js')) return `// Shared helper script for ${projectName}.\n\n`
  if (relativePath.endsWith('.json')) return '{}\n'
  return ''
}

function startCreatingFile() {
  creatingDirectory.value = false
  creatingFile.value = true
  newFilePath.value = 'helpers.py'
  newFileError.value = ''
}

function cancelCreatingFile() {
  creatingFile.value = false
  newFileError.value = ''
}

function createCustomFile() {
  const relativePath = normalizeCustomNodeFilePath(newFilePath.value)
  if (!relativePath) {
    newFileError.value = 'Use a relative file path without empty or parent folders.'
    return
  }
  if (isReservedProjectFilePath(relativePath, projectStore.project.nodes.map(node => node.name))) {
    newFileError.value = 'That path is managed by the builder and cannot be replaced.'
    return
  }
  if (packFiles.value.some(file => file.relativePath === relativePath)) {
    newFileError.value = 'A file with that path already exists for this project.'
    return
  }
  expandDirectoryAncestors(relativePath)
  projectStore.updateProject({
    customFiles: [
      ...(projectStore.project.customFiles ?? []),
      {
        id: nanoid(),
        relativePath,
        content: defaultCustomFileContent(relativePath),
      },
    ],
  })
  creatingFile.value = false
  newFileError.value = ''
  nextTick(() => {
    const created = packFiles.value.find(file => file.relativePath === relativePath)
    if (created) activeFilePath.value = created.path
  })
}

function startCreatingDirectory() {
  creatingFile.value = false
  creatingDirectory.value = true
  newDirectoryPath.value = 'assets'
  newDirectoryError.value = ''
}

function cancelCreatingDirectory() {
  creatingDirectory.value = false
  newDirectoryError.value = ''
}

function createCustomDirectory() {
  const relativePath = normalizeCustomNodeDirectoryPath(newDirectoryPath.value)
  if (!relativePath) {
    newDirectoryError.value = 'Use a relative directory path without empty or parent folders.'
    return
  }
  if (packFiles.value.some(file => file.relativePath === relativePath)) {
    newDirectoryError.value = 'A file already uses that path.'
    return
  }
  if (fileTreeEntries.value.some(entry => entry.kind === 'directory' && entry.relativePath === relativePath)) {
    newDirectoryError.value = 'That directory already exists.'
    return
  }
  projectStore.updateProject({
    customDirectories: [
      ...(projectStore.project.customDirectories ?? []),
      {
        id: nanoid(),
        relativePath,
      },
    ],
  })
  expandDirectoryAncestors(relativePath)
  creatingDirectory.value = false
  newDirectoryError.value = ''
}

function deleteCustomFile(file: PackCodeFile) {
  if (!file.deletable || file.kind !== 'custom-file') return
  projectStore.updateProject({
    customFiles: (projectStore.project.customFiles ?? []).filter(customFile => normalizeCustomNodeFilePath(customFile.relativePath) !== file.relativePath),
  })
  nextTick(() => {
    const nextFile = packFiles.value.find(candidate => candidate.kind === 'node-python') ?? packFiles.value[0]
    activeFilePath.value = nextFile?.path ?? ''
  })
}

function deleteDirectory(relativePath: string) {
  const directory = fileTreeEntries.value.find(entry => entry.relativePath === relativePath)
  if (!directory || directory.kind !== 'directory' || !directory.deletable) return

  const prefix = `${relativePath}/`
  projectStore.updateProject({
    customFiles: (projectStore.project.customFiles ?? []).filter(customFile => {
      const normalized = normalizeCustomNodeFilePath(customFile.relativePath)
      return normalized !== relativePath && !normalized?.startsWith(prefix)
    }),
    customDirectories: (projectStore.project.customDirectories ?? []).filter(customDirectory => {
      const normalized = normalizeCustomNodeDirectoryPath(customDirectory.relativePath)
      return normalized !== relativePath && !normalized?.startsWith(prefix)
    }),
  })
  collapsedDirectories.value = new Set([...collapsedDirectories.value].filter(path => path !== relativePath && !path.startsWith(prefix)))
  nextTick(() => {
    const nextFile = packFiles.value.find(candidate => candidate.kind === 'node-python') ?? packFiles.value[0]
    activeFilePath.value = nextFile?.path ?? ''
  })
}

function isDirectoryCollapsed(relativePath: string) {
  return collapsedDirectories.value.has(relativePath)
}

function toggleDirectory(relativePath: string) {
  const next = new Set(collapsedDirectories.value)
  if (next.has(relativePath)) next.delete(relativePath)
  else next.add(relativePath)
  collapsedDirectories.value = next
}

function expandDirectoryAncestors(relativePath: string) {
  const parts = relativePath.split('/')
  if (parts.length <= 1) return
  const next = new Set(collapsedDirectories.value)
  for (let index = 1; index < parts.length; index += 1) {
    next.delete(parts.slice(0, index).join('/'))
  }
  collapsedDirectories.value = next
}

function parseRequirementLines(s: string): string[] {
  return s.split(/\r?\n/).map(t => t.trim()).filter(Boolean)
}

function updateRequirements(value: string | undefined) {
  if (value === undefined) return
  projectStore.updateProject({ pythonRequirements: parseRequirementLines(value) })
}

function updateInstallScript(value: string | undefined) {
  if (value === undefined) return
  projectStore.updateProject({
    pythonInstallScript: value.trim() ? value.trimEnd() : '',
  })
}

function updateCustomUiRenderer(value: string | undefined) {
  const nodeId = activeFile.value?.nodeId ?? selectedNode.value?.id
  const node = nodeId ? projectStore.project.nodes.find(candidate => candidate.id === nodeId) : null
  if (!node || value === undefined) return
  projectStore.updateNode(node.id, {
    customUiRendererCode: value.trim() ? value.trimEnd() : '',
  })
}

function refreshImportSuggestions(markRan = false) {
  if (projectStore.project.nodes.length === 0) {
    importSuggestions.value = []
    scanRan.value = false
    return
  }
  const source = projectStore.project.nodes.map(node => node.pythonSource ?? `${node.moduleCode ?? ''}\n${node.code ?? ''}`).join('\n')
  importSuggestions.value = suggestPythonRequirementsFromCode(
    source,
    '',
    projectStore.project.pythonRequirements ?? [],
  )
  if (markRan) scanRan.value = true
}

function addRequirement(requirement: string) {
  const current = [...(projectStore.project.pythonRequirements ?? [])]
  const keys = new Set(current.map(requirementPackageKey).filter(Boolean))
  if (!keys.has(requirementPackageKey(requirement))) {
    current.push(requirement)
    projectStore.updateProject({ pythonRequirements: current })
  }
  scanRan.value = true
}

function addAllSuggestions() {
  for (const suggestion of [...visibleImportSuggestions.value]) {
    addRequirement(suggestion.requirement)
  }
}

watch(activeIssues, () => {
  updateMarkers()
}, { deep: true })

watch(() => selectedNode.value?.id ?? '', (nodeId) => {
  if (!nodeId) return
  const file = packFiles.value.find(candidate => candidate.kind === 'node-python' && candidate.nodeId === nodeId)
  if (file) activeFilePath.value = file.path
}, { immediate: true })

watch(() => [
  projectStore.activeProjectId,
  projectStore.project.comfyuiInstallPath,
  projectStore.project.packFolderName,
  filesystemRefreshTick.value,
] as const, async ([activeProjectId, installPath, packFolderName]) => {
  if (!activeProjectId || !installPath || !packFolderName) {
    filesystemEntries.value = []
    filesystemSyncKey.value = ''
    return
  }
  const syncKey = `${activeProjectId}:${installPath}:${packFolderName}`
  filesystemSyncKey.value = syncKey
  try {
    const result = await listManagedPackFiles(installPath, packFolderName)
    if (filesystemSyncKey.value === syncKey) filesystemEntries.value = result.entries
  } catch {
    if (filesystemSyncKey.value === syncKey) filesystemEntries.value = []
  }
}, { immediate: true })

watch(() => [
  selectedNode.value?.id ?? '',
  projectStore.project.nodes.map(node => `${node.id}:${node.moduleCode ?? ''}:${node.code ?? ''}:${node.pythonSource ?? ''}`).join('\n---node---\n'),
  (projectStore.project.pythonRequirements ?? []).join('\n'),
], () => {
  scanRan.value = false
  refreshImportSuggestions(false)
}, { immediate: true })

watch(() => uiStore.selectedItem, (item) => {
  if (item?.kind !== 'uiOutput') return
  const node = selectedNode.value
  const output = (node?.uiOutputs ?? []).find(candidate => candidate.id === item.uiOutputId)
  if (output?.kind !== 'custom') return
  const customFile = packFiles.value.find(file => file.kind === 'custom-ui')
  if (customFile) activeFilePath.value = customFile.path
}, { deep: true })

watch(packFiles, (files) => {
  if (files.length === 0) {
    activeFilePath.value = ''
    return
  }
  if (files.some(file => file.path === activeFilePath.value)) return
  const selectedFile = selectedNode.value ? files.find(file => file.nodeId === selectedNode.value?.id) : null
  activeFilePath.value = selectedFile?.path ?? files[0].path
}, { immediate: true })

watch([wordWrap, minimapEnabled, focusMode, activeFile], () => {
  nextTick(scheduleAllEditorLayouts)
})

function refreshFilesystemTree() {
  filesystemRefreshTick.value += 1
}

onMounted(() => {
  window.addEventListener('comfy-builder-pack-files-changed', refreshFilesystemTree)
})

onBeforeUnmount(() => {
  completionDisposable.value?.dispose()
  window.removeEventListener('comfy-builder-pack-files-changed', refreshFilesystemTree)
})

function scheduleAllEditorLayouts() {
  const editor = fileEditorRef.value
  if (editor) requestAnimationFrame(() => editor.layout())
}

function updateMarkers() {
  const monaco = monacoRef.value
  const model = fileEditorRef.value?.getModel()
  if (!monaco) return
  if (model) monaco.editor.setModelMarkers(model, 'comfyui-builder-python-lint', markersForIssues(activeIssues.value, monaco))
}

function defineMonacoTheme(monaco: typeof Monaco) {
  if (!monacoThemeDefined.value) {
    monaco.editor.defineTheme(monacoTheme, COMFY_EDITOR_THEME)
    monacoThemeDefined.value = true
  }
  monaco.editor.setTheme(monacoTheme)
}

function markersForIssues(
  issues: EditorIssue[],
  monaco: typeof Monaco,
): Monaco.editor.IMarkerData[] {
  return issues.map(issue => ({
    severity: issue.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
    message: issue.message,
    startLineNumber: issue.line,
    startColumn: issue.startCol,
    endLineNumber: issue.line,
    endColumn: issue.endCol,
  }))
}

function registerCompletionProvider(monaco: typeof Monaco) {
  completionDisposable.value?.dispose()
  completionDisposable.value = monaco.languages.registerCompletionItemProvider('python', {
    triggerCharacters: ['.', '/', '"', "'", '_'],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position)
      const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
      const node = activePythonNode.value ?? selectedNode.value
      if (!node) return { suggestions: [] }

      const inputSuggestions = node.inputs.map(input => ({
        label: input.name,
        kind: monaco.languages.CompletionItemKind.Variable,
        insertText: input.name,
        detail: `${input.type} input`,
        range,
      }))
      const variableSuggestions = extractPythonVariableNames(node.code, node.inputs.map(input => input.name)).map(variable => ({
        label: variable,
        kind: monaco.languages.CompletionItemKind.Variable,
        insertText: variable,
        detail: 'Python variable from execute body',
        range,
      }))
      const outputSuggestions = node.outputs.map(output => ({
        label: output.name,
        kind: monaco.languages.CompletionItemKind.Property,
        insertText: output.expression || output.name,
        detail: `${output.type} output return expression`,
        range,
      }))
      const uiSuggestions = (node.uiOutputs ?? []).map(output => ({
        label: `ui.${output.key} source`,
        kind: monaco.languages.CompletionItemKind.Variable,
        insertText: output.expression || output.key,
        detail: `${output.kind} Return UI source expression`,
        range,
      }))
      const pathSuggestions = pathCompletionItems(monaco, range)
      return { suggestions: [...inputSuggestions, ...variableSuggestions, ...outputSuggestions, ...uiSuggestions, ...pathSuggestions] }
    },
  })
}

function pathCompletionItems(monaco: typeof Monaco, range: Monaco.IRange): Monaco.languages.CompletionItem[] {
  const installPath = projectStore.project.comfyuiInstallPath || '/home/user/ComfyUI'
  const packPath = `custom_nodes/ComfyUINodeBuilder/${packFolderRelativePath(projectStore.project.packFolderName || projectStore.project.name)}`
  const paths = [
    installPath,
    `${installPath.replace(/\/+$/, '')}/${packPath}`,
    `${installPath.replace(/\/+$/, '')}/models`,
    `${installPath.replace(/\/+$/, '')}/input`,
    `${installPath.replace(/\/+$/, '')}/output`,
    packPath,
    'models/checkpoints',
    'models/loras',
    'models/vae',
  ]
  return paths.map(path => ({
    label: path,
    kind: monaco.languages.CompletionItemKind.Folder,
    insertText: path,
    detail: 'ComfyUI path',
    range,
  }))
}
</script>

<style scoped>
.code-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg);
  overflow: hidden;
}
.code-panel-focus {
  position: fixed;
  inset: 12px;
  z-index: 3000;
  border: 1px solid var(--border-strong);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-lg);
}
.no-node {
  padding: 32px 16px;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  font-style: italic;
}
.code-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 10px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.035), transparent),
    var(--panel);
  border-bottom: 1px solid var(--border-subtle);
  box-shadow: var(--inner-highlight);
  flex-shrink: 0;
}
.code-workspace {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(164px, 220px) minmax(0, 1fr);
  background: var(--bg);
}
.file-explorer {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-subtle);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.026), transparent 120px),
    var(--bg);
}
.file-explorer-head {
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 8px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-dim);
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}
.tool-btn-compact {
  padding: 4px 6px;
  font-size: 11px;
}
.file-create-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.new-file-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-grid);
}
.new-file-input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--field);
  color: var(--text);
  outline: none;
  padding: 6px 7px;
  font: 11.5px var(--font-mono);
}
.new-file-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.new-file-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.new-file-error {
  color: var(--danger);
  font-size: 11px;
  line-height: 1.35;
}
.file-list {
  min-height: 0;
  overflow: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.file-row {
  min-width: 0;
  min-height: 30px;
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
  padding: 0 6px;
  text-align: left;
  font: 11.5px var(--font-mono);
}
.file-row:hover {
  color: var(--text);
  background: var(--hover);
}
.file-row.active {
  color: var(--text);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.035), transparent),
    var(--raised);
  border-color: var(--border-strong);
}
.file-row-error.active {
  border-color: rgba(255, 118, 118, 0.62);
  box-shadow: 0 0 0 1px rgba(255, 118, 118, 0.18) inset;
}
.file-row-node .file-kind-dot {
  background: var(--accent);
}
.file-row-custom .file-kind-dot {
  background: #8dd8a4;
}
.file-tree-directory {
  min-width: 0;
  min-height: 25px;
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-muted);
  font: 11px var(--font-mono);
  font-weight: 720;
  cursor: pointer;
  border-radius: var(--r-sm);
  padding-right: 5px;
}
.file-tree-directory:hover {
  color: var(--text);
  background: var(--hover);
}
.file-dir-chevron {
  width: 7px;
  height: 7px;
  border-right: 1px solid currentColor;
  border-bottom: 1px solid currentColor;
  transform: rotate(45deg) translateY(-1px);
  opacity: 0.78;
  flex: 0 0 auto;
}
.file-dir-chevron.collapsed {
  transform: rotate(-45deg) translateY(1px);
}
.file-protect-chip {
  margin-left: auto;
  height: 16px;
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(231, 184, 91, 0.32);
  border-radius: 999px;
  padding: 0 5px;
  color: #ffe8bd;
  background: var(--generated-soft);
  font: 9px var(--font-sans);
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.file-delete {
  width: 19px;
  height: 19px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  border: 0;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font: 700 13px Arial, sans-serif;
}
.file-delete:hover {
  color: #ff9b9b;
  background: rgba(255, 118, 118, 0.12);
}
.code-title-error {
  color: #ffb4b4;
}
.file-kind-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.75);
  flex: 0 0 auto;
}
.file-tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
.code-title-wrap {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.code-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  font: 12px/1.35 var(--font-mono);
  font-weight: 650;
}
.code-legend {
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 7px;
  color: var(--text-muted);
  font-size: 10px;
}
.legend-chip,
.block-badge {
  height: 16px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0 6px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.legend-editable {
  color: #d8ecff;
  background: var(--accent-soft);
  border: 1px solid rgba(104, 167, 255, 0.32);
}
.legend-generated {
  color: #ffe8bd;
  background: var(--generated-soft);
  border: 1px solid rgba(231, 184, 91, 0.32);
}
.editor-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.lint-badge {
  min-width: 17px;
  height: 17px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  margin-left: 6px;
  border-radius: 999px;
  background: var(--warning);
  color: #1b1306;
  font: 10px var(--font-sans);
  font-weight: 800;
}
.tool-btn {
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-dim);
  border-radius: var(--r-sm);
  cursor: pointer;
  font-size: 12px;
  font-weight: 720;
  white-space: nowrap;
  padding: 5px 8px;
}
.tool-btn:hover {
  color: var(--text);
  background: var(--hover);
}
.tool-btn.active {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: rgba(104, 167, 255, 0.28);
}
.icon-tool-btn {
  width: 30px;
  height: 28px;
  justify-content: center;
  padding: 0;
}
.icon-tool-btn svg {
  width: 15px;
  height: 15px;
  stroke: currentColor;
  stroke-width: 1.75;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.code-block-flow {
  display: none;
}
.file-viewer {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px;
  background:
    linear-gradient(90deg, rgba(104, 167, 255, 0.035), transparent 34px),
    var(--bg);
}
.sync-error-panel {
  flex: 0 0 auto;
  margin-bottom: 8px;
  border: 1px solid rgba(255, 118, 118, 0.38);
  border-radius: 8px;
  background: rgba(255, 118, 118, 0.075);
  color: #ffd1d1;
  overflow: hidden;
}
.sync-error-title {
  padding: 7px 10px;
  border-bottom: 1px solid rgba(255, 118, 118, 0.18);
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}
.sync-error-item {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 8px;
  padding: 6px 10px;
  font-size: 11px;
}
.sync-error-item span {
  color: #ff9f9f;
  font-family: var(--font-mono);
}
.sync-error-item strong {
  min-width: 0;
  color: #ffe3e3;
  font-weight: 650;
}
.file-viewer-header {
  min-height: 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  color: var(--text);
  font: 11px var(--font-mono);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.035), transparent),
    var(--panel-2);
  border: 1px solid var(--border-subtle);
  border-bottom: 0;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
}
.file-viewer-header-error {
  border-color: rgba(255, 118, 118, 0.36);
}
.dependency-file-header {
  min-height: 40px;
}
.dependency-file-actions {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.editable-badge {
  color: #d8ecff;
  background: var(--accent-soft);
  border: 1px solid rgba(104, 167, 255, 0.28);
}
.dependency-suggestion-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 10px;
  border-right: 1px solid var(--border-subtle);
  border-left: 1px solid var(--border-subtle);
  border-bottom: 1px solid var(--border-subtle);
  background: var(--panel);
}
.dependency-suggestion-label,
.dependency-empty {
  color: var(--text-muted);
  font-size: 9.5px;
  font-weight: 850;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.suggestion-chip {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--raised);
  color: var(--text);
  cursor: pointer;
  font: 11px var(--font-mono);
  padding: 4px 7px;
}
.suggestion-chip:hover {
  color: var(--accent);
  border-color: rgba(104, 167, 255, 0.38);
  background: var(--accent-soft);
}
.suggestion-chip.add-all {
  font-family: var(--font-sans);
  font-weight: 780;
}
.dependency-empty {
  text-transform: none;
  letter-spacing: 0;
  font-weight: 650;
}
.full-file-editor-wrap {
  flex: 1 1 auto;
  min-height: 0;
  border: 1px solid var(--border-subtle);
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
  overflow: hidden;
  background: var(--field);
}
.full-file-editor-wrap :deep(> div),
.full-file-editor-wrap :deep(.monaco-editor),
.full-file-editor-wrap :deep(.monaco-editor .overflow-guard) {
  width: 100% !important;
  height: 100% !important;
}
@media (max-width: 760px) {
  .code-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
  .editor-actions {
    width: 100%;
    overflow-x: auto;
  }
  .file-viewer {
    padding: 8px;
  }
}
</style>
