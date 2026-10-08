<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import MenuBar from './MenuBar.vue'
import StatusBar from './StatusBar.vue'
import SideBar from '../sidebar/SideBar.vue'
import EditorPane from '../editor/EditorPane.vue'
import RightPanel from '../panels/RightPanel.vue'
import CommandPalette from '../command/CommandPalette.vue'
import RecoveryDialog from '../dialogs/RecoveryDialog.vue'
import SettingsDialog from '../dialogs/SettingsDialog.vue'
import { useSettingsStore } from '@/stores/settings'
import { useFilesStore } from '@/stores/files'
import { useUI } from '@/composables/useUI'
import { useAutosave } from '@/composables/useAutosave'
import { useTauri } from '@/composables/useTauri'

const settingsStore = useSettingsStore()
const filesStore = useFilesStore()
const ui = useUI()
const autosave = useAutosave()
const tauri = useTauri()

// Destructure so the refs auto-unwrap in the template.
const {
  sidebarVisible,
  rightPanelVisible,
  commandPaletteOpen,
  recoveryOpen,
  settingsOpen,
} = ui

function onKeydown(e: KeyboardEvent): void {
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
    e.preventDefault()
    ui.openCommandPalette()
  }
}

onMounted(async () => {
  await settingsStore.load()
  await filesStore.loadRecent()
  autosave.start()
  // Crash-recovery: open the dialog if a newer backup exists.
  try {
    const items = await tauri.checkRecovery()
    if (items.length > 0) ui.openRecovery()
  } catch {
    /* backend unavailable */
  }
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  autosave.stop()
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="app-layout">
    <MenuBar />
    <div class="app-body">
      <SideBar v-if="sidebarVisible" />
      <main class="editor-area">
        <EditorPane />
      </main>
      <RightPanel v-if="rightPanelVisible" />
    </div>
    <StatusBar />
    <CommandPalette v-if="commandPaletteOpen" />
    <RecoveryDialog v-if="recoveryOpen" />
    <SettingsDialog v-if="settingsOpen" />
  </div>
</template>
