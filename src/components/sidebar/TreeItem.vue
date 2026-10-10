<script setup lang="ts">
import { ref } from 'vue'
import type { FileItem } from '@/types'
import { useFilesStore } from '@/stores/files'
import { useEditorStore } from '@/stores/editor'

// Recursive node: renders a folder (with lazy-expand children) or a Markdown file.
// Rust already filters the tree to `.md` files + directories, so only those appear.
const props = defineProps<{
  item: FileItem & { expanded?: boolean; loaded?: boolean }
  depth: number
}>()

const files = useFilesStore()
const editor = useEditorStore()

const hover = ref(false)

async function onToggle(): Promise<void> {
  if (!props.item.isDir) {
    await files.openFile(props.item.path)
    return
  }
  props.item.expanded = !props.item.expanded
  if (props.item.expanded && !props.item.loaded) {
    const kids = await files.fetchChildren(props.item.path)
    props.item.children = kids
    props.item.loaded = true
  }
}

function isSelected(): boolean {
  return !!editor.doc.path && editor.doc.path === props.item.path
}
</script>

<template>
  <div class="node">
    <div
      class="row"
      :class="{ selected: isSelected(), dir: item.isDir }"
      :style="{ paddingLeft: 6 + depth * 14 + 'px' }"
      @click="onToggle"
      @mouseenter="hover = true"
      @mouseleave="hover = false"
    >
      <!-- Expand / collapse chevron (folders only) -->
      <span v-if="item.isDir" class="chevron" :class="{ open: item.expanded }">
        <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true">
          <path d="M6 4l4 4-4 4z" fill="currentColor" />
        </svg>
      </span>
      <span v-else class="chevron-placeholder" />

      <!-- Folder / file icon -->
      <span class="icon">
        <svg v-if="item.isDir" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <path
            v-if="item.expanded"
            d="M1.5 3.5h4l1.2 1.3H14a.8.8 0 0 1 .8.8v6.4a.8.8 0 0 1-.8.8H1.5a.8.8 0 0 1-.8-.8V4.3a.8.8 0 0 1 .8-.8z"
            fill="currentColor"
          />
          <path
            v-else
            d="M1.5 3.5h4l1.2 1.3h7.3a.8.8 0 0 1 .8.8v6.6a.8.8 0 0 1-.8.8H1.5a.8.8 0 0 1-.8-.8V4.3a.8.8 0 0 1 .8-.8z"
            fill="currentColor"
          />
        </svg>
        <svg v-else viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <path
            d="M3.5 1.5h6l3 3v9a.5.5 0 0 1-.5.5h-8.5a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5z"
            fill="currentColor"
            opacity="0.85"
          />
          <path d="M9.5 1.5v3h3" fill="none" stroke="var(--bg)" stroke-width="0.8" />
        </svg>
      </span>

      <span class="label" :title="item.path">{{ item.name }}</span>
    </div>

    <!-- Nested children with a guide line for a refined tree look -->
    <div v-if="item.isDir && item.expanded && item.children && item.children.length" class="children">
      <TreeItem
        v-for="child in item.children"
        :key="child.path"
        :item="child"
        :depth="depth + 1"
      />
    </div>
    <div
      v-else-if="item.isDir && item.expanded && item.children && !item.children.length"
      class="empty-child"
      :style="{ paddingLeft: 6 + (depth + 1) * 14 + 'px' }"
    >
      （空）
    </div>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  color: var(--fg);
}
.row:hover {
  background: var(--accent-soft);
}
.row.selected {
  background: var(--accent);
  color: #fff;
}
.chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  color: var(--fg-muted);
  transition: transform 0.12s ease;
}
.chevron.open {
  transform: rotate(90deg);
}
.chevron-placeholder {
  display: inline-block;
  width: 12px;
}
.icon {
  display: inline-flex;
  align-items: center;
  color: var(--accent);
}
.row.selected .icon {
  color: #fff;
}
.row.selected .chevron {
  color: rgba(255, 255, 255, 0.85);
}
.label {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
}
.children {
  border-left: 1px solid var(--border);
  margin-left: 12px;
}
.empty-child {
  font-size: 12px;
  color: var(--fg-muted);
  padding: 2px 6px;
}
</style>
