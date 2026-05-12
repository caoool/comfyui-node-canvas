<template>
  <div class="comfy-stage">
    <div class="comfy-node" :style="{ '--node-accent': nodeAccent }">
      <div class="node-titlebar">
        <span class="node-grip"></span>
        <span class="node-identity">
          <input
            class="node-title-input"
            data-testid="node-preview-display"
            :value="node.displayName"
            aria-label="Display name"
            @change="updateMeta('displayName', $event)"
          />
          <input
            class="node-id-input"
            data-testid="node-preview-class"
            :value="node.name"
            aria-label="Class name"
            spellcheck="false"
            @change="updateMeta('name', $event)"
          />
        </span>
        <label class="node-output-toggle" :class="{ active: node.isOutputNode }">
          <input
            data-testid="node-preview-output-toggle"
            type="checkbox"
            :checked="node.isOutputNode"
            aria-label="Output node"
            @change="toggleOutputNode"
          />
          <span>output</span>
        </label>
      </div>

      <div class="node-content">
        <div class="socket-grid">
          <div class="socket-column">
            <div class="section-label">Inputs</div>
            <div v-if="node.inputs.length === 0" class="empty-contract">No inputs</div>
            <button
              v-for="port in node.inputs"
              :key="port.id"
              class="socket-row socket-row-input"
              :class="{ active: isSelected(port.id, 'inputs') }"
              @click="selectPort(port.id, 'inputs')"
            >
              <span class="socket" :style="{ background: portColor(port.type) }"></span>
              <span class="socket-label">{{ port.name }}</span>
              <span class="socket-type">{{ port.type }}</span>
              <span class="row-spacer"></span>
              <span class="remove-inline" title="Remove input" @click.stop="removePort(port.id)">×</span>
            </button>
          </div>

          <div class="socket-column socket-column-output">
            <div class="section-label section-label-output">Outputs</div>
            <div v-if="node.outputs.length === 0" class="empty-contract empty-contract-output">No outputs</div>
            <button
              v-for="port in node.outputs"
              :key="port.id"
              class="socket-row socket-row-output"
              :class="{ active: isSelected(port.id, 'outputs') }"
              @click="selectPort(port.id, 'outputs')"
            >
              <span class="remove-inline" title="Remove output" @click.stop="removePort(port.id)">×</span>
              <span class="row-spacer"></span>
              <span class="socket-type">{{ port.type }}</span>
              <span class="socket-label">{{ port.name }}</span>
              <span class="socket" :style="{ background: portColor(port.type) }"></span>
            </button>
          </div>
        </div>

        <div v-if="widgetRows.length" class="widget-stack">
          <div class="section-label">Widgets</div>
          <button
            v-for="{ port, widget } in widgetRows"
            :key="widget.id"
            class="widget-row"
            :class="[`widget-${widget.widgetType}`, { active: isWidgetSelected(widget.id) }]"
            @click="uiStore.selectWidget(widget.id)"
          >
            <span class="widget-label">{{ port.name }}</span>
            <span class="widget-control">
              <template v-if="['slider', 'number', 'int', 'seed'].includes(widget.widgetType)">
                <span class="slider-track"><span class="slider-fill" :style="{ width: sliderFill(widget) }"></span></span>
                <span class="widget-value">{{ widget.default }}</span>
              </template>
              <template v-else-if="['dropdown', 'dynamic_combo'].includes(widget.widgetType)">
                <span class="select-value">{{ widget.default || 'select' }}</span>
                <span class="chevron">⌄</span>
              </template>
              <template v-else-if="widget.widgetType === 'bool'">
                <span class="toggle" :class="{ on: widget.default === true }"></span>
              </template>
              <template v-else-if="widget.widgetType === 'color'">
                <span class="color-chip" :style="{ background: String(widget.default || '#ffffff') }"></span>
                <span class="widget-value">{{ widget.default }}</span>
              </template>
              <template v-else-if="['image_upload', 'video_upload', 'audio_upload', 'file'].includes(widget.widgetType)">
                <span class="upload-control">{{ uploadLabel(widget.widgetType) }}</span>
              </template>
              <template v-else>
                <span class="text-control">{{ previewText(widget.default) }}</span>
              </template>
              <span class="remove-inline remove-inline-widget" title="Remove widget" @click.stop="removePort(port.id)">×</span>
            </span>
          </button>
        </div>

        <div v-if="previewCards.length" class="preview-stack">
          <div class="preview-title">Return UI</div>
          <button
            v-for="preview in previewCards"
            :key="preview.id"
            class="preview-card"
            :class="[`preview-${preview.kind}`, { active: isUiOutputSelected(preview.id) }]"
            @click="uiStore.selectUiOutput(preview.id)"
          >
            <div class="preview-visual">
              <div v-if="preview.kind === 'image'" class="image-grid"></div>
              <div v-else-if="preview.kind === 'video'" class="video-frame"><span></span></div>
              <div v-else-if="preview.kind === 'audio'" class="waveform"><i v-for="n in 18" :key="n"></i></div>
              <div v-else-if="preview.kind === 'text' || preview.kind === 'markdown' || preview.kind === 'json'" class="text-preview multiline">
                <template v-if="preview.sample !== undefined && preview.sample !== null && preview.sample !== ''">
                  {{ previewTextBlock(preview.sample) }}
                </template>
                <template v-else>
                  <i></i><i></i><i></i>
                </template>
              </div>
              <div v-else-if="preview.kind === 'list' || preview.kind === 'table'" class="list-preview">
                <template v-if="preview.sample !== undefined && preview.sample !== null && preview.sample !== ''">
                  {{ previewTextBlock(preview.sample) }}
                </template>
                <template v-else>
                  <i></i><i></i><i></i>
                </template>
              </div>
              <div v-else-if="preview.kind === 'chart'" class="chart-bars"><i></i><i></i><i></i><i></i></div>
              <div v-else-if="preview.kind === 'color'" class="color-preview" :style="{ background: String(preview.sample || '') }"></div>
              <div v-else-if="preview.kind === 'mesh'" class="mesh-preview"></div>
              <div v-else class="generic-preview">{{ preview.kind }}</div>
            </div>
            <div class="preview-meta">
              <span>{{ preview.label }}</span>
              <strong>ui.{{ preview.key }}</strong>
              <span class="remove-inline remove-inline-preview" title="Remove Return UI" @click.stop="removeUiOutput(preview.id)">×</span>
            </div>
          </button>
        </div>
      </div>

      <div class="node-footer">
        <label class="node-category-field">
          <span>Category</span>
          <input
            data-testid="node-preview-category"
            :value="node.category"
            list="node-preview-category-options"
            aria-label="Category"
            spellcheck="false"
            @change="updateMeta('category', $event)"
          />
          <datalist id="node-preview-category-options">
            <option v-for="category in categoryOptions" :key="category" :value="category" />
          </datalist>
        </label>
        <span>{{ node.inputs.length }} in · {{ node.outputs.length }} out</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '../stores/ui'
