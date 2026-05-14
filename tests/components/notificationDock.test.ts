import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, beforeEach } from 'vitest'
import AppNotificationDock from '../../src/components/AppNotificationDock.vue'
import AppStatusBar from '../../src/components/AppStatusBar.vue'
import AppToolbar from '../../src/components/AppToolbar.vue'
import { useUiStore } from '../../src/stores/ui'

describe('notification dock', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows notifications as an icon button in the top toolbar', async () => {
    const uiStore = useUiStore()
    uiStore.addDiagnostic('warning', 'Managed pack not found', 'No builder.project.json found', false)
    const wrapper = mount(AppToolbar, {
      props: {
        exportDisabled: false,
        deployInProgress: false,
      },
    })

    expect(wrapper.text()).not.toContain('Diagnostics')
    expect(wrapper.find('[aria-label="Notifications"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Notifications"] svg').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Notifications"]').text()).not.toContain('Notifications')
    expect(wrapper.find('[aria-label="Settings"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('1')

    await wrapper.find('[aria-label="Notifications"]').trigger('click')

    expect(wrapper.text()).toContain('Managed pack not found')
    expect(wrapper.text()).toContain('No builder.project.json found')
  })

  it('keeps settings in the bottom status bar without notifications', async () => {
    const uiStore = useUiStore()
    uiStore.addDiagnostic('warning', 'Managed pack not found', 'No builder.project.json found', false)

    const wrapper = mount(AppStatusBar, {
      props: {
        statusText: 'Ready',
      },
    })

    expect(wrapper.find('.status-bar').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Settings"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Notifications"]').exists()).toBe(false)
  })

  it('keeps the notification controls embedded instead of fixed as a floating dock', () => {
    const wrapper = mount(AppNotificationDock)

    expect(wrapper.find('.notification-status-actions').exists()).toBe(true)
    expect(wrapper.find('.notification-dock').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Notifications"] svg').exists()).toBe(true)
  })
})
