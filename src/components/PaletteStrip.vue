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
import { COMFY_DATA_TYPES, COMFY_WIDGET_PRESETS, portColor } from '../lib/comfyCatalog'

const paletteItems: PaletteItem[] = [...COMFY_DATA_TYPES, ...COMFY_WIDGET_PRESETS]

function onDragStart(event: DragEvent, item: PaletteItem) {
  event.dataTransfer!.setData('palette', JSON.stringify(item))
  event.dataTransfer!.effectAllowed = 'copy'
}
</script>

<style scoped>
.palette {
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  padding: 12px 14px;
}
.palette-label {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 600;
  margin-bottom: 8px;
}
.palette-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.palette-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: var(--raised);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  cursor: grab;
  font-size: 12px;
  color: var(--text);
  user-select: none;
  transition: background 100ms ease, border-color 100ms ease, transform 80ms ease;
}
.palette-item:hover {
  background: var(--hover);
  border-color: var(--border-strong);
}
.palette-item:active {
  cursor: grabbing;
  transform: scale(0.97);
}
.palette-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.3);
}
.palette-item-label { white-space: nowrap; font-weight: 500; letter-spacing: 0.01em; }
</style>
