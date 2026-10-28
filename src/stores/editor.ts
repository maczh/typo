import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { EditorDoc, EditorTab, OutlineNode } from '@/types'

/**
 * Editor store — owns the current document (Markdown source of truth), the live
 * outline, the cursor position and the word count.
 */
export const useEditorStore = defineStore('editor', () => {
  const initialDoc: EditorDoc = {
    id: 'untitled-1',
    path: null,
    name: 'untitled.md',
    content: '',
    dirty: false,
    savedAt: null,
  }
  const doc = ref<EditorDoc>(initialDoc)
  const tabs = ref<EditorTab[]>([{ id: initialDoc.id!, doc: initialDoc }])
  const activeTabId = ref(initialDoc.id!)

  let savedContent: string | null = ''
  const outline = ref<OutlineNode[]>([])
  const cursor = ref({ line: 1, col: 1 })
  const wordCount = ref(0)
  // Bumped whenever a *new* document is loaded (open/new) so the editor pane can
  // reload without reacting to ordinary saves.
  const loadSignal = ref(0)

  function updateWordCount(text: string): void {
    const trimmed = text.trim()
    wordCount.value = trimmed ? trimmed.split(/\s+/).length : 0
  }

  /** Replace the whole document (open / new). */
  function loadFromText(text: string, path: string | null = null, name = 'untitled.md', dirty = false): void {
    savedContent = dirty ? null : text
    doc.value = {
      path,
      name,
      content: text,
      dirty,
      savedAt: Date.now(),
    }
    updateWordCount(text)
    const tab = tabs.value.find((item) => item.id === activeTabId.value)
    if (tab) tab.doc = { ...doc.value }
    loadSignal.value++
  }

  /** Called by the editor on every content change. */
  function updateContent(md: string): void {
    doc.value.content = md
    doc.value.dirty = md !== savedContent
    updateWordCount(md)
    const tab = tabs.value.find((item) => item.id === activeTabId.value)
    if (tab) tab.doc = { ...doc.value }
  }

  function markSaved(content = doc.value.content): void {
    savedContent = content
    doc.value.dirty = doc.value.content !== savedContent
    doc.value.savedAt = Date.now()
    const tab = tabs.value.find((item) => item.id === activeTabId.value)
    if (tab) tab.doc = { ...doc.value }
  }

  function setOutline(o: OutlineNode[]): void {
    outline.value = o
  }

  function setCursor(line: number, col: number): void {
    cursor.value = { line, col }
  }

  function getContent(): string {
    return doc.value.content
  }

  function activateTab(id: string): void {
    if (id === activeTabId.value) return
    const target = tabs.value.find((item) => item.id === id)
    if (!target) return
    const current = tabs.value.find((item) => item.id === activeTabId.value)
    if (current) current.doc = { ...doc.value }
    activeTabId.value = id
    doc.value = { ...target.doc }
    savedContent = doc.value.dirty ? null : doc.value.content
    updateWordCount(doc.value.content)
    loadSignal.value++
  }

  function openTab(text: string, path: string | null, name: string, dirty = false): string {
    const existing = path && tabs.value.find((item) => item.doc.path === path)
    if (existing) { activateTab(existing.id); return existing.id }
    const id = `${path ?? 'untitled'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const next: EditorDoc = { id, path, name, content: text, dirty, savedAt: Date.now() }
    const current = tabs.value.find((item) => item.id === activeTabId.value)
    if (current) current.doc = { ...doc.value }
    tabs.value.push({ id, doc: next })
    activeTabId.value = id
    doc.value = { ...next }
    savedContent = dirty ? null : text
    updateWordCount(text)
    loadSignal.value++
    return id
  }

  function closeTab(id: string): void {
    const index = tabs.value.findIndex((item) => item.id === id)
    if (index < 0) return
    tabs.value.splice(index, 1)
    if (!tabs.value.length) {
      const fresh: EditorDoc = { id: 'untitled-1', path: null, name: 'untitled.md', content: '', dirty: false, savedAt: Date.now() }
      tabs.value.push({ id: fresh.id!, doc: fresh })
    }
    if (activeTabId.value === id) activateTab(tabs.value[Math.min(index, tabs.value.length - 1)].id)
  }

  return {
    doc,
    tabs,
    activeTabId,
    outline,
    cursor,
    wordCount,
    loadSignal,
    loadFromText,
    updateContent,
    markSaved,
    setOutline,
    setCursor,
    getContent,
    activateTab,
    openTab,
    closeTab,
    updateWordCount,
  }
})
