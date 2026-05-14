<template>
  <div class="notification-status-actions">
    <div v-if="notificationsOpen" class="notification-popover">
      <div class="notification-head">
        <span>Notifications</span>
        <button v-if="uiStore.diagnostics.length" @click="uiStore.clearDiagnostics()">Clear</button>
      </div>
      <div v-if="uiStore.diagnostics.length === 0" class="notification-empty">
        No notifications.
      </div>
      <div
        v-for="item in uiStore.diagnostics"
        :key="item.id"
        class="notification-item"
        :class="`notification-${item.level}`"
      >
        <div class="notification-title">
          <span>{{ item.level }}</span>
          <strong>{{ item.title }}</strong>
          <time>{{ formatTime(item.timestamp) }}</time>
        </div>
        <pre v-if="item.detail" class="notification-detail">{{ item.detail }}</pre>
      </div>
    </div>

    <div class="notification-actions">
      <button
        class="notification-btn"
        :class="{ active: notificationsOpen }"
        aria-label="Notifications"
        title="Notifications"
        @click="notificationsOpen = !notificationsOpen"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M5 6.35a3 3 0 0 1 6 0v2.4l1.15 1.75h-8.3L5 8.75v-2.4Z" />
          <path d="M6.75 12.15a1.45 1.45 0 0 0 2.5 0" />
          <path d="M8 2.4v.9" />
        </svg>
        <span v-if="uiStore.diagnostics.length" class="count-badge">{{ uiStore.diagnostics.length }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useUiStore } from '../stores/ui'

const uiStore = useUiStore()
const notificationsOpen = ref(false)

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
</script>

<style scoped>
.notification-status-actions {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 0 0 auto;
}
.notification-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.notification-btn {
  position: relative;
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.04), transparent),
    var(--raised);
  color: var(--text);
  cursor: pointer;
  line-height: 1;
  box-shadow: var(--inner-highlight);
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease, transform 80ms ease;
}
.notification-btn:hover {
  background: var(--hover);
  border-color: var(--border-strong);
}
.notification-btn:active {
  transform: translateY(1px);
}
.notification-btn.active {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: rgba(106, 166, 255, 0.3);
}
.notification-btn svg {
  width: 14px;
  height: 14px;
  stroke: currentColor;
  stroke-width: 1.6;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.count-badge {
  position: absolute;
  right: -5px;
  top: -5px;
  min-width: 15px;
  height: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--warning);
  color: #1b1306;
  font-size: 9px;
  font-weight: 850;
}
.notification-popover {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  z-index: 4200;
  width: min(520px, calc(100vw - 24px));
  max-height: min(540px, calc(100vh - 72px));
  overflow: auto;
  padding: 10px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.04), transparent),
    var(--panel);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-lg);
}
.notification-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 4px 8px;
  color: var(--text-dim);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.notification-head button {
  height: 22px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--raised);
  color: var(--text);
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
}
.notification-empty {
  padding: 24px 8px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}
.notification-item {
  border: 1px solid var(--border-subtle);
  border-left-width: 3px;
  border-radius: var(--r-sm);
  padding: 10px;
  margin-bottom: 8px;
  background: var(--field);
}
.notification-success { border-left-color: var(--success); }
.notification-error { border-left-color: var(--danger); }
.notification-warning { border-left-color: var(--warning); }
.notification-info { border-left-color: var(--accent); }
.notification-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  font-size: 12px;
}
.notification-title span {
  color: var(--text-muted);
  text-transform: uppercase;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.notification-title strong {
  min-width: 0;
  overflow-wrap: anywhere;
}
.notification-title time {
  margin-left: auto;
  flex: 0 0 auto;
  color: var(--text-muted);
  font-size: 11px;
}
.notification-detail {
  margin-top: 8px;
  white-space: pre-wrap;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
  line-height: 1.5;
  overflow-wrap: anywhere;
}
@media (max-width: 760px) {
  .notification-popover {
    right: -4px;
    width: calc(100vw - 20px);
    max-height: min(520px, calc(100vh - 72px));
  }
  .notification-actions {
    max-width: calc(100vw - 20px);
  }
}
</style>