import { useProjectStore } from '../stores/project'
import { COMFY_CATEGORIES, portColor } from '../lib/comfyCatalog'
import { removePortFromNode, removeUiOutputFromNode } from '../lib/nodeContract'
import type { NodeSpec, UiOutputKind, UiOutputSpec, WidgetKind, WidgetSpec } from '../types/index'

const props = defineProps<{ node: NodeSpec }>()
const uiStore = useUiStore()
const projectStore = useProjectStore()
const categoryOptions = COMFY_CATEGORIES

const nodeAccent = computed(() => portColor(props.node.outputs[0]?.type || props.node.inputs[0]?.type || 'IMAGE'))
const widgetByPortId = computed(() => new Map(props.node.widgets.map(widget => [widget.portId, widget])))
const widgetRows = computed(() => props.node.inputs
  .map(port => ({ port, widget: widgetByPortId.value.get(port.id) }))
  .filter((item): item is { port: NodeSpec['inputs'][number]; widget: WidgetSpec } => Boolean(item.widget)))
interface PreviewCard {
  id: string
  key: string
  label: string
  kind: UiOutputKind
  sample?: unknown
}

const previewCards = computed<PreviewCard[]>(() => {
  return (props.node.uiOutputs ?? []).map(toPreviewCard)
})

function toPreviewCard(output: UiOutputSpec): PreviewCard {
  return {
    id: output.id,
    key: output.key,
    label: output.label,
    kind: output.kind,
    sample: output.sample,
  }
}

function selectPort(portId: string, zone: 'inputs' | 'outputs') {
  uiStore.selectPort(portId, zone)
}

function isSelected(portId: string, zone: 'inputs' | 'outputs'): boolean {
  const selected = uiStore.selectedItem
  return selected?.kind === 'port' && selected.portId === portId && selected.zone === zone
}

function isWidgetSelected(id: string): boolean {
  const selected = uiStore.selectedItem
  return selected?.kind === 'widget' && selected.widgetId === id
}

function isUiOutputSelected(id: string): boolean {
  const selected = uiStore.selectedItem
  return selected?.kind === 'uiOutput' && selected.uiOutputId === id
}

