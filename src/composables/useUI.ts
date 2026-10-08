import { ref } from 'vue'

// Shared UI visibility state (dialogs, panels). Module-level singleton so any
// component can open/close dialogs without prop-drilling.
const settingsOpen = ref(false)
const recoveryOpen = ref(false)
const commandPaletteOpen = ref(false)
const sidebarVisible = ref(true)
const outlineVisible = ref(true)
const rightPanelVisible = ref(true)

export function useUI() {
  return {
    settingsOpen,
    recoveryOpen,
    commandPaletteOpen,
    sidebarVisible,
    outlineVisible,
    rightPanelVisible,
    openSettings: () => (settingsOpen.value = true),
    closeSettings: () => (settingsOpen.value = false),
    openRecovery: () => (recoveryOpen.value = true),
    closeRecovery: () => (recoveryOpen.value = false),
    openCommandPalette: () => (commandPaletteOpen.value = true),
    closeCommandPalette: () => (commandPaletteOpen.value = false),
    toggleSidebar: () => (sidebarVisible.value = !sidebarVisible.value),
    toggleOutline: () => (outlineVisible.value = !outlineVisible.value),
    toggleRightPanel: () => (rightPanelVisible.value = !rightPanelVisible.value),
  }
}
