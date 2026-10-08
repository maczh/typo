import { ref, computed } from 'vue'
import type { FileItem } from '@/types'
import { useFilesStore } from '@/stores/files'
import { useUI } from '@/composables/useUI'

interface Entry {
  path: string
  name: string
}

// Module-level singleton shared with the global hotkey layer.
const query = ref('')
const selected = ref(0)

/**
 * "Open Quickly" (Ctrl+P) — searches recent files and the directory tree for
 * Markdown documents and opens the chosen one.
 */
export function useQuickOpen() {
  const files = useFilesStore()
  const ui = useUI()

  const entries = computed<Entry[]>(() => {
    const map = new Map<string, Entry>()
    for (const r of files.recent) map.set(r.path, { path: r.path, name: r.name })
    const walk = (items: FileItem[]): void => {
      for (const it of items) {
        if (it.isDir) {
          if (it.children?.length) walk(it.children)
        } else if (/\.md$/i.test(it.name)) {
          map.set(it.path, { path: it.path, name: it.name })
        }
      }
    }
    walk(files.tree)
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  })

  const filtered = computed<Entry[]>(() => {
    const q = query.value.trim().toLowerCase()
    if (!q) return entries.value
    return entries.value.filter(
      (e) => e.name.toLowerCase().includes(q) || e.path.toLowerCase().includes(q),
    )
  })

  function open(entry: Entry): void {
    void files.openFile(entry.path)
    ui.quickOpenOpen.value = false
    query.value = ''
    selected.value = 0
  }

  function openSelected(): void {
    const e = filtered.value[selected.value]
    if (e) open(e)
  }

  function close(): void {
    ui.quickOpenOpen.value = false
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      selected.value = Math.min(selected.value + 1, filtered.value.length - 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      selected.value = Math.max(selected.value - 1, 0)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      openSelected()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  return { query, selected, filtered, open, openSelected, close, onKey }
}
