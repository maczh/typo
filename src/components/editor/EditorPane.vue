<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useMilkdown } from '@/composables/useMilkdown'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { buildOutlineFromMarkdown } from '@/utils/outline'
import ImageHandler from './ImageHandler.vue'
import TableToolbar from './TableToolbar.vue'

const container = ref<HTMLElement | null>(null)
const milkdown = useMilkdown()
const editorStore = useEditorStore()
const settingsStore = useSettingsStore()

async function handleChange(md: string): Promise<void> {
  editorStore.updateContent(md)
  editorStore.setOutline(buildOutlineFromMarkdown(md))
}

onMounted(async () => {
  if (!container.value) return
  await milkdown.mount(container.value, editorStore.doc.content, handleChange)
  editorStore.setOutline(buildOutlineFromMarkdown(editorStore.doc.content))
})

onBeforeUnmount(() => {
  milkdown.destroy()
})

// Reload the editor whenever a *new* document is loaded (loadSignal increments).
watch(
  () => editorStore.loadSignal,
  () => {
    milkdown.loadMarkdown(editorStore.doc.content)
    editorStore.setOutline(buildOutlineFromMarkdown(editorStore.doc.content))
  },
)
</script>

<template>
  <div class="editor-pane" :class="`mode-${settingsStore.settings.mode}`">
    <TableToolbar />
    <div ref="container" class="milkdown-root"></div>
    <ImageHandler />
  </div>
</template>

<style scoped>
.editor-pane {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg);
}
.milkdown-root {
  flex: 1 1 auto;
  overflow: auto;
  padding: 24px;
  display: flex;
  justify-content: center;
}
.milkdown-root :deep(.milkdown) {
  width: 100%;
  max-width: var(--content-max-width);
}
/* Focus / typewriter hide the chrome for distraction-free writing. */
.mode-focus .table-toolbar,
.mode-typewriter .table-toolbar {
  opacity: 0.25;
}
.mode-focus .table-toolbar:hover,
.mode-typewriter .table-toolbar:hover {
  opacity: 1;
}
</style>