function removePort(portId: string) {
  projectStore.updateNode(props.node.id, removePortFromNode(props.node, portId))
  const selected = uiStore.selectedItem
  if (
    (selected?.kind === 'port' && selected.portId === portId) ||
    (selected?.kind === 'widget' && props.node.widgets.some(widget => widget.id === selected.widgetId && widget.portId === portId))
  ) {
    uiStore.selectNode(props.node.id)
  }
}

function removeUiOutput(id: string) {
  projectStore.updateNode(props.node.id, removeUiOutputFromNode(props.node, id))
  if (uiStore.selectedItem?.kind === 'uiOutput' && uiStore.selectedItem.uiOutputId === id) {
    uiStore.selectNode(props.node.id)
  }
}

function updateMeta(field: 'name' | 'displayName' | 'category', event: Event) {
  const target = event.target as HTMLInputElement
  projectStore.updateNode(props.node.id, { [field]: target.value.trim() } as Partial<NodeSpec>)
}

function toggleOutputNode(event: Event) {
  const target = event.target as HTMLInputElement
  projectStore.updateNode(props.node.id, { isOutputNode: target.checked })
}

function sliderFill(widget: WidgetSpec): string {
  const value = Number(widget.default ?? 0)
  const min = Number(widget.config.min ?? 0)
  const max = Number(widget.config.max ?? 1)
  if (!Number.isFinite(value) || max <= min) return '45%'
  return `${Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))}%`
}

function uploadLabel(widgetType: WidgetKind): string {
  if (widgetType === 'image_upload') return 'choose image'
  if (widgetType === 'video_upload') return 'choose video'
  if (widgetType === 'audio_upload') return 'choose audio'
  return 'choose file'
}

function previewText(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'empty'
  if (Array.isArray(value)) return `${value.length} items`
  return String(value).slice(0, 36)
}

function previewTextBlock(value: unknown): string {
  if (Array.isArray(value)) return value.map(item => String(item)).join('\n')
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}
</script>

