import { invoke } from '@tauri-apps/api/core'
import type {
  FileResult,
  SaveResult,
  FileItem,
  RecentItem,
  Settings,
  RecoveryItem,
} from '@/types'
import { showToast } from '@/utils/toast'

type ToastFn = (msg: string, type?: 'error' | 'info') => void

let toastFn: ToastFn = (msg, type = 'error') => showToast(msg, type)

/** Register the global toast handler (called once from main.ts). */
export function registerToast(fn: ToastFn): void {
  toastFn = fn
}

/** True when running inside the Tauri webview (invoke is available). */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** Low-level invoke wrapper: forwards to Rust and surfaces errors as toasts. */
async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    const msg = `命令 "${cmd}" 需要 Tauri 运行时（请在桌面应用中使用）`
    toastFn(msg, 'error')
    throw new Error(msg)
  }
  try {
    return await invoke<T>(cmd, args)
  } catch (e) {
    const msg =
      typeof e === 'string' ? e : e instanceof Error ? e.message : String(e)
    toastFn(msg, 'error')
    throw e
  }
}

/**
 * Unified bridge to every Rust command. Parameters use snake_case to match the
 * Rust signatures; all errors are surfaced via the global toast and re-thrown
 * so callers can still `await`/`catch` when they need finer control.
 */
export function useTauri() {
  return {
    openFile: (path?: string | null) =>
      call<FileResult>('open_file', { path: path ?? null }),
    saveFile: (path: string, content: string) =>
      call<SaveResult>('save_file', { path, content }),
    saveFileAs: (path: string, content: string) =>
      call<FileResult>('save_file_as', { path, content }),
    listDir: (path: string) => call<FileItem[]>('list_dir', { path }),
    pickOpen: () => call<string | null>('pick_open'),
    pickSave: (defaultName: string) =>
      call<string | null>('pick_save', { defaultName }),
    pickDir: () => call<string | null>('pick_dir'),
    deleteFile: (path: string) => call<void>('delete_file', { path }),
    writeAsset: (docPath: string, filename: string, data: Uint8Array | number[]) =>
      call<string>('write_asset', { docPath, filename, data }),
    getAssetsDir: (docPath: string) =>
      call<string>('get_assets_dir', { docPath }),
    loadSettings: () => call<Settings>('load_settings'),
    saveSettings: (settings: Settings) => call<void>('save_settings', { settings }),
    listRecent: () => call<RecentItem[]>('list_recent'),
    addRecent: (path: string) => call<void>('add_recent', { path }),
    clearRecent: (path: string) => call<void>('clear_recent', { path }),
    autosave: (docPath: string, content: string) =>
      call<SaveResult>('autosave', { docPath, content }),
    checkRecovery: () => call<RecoveryItem[]>('check_recovery'),
    clearRecovery: (docPath: string) => call<void>('clear_recovery', { docPath }),
  }
}
