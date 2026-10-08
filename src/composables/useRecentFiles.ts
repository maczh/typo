import { ref } from 'vue'
import { useTauri } from './useTauri'
import type { RecentItem } from '@/types'

/**
 * Reactive wrapper around the recent-files commands. Used by the sidebar so the
 * "recent" list updates automatically after open / add / clear.
 */
export function useRecentFiles() {
  const recent = ref<RecentItem[]>([])
  const tauri = useTauri()

  async function load(): Promise<void> {
    try {
      recent.value = await tauri.listRecent()
    } catch {
      recent.value = []
    }
  }

  async function add(path: string): Promise<void> {
    try {
      await tauri.addRecent(path)
    } catch {
      /* ignore — non-fatal */
    }
    await load()
  }

  async function clear(path = ''): Promise<void> {
    try {
      await tauri.clearRecent(path)
    } catch {
      /* ignore */
    }
    await load()
  }

  return { recent, load, add, clear }
}
