<template>
  <div class="palette">
    <div class="palette-label">Palette</div>
    <div class="palette-items">
      <div
        v-for="item in paletteItems"
        :key="item.name"
        class="palette-item"
        draggable="true"
        @dragstart="onDragStart($event, item)"
      >
        <span
          class="palette-dot"
          :style="{ background: portColor(item.type) }"
        ></span>
        <span class="palette-item-label">{{ item.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PaletteItem } from '../types/index'

const paletteItems: PaletteItem[] = [
  { label: 'IMAGE', name: 'image', type: 'IMAGE', isWidget: false, widgetType: null },
  { label: 'LATENT', name: 'latent', type: 'LATENT', isWidget: false, widgetType: null },
  { label: 'FLOAT', name: 'float', type: 'FLOAT', isWidget: false, widgetType: null },
  { label: 'INT', name: 'int', type: 'INT', isWidget: false, widgetType: null },
  { label: 'STRING', name: 'string', type: 'STRING', isWidget: false, widgetType: null },
  { label: 'MASK', name: 'mask', type: 'MASK', isWidget: false, widgetType: null },
  { label: 'CONDITIONING', name: 'conditioning', type: 'CONDITIONING', isWidget: false, widgetType: null },
  { label: 'MODEL', name: 'model', type: 'MODEL', isWidget: false, widgetType: null },
  { label: 'VAE', name: 'vae', type: 'VAE', isWidget: false, widgetType: null },
  { label: 'CLIP', name: 'clip', type: 'CLIP', isWidget: false, widgetType: null },
  { label: 'Slider (FLOAT)', name: 'slider_float', type: 'FLOAT', isWidget: true, widgetType: 'slider' },
  { label: 'Slider (INT)', name: 'slider_int', type: 'INT', isWidget: true, widgetType: 'int' },
  { label: 'Dropdown', name: 'dropdown', type: 'STRING', isWidget: true, widgetType: 'dropdown' },
  { label: 'Text Input', name: 'text', type: 'STRING', isWidget: true, widgetType: 'text' },
  { label: 'Toggle (bool)', name: 'bool', type: 'BOOLEAN', isWidget: true, widgetType: 'bool' },
]

const PORT_COLORS: Record<string, string> = {
  IMAGE: '#9370ff', LATENT: '#ff70a0', FLOAT: '#cc88ff',
  INT: '#5599ff', STRING: '#ccaa44', MASK: '#79a9a0',
  CONDITIONING: '#fca33f', MODEL: '#6eb5b5', VAE: '#b56eb5', CLIP: '#b5b56e',
}
function portColor(type: string): string {
  return PORT_COLORS[type] ?? '#888'
}

function onDragStart(event: DragEvent, item: PaletteItem) {
  event.dataTransfer!.setData('palette', JSON.stringify(item))
  event.dataTransfer!.effectAllowed = 'copy'
}
</script>

<style scoped>
.palette {
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  padding: 8px;
}
.palette-label {
  font-size: 11px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}
.palette-items {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.palette-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: var(--node-body);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: grab;
  font-size: 12px;
  color: var(--text);
  user-select: none;
}
.palette-item:hover { border-color: var(--accent); }
.palette-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.palette-item-label { white-space: nowrap; }
</style>
