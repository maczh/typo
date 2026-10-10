import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FileItem, RecentItem } from '@/types'
import { useTauri } from '@/composables/useTauri'
import { dirname } from '@/utils/file'
import { localizeMarkdown } from '@/utils/images'

/**
 * Files store — directory tree, recent files and the current working directory.
 * Open/new operations load the document into the editor store (lazy import to
 * avoid a circular dependency with stores/editor.ts).
 *
 * Only Markdown files are opened now (HTML / DOCX import was removed), so the
 * file content is always plain UTF-8 text and is loaded directly as the
 * document's Markdown source of truth.
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
    // Rewrite local image references to absolute `asset://` URLs so they render
    // in the webview; the on-disk file keeps portable relative paths.
    const content = localizeMarkdown(result.content ?? '', result.path)
    editor.loadFromText(content, result.path, result.name)
    // Populate / focus the sidebar directory tree on this file's folder.
    await refreshTree(dirname(path))
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

  /**
   * List the immediate children of a directory (without touching the root tree).
   * Used by the recursive sidebar tree to lazily expand folders.
   */
  async function fetchChildren(dir: string): Promise<FileItem[]> {
    const tauri = useTauri()
    try {
      return await tauri.listDir(dir)
    } catch {
      return []
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
    fetchChildren,
    loadRecent,
    addRecent,
    clearRecent,
    openFolder,
  }
})
