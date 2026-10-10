<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import MenuBar from './MenuBar.vue'
import Toolbar from '../editor/Toolbar.vue'
import StatusBar from './StatusBar.vue'
import SideBar from '../sidebar/SideBar.vue'
import EditorPane from '../editor/EditorPane.vue'
import CommandPalette from '../command/CommandPalette.vue'
import FindDialog from '../dialogs/FindDialog.vue'
import QuickOpenDialog from '../dialogs/QuickOpenDialog.vue'
import RecoveryDialog from '../dialogs/RecoveryDialog.vue'
import SettingsDialog from '../dialogs/SettingsDialog.vue'
import { useSettingsStore } from '@/stores/settings'
import { useFilesStore } from '@/stores/files'
import { useUI } from '@/composables/useUI'
import { useAutosave } from '@/composables/useAutosave'
import { useTauri } from '@/composables/useTauri'
import { useHotkeys } from '@/composables/useHotkeys'
import { useWindowTitle } from '@/composables/useWindowTitle'

const settingsStore = useSettingsStore()
const filesStore = useFilesStore()
const ui = useUI()
const autosave = useAutosave()
const tauri = useTauri()
// Global Typora-style hotkeys (incl. Ctrl+/ source mode). Registered during
// setup so its onMounted/onBeforeUnmount hook the AppLayout lifecycle.
useHotkeys()
// Keep the window title ("Typo - <file>") in sync with the open document.
useWindowTitle()

// Destructure so the refs auto-unwrap in the template.
const { sidebarVisible, commandPaletteOpen, recoveryOpen, settingsOpen, sourceMode, findOpen, quickOpenOpen } = ui

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
})

onBeforeUnmount(() => {
  autosave.stop()
})
</script>

<template>
  <div class="app-layout">
    <MenuBar />
    <Toolbar v-if="!sourceMode" />
    <div class="app-body">
      <SideBar v-if="sidebarVisible" />
      <main class="editor-area">
        <EditorPane />
      </main>
    </div>
    <StatusBar />
    <FindDialog v-if="findOpen" />
    <QuickOpenDialog v-if="quickOpenOpen" />
    <CommandPalette v-if="commandPaletteOpen" />
    <RecoveryDialog v-if="recoveryOpen" />
    <SettingsDialog v-if="settingsOpen" />
  </div>
</template>
