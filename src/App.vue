<template>
  <SettingsModal
    v-model="showSettings"
    @load-managed-pack="onLoadManagedPack"
    @import-managed-pack="onImportManagedPack"
  />
  <AppLayout
    :status-text="statusText"
    :export-disabled="hasValidationErrors"
    :export-disabled-reason="validationDisabledReason"
    :deploy-in-progress="deployInProgress"
    @export-zip="onExportZip"
    @deploy="onDeploy"
    @settings="showSettings = true"
  >
    <template #library>
      <LeftSidebar />
    </template>
    <template #definition>
      <NodeDefinitionPanel />
    </template>
    <template #code>
      <CodePanel />
    </template>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import AppLayout from './components/AppLayout.vue'
import SettingsModal from './components/SettingsModal.vue'
import LeftSidebar from './components/LeftSidebar.vue'
import NodeDefinitionPanel from './components/NodeDefinitionPanel.vue'
import CodePanel from './components/CodePanel.vue'
import { useProjectStore } from './stores/project'
import { useUiStore } from './stores/ui'
import { exportZip, downloadBlob } from './lib/exportZip'
import { deployManagedPack, installManagedDependencies, readManagedProject } from './lib/writeToFilesystem'
import { validateProject } from './lib/validate'
import { MANAGED_PACK_NAME } from './lib/managedPack'
import { checkConnection, restartComfyUI } from './lib/comfyuiApi'
import { runDeployPipeline } from './lib/deployPipeline'
import type { Project } from './types/index'

const projectStore = useProjectStore()
const uiStore = useUiStore()
const showSettings = ref(false)
const statusText = ref('Ready')
const deployInProgress = ref(false)
const restartInProgress = ref(false)
const dependencyInstallInProgress = ref(false)

const projectErrors = computed(() => validateProject(projectStore.project))
const hasValidationErrors = computed(() => projectErrors.value.length > 0)
const validationDisabledReason = computed(() => {
  if (!hasValidationErrors.value) return ''
  return projectErrors.value.slice(0, 3).map(e => e.message).join('; ')
})

onMounted(() => {
  if (!uiStore.selectedNodeId && projectStore.project.nodes.length > 0) {
    uiStore.selectNode(projectStore.project.nodes[0].id)
  }
})

watch(() => projectStore.project.id, () => {
  uiStore.selectNode(projectStore.project.nodes[0]?.id ?? null)
})

async function onExportZip() {
  try {
    const blob = await exportZip(projectStore.project)
    const name = projectStore.project.name.replace(/\s+/g, '_') || 'node_pack'
    downloadBlob(blob, `${name}.zip`)
    uiStore.showToast('ZIP exported!', 'success')
  } catch (err) {
    uiStore.showToast('Export failed. Check console for details.', 'error')
    console.error('Export error:', err)
  }
}

async function onLoadManagedPack() {
  const { comfyuiInstallPath, comfyuiUrl } = projectStore.project
  if (!comfyuiInstallPath) {
    uiStore.addDiagnostic('error', 'Cannot load managed pack', 'Set the ComfyUI install path in Settings first.')
    return
  }

  try {
    statusText.value = 'Loading managed pack...'
    const packName = projectStore.project.packFolderName || MANAGED_PACK_NAME
    const result = await readManagedProject(comfyuiInstallPath, packName)
    if (!result.exists || !result.project) {
      statusText.value = 'Ready'
      uiStore.addDiagnostic('warning', 'Managed pack not found', `No builder.project.json found at ${result.path}`)
      return
    }
    projectStore.importProject({
      ...result.project,
      packFolderName: packName,
      comfyuiInstallPath,
      comfyuiUrl: comfyuiUrl || result.project.comfyuiUrl,
    })
    uiStore.selectNode(projectStore.project.nodes[0]?.id ?? null)
    statusText.value = 'Loaded managed pack'
    uiStore.addDiagnostic('success', `Loaded ${packName}`, `${projectStore.project.nodes.length} nodes loaded from ${result.path}`)
  } catch (err) {
    statusText.value = 'Error'
    uiStore.addDiagnostic('error', 'Load failed', String(err))
  } finally {
    setTimeout(() => { statusText.value = 'Ready' }, 5000)
  }
}

