<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { useMilkdown } from '@/composables/useMilkdown'
import { useEditorStore } from '@/stores/editor'
import { useTauri } from '@/composables/useTauri'
import { insertImage } from '@/milkdown/plugins/image'
import { dirname } from '@/utils/file'
import { showToast } from '@/utils/toast'

const milkdown = useMilkdown()
const editorStore = useEditorStore()
const tauri = useTauri()

function sanitize(name: string): string {
  return name.replace(/\s+/g, '-').replace(/[^\w.\-]/g, '')
}

function blobToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(file)
  })
}

async function handleImageFile(file: File): Promise<void> {
  const editor = milkdown.getEditor()
  if (!editor) return
  const filename = `${Date.now()}-${sanitize(file.name || 'image.png')}`
  const docPath = editorStore.doc.path

  try {
    if (docPath) {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      const relPath = await tauri.writeAsset(dirname(docPath), filename, bytes)
      insertImage(editor, `./${relPath}`, file.name)
    } else {
      // No saved document yet: fall back to an inline data URL.
      const dataUrl = await blobToDataUrl(file)
      insertImage(editor, dataUrl, file.name)
    }
  } catch (e) {
    showToast(`${(e as Error).message || 'image failed'}`, 'error')
  }
}

function onPaste(e: ClipboardEvent): void {
  const items = e.clipboardData?.items
  if (!items) return
  for (const it of Array.from(items)) {
    if (it.type.startsWith('image/')) {
      const f = it.getAsFile()
      if (f) {
        e.preventDefault()
        void handleImageFile(f)
        return
      }
    }
  }
}

function onDrop(e: DragEvent): void {
  const files = e.dataTransfer?.files
  if (!files) return
  for (const f of Array.from(files)) {
    if (f.type.startsWith('image/')) {
      e.preventDefault()
      void handleImageFile(f)
      return
    }
  }
}

function onDragOver(e: DragEvent): void {
  if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
}

onMounted(() => {
  document.addEventListener('paste', onPaste)
  document.addEventListener('drop', onDrop)
  document.addEventListener('dragover', onDragOver)
})

onBeforeUnmount(() => {
  document.removeEventListener('paste', onPaste)
  document.removeEventListener('drop', onDrop)
  document.removeEventListener('dragover', onDragOver)
})
</script>

<template>
  <!-- Invisible helper; it hooks document-level paste / drop to insert images. -->
  <div class="image-handler" aria-hidden="true"></div>
</template>

<style scoped>
.image-handler {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}
</style>
