import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FileItem, RecentItem } from '@/types'
import { useTauri } from '@/composables/useTauri'
import { dirname } from '@/utils/file'
import { importToMarkdown } from '@/utils/import'

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
    // HTML / DOCX arrive as raw markup / bytes and must be converted to Markdown
    // before they become the document's source of truth.
    const kind = result.kind ?? 'text'
    let content = result.content ?? ''
    if (kind === 'html' || kind === 'docx') {
      content = await importToMarkdown({
        path: result.path,
        name: result.name,
        kind,
        text: result.content ?? '',
        data: result.data,
      })
      // The on-disk file is still HTML/DOCX — saving Markdown back over it would
      // corrupt it. Open the converted result as a fresh, unsaved draft so the
      // first save prompts "Save As" with a `.md` name instead of overwriting.
      const mdName = result.name.replace(/\.(html?|docx)$/i, '.md')
      editor.loadFromText(content, null, mdName)
      currentDir.value = dirname(path)
      await loadRecent()
      return
    }
    editor.loadFromText(content, result.path, result.name)
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

  /** Pick a directory with a native dialog and load its tree into the sidebar. */
  async function openFolder(): Promise<void> {
    const tauri = useTauri()
    try {
      const dir = await tauri.pickDir()
      if (dir) await refreshTree(dir)
    } catch {
      /* non-fatal (e.g. browser preview) */
    }
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
    openFolder,
  }
})