function onImportManagedPack(importedProject: Project, packName: string, metadataPath: string) {
  const { comfyuiInstallPath, comfyuiUrl } = projectStore.project
  projectStore.importProject({
    ...importedProject,
    packFolderName: packName,
    comfyuiInstallPath: importedProject.comfyuiInstallPath || comfyuiInstallPath,
    comfyuiUrl: importedProject.comfyuiUrl || comfyuiUrl,
  })
  uiStore.selectNode(projectStore.project.nodes[0]?.id ?? null)
  statusText.value = 'Loaded managed pack'
  uiStore.addDiagnostic('success', `Loaded ${packName}`, `${projectStore.project.nodes.length} nodes loaded from ${metadataPath}`)
  setTimeout(() => { statusText.value = 'Ready' }, 5000)
}

async function onDeploy() {
  const deployProject = snapshotProject(projectStore.project)
  const { comfyuiInstallPath, comfyuiUrl } = deployProject
  if (!comfyuiInstallPath) {
    uiStore.addDiagnostic('error', 'Cannot deploy', 'Set the ComfyUI install path in Settings first.')
    return
  }
  if (!comfyuiUrl) {
    uiStore.addDiagnostic('error', 'Cannot deploy and restart', 'Set the ComfyUI URL in Settings first.')
    return
  }

  const errors = validateProject(deployProject)
  if (errors.length > 0) {
    uiStore.addDiagnostic('error', 'Deploy blocked by validation', errors.map(e => e.message).join('\n'))
    return
  }

  uiStore.clearDiagnostics()
  deployInProgress.value = true
  dependencyInstallInProgress.value = false
  restartInProgress.value = false
  try {
    const pipeline = await runDeployPipeline({
      deploy: async () => {
        statusText.value = 'Deploying managed pack...'
        return deployManagedPack(comfyuiInstallPath, deployProject)
      },
      installDependencies: async () => {
        dependencyInstallInProgress.value = true
        statusText.value = 'Installing dependencies...'
        try {
          return await installManagedDependencies(comfyuiInstallPath, deployProject.packFolderName || MANAGED_PACK_NAME)
        } finally {
          dependencyInstallInProgress.value = false
        }
      },
      restart: async () => {
        restartInProgress.value = true
        statusText.value = 'Requesting ComfyUI restart...'
        await restartComfyUI(comfyuiUrl)
      },
      waitForRestart: async () => {
        statusText.value = 'Waiting for ComfyUI restart...'
        const backOnline = await waitForComfyUIBackOnline(comfyuiUrl)
        restartInProgress.value = false
        return backOnline
      },
    })

    statusText.value = pipeline.backOnline ? 'Deployed and ComfyUI restarted' : 'Deploy complete; restart status unknown'
    const dependencyResult = pipeline.dependencyResult
    const stdout = dependencyResult ? compactLog(dependencyResult.stdout) : ''
    const stderr = dependencyResult ? compactLog(dependencyResult.stderr) : ''
    uiStore.addDiagnostic(
      pipeline.backOnline ? 'success' : 'warning',
      pipeline.backOnline
        ? `Deployed ${deployProject.packFolderName || MANAGED_PACK_NAME}`
        : `Deployed ${deployProject.packFolderName || MANAGED_PACK_NAME}; restart status unknown`,
      [
        `Path: ${pipeline.deployResult.path}`,
        `Files: ${pipeline.deployResult.filesWritten.join(', ')}`,
        `${deployProject.nodes.length} nodes generated.`,
        pipeline.installedDependencies && dependencyResult ? `Python: ${dependencyResult.python}` : 'No dependency install was needed.',
        pipeline.installedDependencies && dependencyResult ? `Install script: ${dependencyResult.installScriptPath}` : null,
        pipeline.installedDependencies && dependencyResult ? `Requirements: ${dependencyResult.requirementsPath}` : null,
        stdout ? `stdout:\n${stdout}` : null,
        stderr ? `stderr:\n${stderr}` : null,
        pipeline.backOnline
          ? 'ComfyUI responded after restart.'
          : 'Restart was requested, but ComfyUI did not respond before the timeout. Refresh ComfyUI or check its terminal.',
      ].filter(Boolean).join('\n\n'),
    )
  } catch (err) {
    statusText.value = 'Deploy pipeline failed'
    uiStore.addDiagnostic(
      'error',
      'Deploy pipeline failed',
      `${String(err)}\n\nDeploy now runs Deploy -> Install Dependencies when needed -> Restart ComfyUI. This requires ComfyUI Extension Manager for the restart step.`,
    )
  } finally {
    deployInProgress.value = false
    dependencyInstallInProgress.value = false
    restartInProgress.value = false
    setTimeout(() => { statusText.value = 'Ready' }, 5000)
  }
}

