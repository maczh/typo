import { ref } from 'vue'

export type SidebarView = 'files' | 'outline' | 'articles'

// Shared UI visibility state (dialogs, panels). Module-level singleton so any
// component can open/close dialogs without prop-drilling.
const settingsOpen = ref(false)
const recoveryOpen = ref(false)
const commandPaletteOpen = ref(false)
const sidebarVisible = ref(true)
const outlineVisible = ref(true)

// New: source-mode (Ctrl+/), find/replace dialog, quick-open dialog, and the
// active sidebar tab (driven by View-menu / Typora hotkeys).
const sourceMode = ref(false)
const findOpen = ref(false)
const quickOpenOpen = ref(false)
const sidebarView = ref<SidebarView>('files')
const statusBarVisible = ref(true)

export function useUI() {
  return {
    settingsOpen,
    recoveryOpen,
    commandPaletteOpen,
    sidebarVisible,
    outlineVisible,
    sourceMode,
    findOpen,
    quickOpenOpen,
    sidebarView,
    statusBarVisible,

    openSettings: () => (settingsOpen.value = true),
    closeSettings: () => (settingsOpen.value = false),
    openRecovery: () => (recoveryOpen.value = true),
    closeRecovery: () => (recoveryOpen.value = false),
    openCommandPalette: () => (commandPaletteOpen.value = true),
    closeCommandPalette: () => (commandPaletteOpen.value = false),

    toggleSidebar: () => (sidebarVisible.value = !sidebarVisible.value),
    setSidebarView: (v: SidebarView) => {
      sidebarView.value = v
      sidebarVisible.value = true
    },
    showOutlinePanel: () => {
      sidebarView.value = 'outline'
      sidebarVisible.value = true
    },
    toggleOutline: () => {
      sidebarVisible.value = true
      sidebarView.value = 'outline'
    },

    toggleSourceMode: () => (sourceMode.value = !sourceMode.value),
    openSourceMode: () => (sourceMode.value = true),
    closeSourceMode: () => (sourceMode.value = false),

    openFind: () => (findOpen.value = true),
    closeFind: () => (findOpen.value = false),
    openQuickOpen: () => (quickOpenOpen.value = true),
    closeQuickOpen: () => (quickOpenOpen.value = false),

    toggleStatusBar: () => (statusBarVisible.value = !statusBarVisible.value),
  }
}
