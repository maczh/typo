<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MenuItem } from './menuTypes'

/**
 * Recursive menu entry. A single `MenuItem` renders as:
 *  - a separator when `sep`,
 *  - a submenu (▸) when `sub` is present — opens on hover, recursing into more
 *    MenuNodes,
 *  - a leaf button when `id` is present — clicks dispatch `onRun(id)` (after the
 *    disabled / checkmark predicates are consulted).
 *
 * Parent items deliberately do NOT call `onRun` and do NOT close the menu, so
 * opening a submenu never collapses the rest of the tree.
 */
const props = defineProps<{
  item: MenuItem
  onRun: (id: string) => void
}>()

const { t } = useI18n()
const open = ref(false)

function isDisabled(): boolean {
  return props.item.disabled ? props.item.disabled() : false
}

function click(): void {
  if (isDisabled()) return
  if (props.item.id) props.onRun(props.item.id)
}

function showSub(): void {
  if (props.item.sub) open.value = true
}
function hideSub(): void {
  open.value = false
}
</script>

<template>
  <div
    v-if="item.sep"
    class="menu-sep"
  ></div>

  <div
    v-else
    class="menu-item"
    :class="{ 'has-sub': !!item.sub, disabled: isDisabled() }"
    @mouseenter="showSub"
    @mouseleave="hideSub"
  >
    <button
      type="button"
      class="menu-item-btn"
      :class="{ checked: item.checked ? item.checked() : false }"
      :disabled="isDisabled()"
      @click.stop="click"
    >
      <span class="check">{{ item.checked && item.checked() ? '✓' : '' }}</span>
      <span class="label">{{ t(item.titleKey ?? '') }}</span>
      <span v-if="item.shortcut" class="shortcut">{{ item.shortcut }}</span>
      <span v-else-if="item.sub" class="arrow">▸</span>
    </button>

    <div
      v-if="item.sub && open"
      class="sub-menu"
    >
      <MenuNode
        v-for="child in item.sub"
        :key="child.id || child.titleKey"
        :item="child"
        :on-run="onRun"
      />
    </div>
  </div>
</template>

<style scoped>
.menu-item {
  position: relative;
}
.menu-item-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--fg);
  padding: 6px 10px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  text-align: left;
  white-space: nowrap;
}
.menu-item-btn:hover:not(:disabled) {
  background: var(--accent-soft);
}
.menu-item-btn.checked .check {
  color: var(--accent);
}
.menu-item-btn .check {
  display: inline-block;
  width: 14px;
}
.menu-item-btn .label {
  flex: 1 1 auto;
}
.menu-item-btn .shortcut {
  color: var(--fg-muted);
  font-size: 11px;
}
.menu-item-btn .arrow {
  color: var(--fg-muted);
  font-size: 11px;
}
.menu-item.disabled .menu-item-btn {
  opacity: 0.45;
  pointer-events: none;
}
.menu-sep {
  height: 1px;
  margin: 5px 4px;
  background: var(--border);
}
.sub-menu {
  position: absolute;
  left: 100%;
  top: 0;
  min-width: 200px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: var(--shadow);
  padding: 4px;
  z-index: 600;
}
</style>