function snapshotProject(project: Project): Project {
  return JSON.parse(JSON.stringify(project)) as Project
}

function compactLog(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.length > 5000 ? `${trimmed.slice(-5000)}\n[log truncated]` : trimmed
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForComfyUIBackOnline(url: string): Promise<boolean> {
  let sawOffline = false
  for (let attempt = 0; attempt < 24; attempt++) {
    await wait(2500)
    const connected = await checkConnection(url)
    if (!connected) {
      sawOffline = true
      statusText.value = 'ComfyUI restarting...'
      continue
    }
    if (sawOffline || attempt >= 2) return true
    statusText.value = 'Restart requested...'
  }
  return false
}

</script>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
#app { height: 100%; }

:root {
  /* surfaces */
  --bg: #0b0f16;
  --bg-grid: #101722;
  --panel: #111823;
  --panel-2: #151e2b;
  --panel-3: #1a2433;
  --node-body: #252934;
  --header: #1a2331;
  --raised: #1b2534;
  --hover: #223047;
  --field: #0d131d;

  /* borders */
  --border: #223046;
  --border-strong: #34435b;
  --border-subtle: rgba(148, 163, 184, 0.12);

  /* text */
  --text: #edf2fa;
  --text-dim: #a7b0c2;
  --text-muted: #687386;

  /* accent + status */
  --accent: #68a7ff;
  --accent-strong: #4d91f7;
  --accent-soft: rgba(104, 167, 255, 0.14);
  --accent-faint: rgba(104, 167, 255, 0.08);
  --generated: #e7b85b;
  --generated-soft: rgba(231, 184, 91, 0.13);
  --success: #60c88f;
  --success-soft: rgba(96, 200, 143, 0.13);
  --warning: #eab85f;
  --danger: #f07878;
  --danger-soft: rgba(240, 120, 120, 0.12);

  /* port colors (slightly desaturated for dark-on-dark legibility) */
  --type-image: #a692ff;
  --type-latent: #ff8eba;
  --type-float: #d6a3ff;
  --type-int: #6cabff;
  --type-string: #d8b75e;
  --type-mask: #8fc1b8;
  --type-conditioning: #ffba6e;
  --type-model: #84c7c7;
  --type-vae: #c785c7;
  --type-clip: #c7c785;
  --type-boolean: #94d6a4;
  --type-audio: #6ed0d6;
  --type-video: #f08bd2;
  --type-mesh: #cba46f;
  --type-color: #f1c65f;
  --type-combo: #7fb4ff;

  /* radius + shadow */
  --r-xs: 3px;
  --r-sm: 5px;
  --r-md: 7px;
  --r-lg: 10px;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.28);
  --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.34);
  --shadow-lg: 0 18px 54px rgba(0, 0, 0, 0.52);
  --inner-highlight: 0 1px 0 rgba(255, 255, 255, 0.045) inset;

  /* fonts */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

body {
  color-scheme: dark;
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background:
    radial-gradient(circle at top left, rgba(104, 167, 255, 0.08), transparent 32rem),
    var(--bg);
  color: var(--text);
}

button,
input,
textarea,
select {
  font: inherit;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-dim);
  font-size: 13px;
}

/* Default focus ring for any focusable input */
input:focus-visible,
textarea:focus-visible,
button:focus-visible,
select:focus-visible {
  outline: 2px solid rgba(104, 167, 255, 0.9);
  outline-offset: 1px;
}

/* Tiny scrollbar that matches the dark theme */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: #2a374c;
  border-radius: 8px;
  border: 2px solid var(--bg);
}
::-webkit-scrollbar-thumb:hover { background: #3c4d67; }
</style>
