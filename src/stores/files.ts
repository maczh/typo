import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FileItem, RecentItem } from '@/types'
import { useTauri } from '@/composables/useTauri'
import { dirname } from '@/utils/file'

/**
 * Files store — directory tree, recent files and the current working directory.
 * Open/new operations load the document into the editor store (lazy import to
 * avoid a circular dependency with stores/editor.ts).
 */
export const useFilesStore = defineStore('files', () => {
  const tree = ref<FileItem[]>([])
  const recent = ref<RecentItem[]>([])
  const currentDir = ref<string>('')

  async function openFile(path: string): Promise<void> {
    const tauri = useTauri()
    const result = await tauri.openFile(path)
    try {
      await tauri.addRecent(path)
    } catch {
      /* non-fatal */
    }
    const { useEditorStore } = await import('./editor')
    const editor = useEditorStore()
    editor.loadFromText(result.content, result.path, result.name)
    currentDir.value = dirname(path)
    await loadRecent()
  }

  async function newFile(): Promise<void> {
    const { useEditorStore } = await import('./editor')
    useEditorStore().loadFromText('', null, 'untitled.md')
  }

  async function refreshTree(dir: string): Promise<void> {
    const tauri = useTauri()
    currentDir.value = dir
    try {
      tree.value = await tauri.listDir(dir)
    } catch {
      tree.value = []
    }
  }

  async function loadRecent(): Promise<void> {
    const tauri = useTauri()
    try {
      recent.value = await tauri.listRecent()
    } catch {
      recent.value = []
    }
  }

  async function addRecent(path: string): Promise<void> {
    const tauri = useTauri()
    try {
      await tauri.addRecent(path)
    } catch {
      /* non-fatal */
    }
    await loadRecent()
  }

  async function clearRecent(path = ''): Promise<void> {
    const tauri = useTauri()
    try {
      await tauri.clearRecent(path)
    } catch {
      /* non-fatal */
    }
    await loadRecent()
  }

  return {
    tree,
    recent,
    currentDir,
    openFile,
    newFile,
    refreshTree,
    loadRecent,
    addRecent,
    clearRecent,
  }
})