<style scoped>
.comfy-stage {
  min-height: 100%;
  display: grid;
  place-items: start center;
  padding: 24px;
  background:
    radial-gradient(circle at 16px 16px, rgba(255,255,255,0.045) 1px, transparent 1px),
    linear-gradient(180deg, #20232d 0%, #151820 100%);
  background-size: 22px 22px, auto;
}
.comfy-node {
  --node-accent: var(--accent);
  width: min(100%, 560px);
  color: #dfe5ee;
  background: #252934;
  border: 1px solid #111722;
  border-radius: 8px;
  box-shadow:
    0 24px 54px rgba(0,0,0,0.48),
    0 0 0 1px rgba(255,255,255,0.045) inset;
  overflow: hidden;
  font-family: Arial, Helvetica, sans-serif;
}
.node-titlebar {
  min-height: 42px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 9px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--node-accent) 24%, #334155), #1d2430);
  border-bottom: 1px solid rgba(0,0,0,0.62);
  color: #f2f2f4;
}
.node-grip {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--node-accent);
  box-shadow: 0 0 0 2px rgba(0,0,0,0.42), 0 0 16px color-mix(in srgb, var(--node-accent) 45%, transparent);
}
.node-identity {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 1px;
}
.node-title-input,
.node-id-input,
.node-category-field input {
  min-width: 0;
  width: 100%;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  outline: none;
}
.node-title-input:hover,
.node-id-input:hover,
.node-category-field input:hover {
  background: rgba(255,255,255,0.06);
  border-color: rgba(255,255,255,0.08);
}
.node-title-input:focus,
.node-id-input:focus,
.node-category-field input:focus {
  background: rgba(0,0,0,0.2);
  border-color: rgba(255,255,255,0.24);
  box-shadow: 0 0 0 2px rgba(104,167,255,0.28);
}
.node-title-input {
  height: 18px;
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  padding: 0 4px;
}
.node-id-input {
  height: 15px;
  color: rgba(255,255,255,0.58);
  font: 10px var(--font-mono);
  padding: 0 4px;
}
.node-output-toggle {
  flex: 0 0 auto;
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid rgba(255,255,255,0.16);
  border-radius: 999px;
  padding: 3px 7px;
  color: rgba(255,255,255,0.55);
  background: rgba(255,255,255,0.045);
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  cursor: pointer;
  user-select: none;
}
.node-output-toggle.active {
  color: #fff2b8;
  background: rgba(255, 198, 86, 0.15);
  border-color: rgba(255, 213, 128, 0.24);
}
.node-output-toggle input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.node-content { padding: 10px 0 11px; }
.socket-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  padding: 0 7px;
}
.socket-column { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.section-label {
  color: #8d96a8;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 1px 3px 3px;
}
.section-label-output { text-align: right; }
.empty-contract {
  height: 22px;
  display: flex;
  align-items: center;
  color: #717c90;
  font-size: 10.5px;
  font-style: italic;
  padding: 0 3px;
}
.empty-contract-output {
  justify-content: flex-end;
}
.socket-row {
  height: 22px;
  display: flex;
  align-items: center;
  gap: 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #dde3ec;
  cursor: pointer;
  min-width: 0;
  padding: 0 3px;
  font-size: 12px;
}
.socket-row:hover,
.socket-row.active {
  background: rgba(255,255,255,0.075);
}
.socket-row.active {
  box-shadow: 0 0 0 1px rgba(104,167,255,0.24) inset;
}
.socket-row-output { justify-content: flex-end; text-align: right; }
.socket {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex: 0 0 auto;
  box-shadow: 0 0 0 2px rgba(0,0,0,0.52), 0 1px 0 rgba(255,255,255,0.25) inset;
}
.socket-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.socket-type {
  color: #8994a8;
  font-family: var(--font-mono);
  font-size: 9px;
  white-space: nowrap;
}
.row-spacer {
  flex: 1 1 auto;
  min-width: 0;
}
.remove-inline {
  width: 17px;
  height: 17px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 4px;
  color: #8d929f;
  opacity: 0;
  transition: opacity 100ms ease, color 100ms ease, background 100ms ease;
  font: 700 12px/1 Arial, Helvetica, sans-serif;
}
.socket-row:hover .remove-inline,
.widget-row:hover .remove-inline,
.preview-card:hover .remove-inline,
.socket-row.active .remove-inline,
.widget-row.active .remove-inline,
.preview-card.active .remove-inline {
  opacity: 1;
}
.remove-inline:hover {
  color: #ff8b8b;
  background: rgba(255, 120, 120, 0.13);
}
.widget-stack {
  margin: 9px 8px 0;
  padding-top: 8px;
  border-top: 1px solid rgba(0,0,0,0.42);
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.widget-row {
  min-height: 27px;
  display: grid;
  grid-template-columns: minmax(90px, 0.65fr) minmax(0, 1.35fr);
  align-items: center;
  gap: 8px;
  padding: 4px 7px;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 5px;
  background: #202733;
  color: #dadbe1;
  font-size: 11.5px;
  cursor: pointer;
}
.widget-row:hover {
  border-color: rgba(255,255,255,0.18);
  background: #263140;
}
.widget-row.active {
  border-color: rgba(104, 167, 255, 0.5);
  box-shadow: 0 0 0 1px rgba(104, 167, 255, 0.2);
}
.widget-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.widget-control {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  justify-content: flex-end;
}
.remove-inline-widget {
  margin-left: 1px;
}
.slider-track {
  height: 4px;
  flex: 1;
  min-width: 48px;
  border-radius: 999px;
  background: #121821;
  overflow: hidden;
  box-shadow: 0 1px 0 rgba(255,255,255,0.1);
}
.slider-fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--node-accent), color-mix(in srgb, var(--node-accent) 68%, white));
}
.widget-value,
.select-value,
.text-control,
.upload-control {
  min-width: 0;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #bfc2cd;
  font-family: var(--font-mono);
  font-size: 10.5px;
}
.upload-control {
  padding: 3px 7px;
  border-radius: 4px;
  background: #121821;
  color: #aeb9d6;
}
.chevron { color: #8b91a0; }
.toggle {
  width: 28px;
  height: 14px;
  border-radius: 999px;
  background: #121821;
  position: relative;
}
.toggle::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  top: 2px;
  left: 2px;
  border-radius: 50%;
  background: #777b88;
}
.toggle.on { background: color-mix(in srgb, var(--node-accent) 42%, #12141a); }
.toggle.on::after { left: 16px; background: #fff; }
.color-chip {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.22), 0 0 0 2px rgba(0,0,0,0.45);
}
.preview-stack {
  margin: 10px 8px 0;
  padding-top: 9px;
  border-top: 1px solid rgba(0,0,0,0.42);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(136px, 1fr));
  gap: 7px;
}
.preview-title {
  grid-column: 1 / -1;
  color: #8d96a8;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.preview-card {
  min-height: 92px;
  border: 1px solid rgba(255,255,255,0.075);
  border-radius: 5px;
  background: #202733;
  overflow: hidden;
  color: inherit;
  cursor: pointer;
  padding: 0;
  text-align: left;
}
.preview-card:hover,
.preview-card.active {
  border-color: rgba(104, 167, 255, 0.5);
  box-shadow: 0 0 0 1px rgba(104, 167, 255, 0.2);
}
.preview-visual {
  height: 64px;
  display: grid;
  place-items: center;
  background: #121821;
  position: relative;
}
.preview-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 7px;
  color: #c2c9d5;
  font-size: 10px;
}
.preview-meta span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preview-meta strong {
  color: #8c98ab;
  font-family: var(--font-mono);
  font-size: 9px;
}
.remove-inline-preview {
  margin-left: -3px;
}
.image-grid,
.mask-grid {
  width: 100%;
  height: 100%;
  background:
    linear-gradient(135deg, rgba(255,255,255,0.1), transparent 52%),
    linear-gradient(45deg, #344052 25%, transparent 25%, transparent 75%, #344052 75%),
    linear-gradient(45deg, #344052 25%, #242c3a 25%, #242c3a 75%, #344052 75%);
  background-position: 0 0, 0 0, 8px 8px;
  background-size: auto, 16px 16px, 16px 16px;
}
.mask-grid { filter: grayscale(1) contrast(1.2); }
.video-frame span {
  width: 0;
  height: 0;
  border-top: 10px solid transparent;
  border-bottom: 10px solid transparent;
  border-left: 16px solid #dbe4ff;
}
.waveform {
  width: 88%;
  height: 40px;
  display: flex;
  align-items: center;
  gap: 3px;
}
.waveform i {
  flex: 1;
  border-radius: 999px;
  background: #68a7ff;
  height: 24px;
}
.waveform i:nth-child(3n) { height: 30px; }
.waveform i:nth-child(4n) { height: 18px; }
.text-lines,
.list-lines,
.text-preview,
.list-preview {
  width: 82%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.text-lines i,
.list-lines i,
.text-preview i,
.list-preview i {
  height: 6px;
  border-radius: 999px;
  background: #828da0;
}
.text-lines i:nth-child(2) { width: 76%; }
.text-lines i:nth-child(3) { width: 48%; }
.text-preview,
.list-preview {
  width: calc(100% - 16px);
  max-height: 54px;
  display: block;
  overflow: hidden;
  color: #dfe5ee;
  font: 10px/1.35 var(--font-mono);
  white-space: pre-wrap;
  text-align: left;
}
.text-preview.multiline,
.list-preview {
  align-self: stretch;
  justify-self: stretch;
  margin: 7px 8px;
  padding: 6px 7px;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 4px;
  background: rgba(255,255,255,0.045);
}
.list-lines i::before,
.list-preview i::before {
  content: '';
  display: block;
  width: 6px;
  height: 6px;
  margin-left: -11px;
  border-radius: 50%;
  background: #828da0;
}
.chart-bars {
  width: 74%;
  height: 42px;
  display: flex;
  align-items: end;
  gap: 8px;
}
.chart-bars i {
  flex: 1;
  border-radius: 3px 3px 0 0;
  background: #68a7ff;
}
.chart-bars i:nth-child(1) { height: 34%; }
.chart-bars i:nth-child(2) { height: 72%; }
.chart-bars i:nth-child(3) { height: 48%; }
.chart-bars i:nth-child(4) { height: 90%; }
.color-preview {
  width: 64%;
  height: 34px;
  border-radius: 4px;
  background: linear-gradient(90deg, #f15a5a, #f1d85a, #4ec983, #5a9cf1, #b36ff1);
}
.mesh-preview {
  width: 54px;
  height: 54px;
  border: 1px solid #778092;
  transform: rotateX(58deg) rotateZ(45deg);
  background:
    linear-gradient(90deg, transparent 47%, #778092 47%, #778092 53%, transparent 53%),
    linear-gradient(0deg, transparent 47%, #778092 47%, #778092 53%, transparent 53%);
}
.generic-preview {
  color: #8f95a5;
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
}
.node-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 9px;
  color: #8a94a7;
  font-size: 10px;
  border-top: 1px solid rgba(0,0,0,0.42);
  background: rgba(0,0,0,0.08);
}
.node-category-field {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 6px;
}
.node-category-field span {
  flex: 0 0 auto;
  color: #677286;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.node-category-field input {
  height: 18px;
  color: #8a94a7;
  font: 10px var(--font-mono);
  padding: 0 4px;
}
@media (max-width: 720px) {
  .comfy-stage { padding: 16px; }
  .socket-grid { grid-template-columns: minmax(0, 1fr); }
  .socket-row-output { justify-content: flex-start; text-align: left; }
  .socket-row-output .socket { order: -1; }
  .node-titlebar {
    align-items: stretch;
  }
  .node-output-toggle {
    align-self: center;
  }
}
</style>
