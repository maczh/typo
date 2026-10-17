import type { ObjectDirective } from 'vue'

const cleanups = new WeakMap<HTMLElement, () => void>()

/** Keep fixed popups reachable, including submenus inside scrolling menus. */
export const menuViewport: ObjectDirective<HTMLElement, boolean> = {
  mounted(el, binding) {
    const submenu = !!binding.value
    const anchor = submenu || el.matches('.menu-dropdown, .tb-menu') ? el.parentElement : null
    const initial = el.getBoundingClientRect()
    const place = () => {
      const margin = 8
      el.style.position = 'fixed'
      el.style.maxHeight = `${Math.max(40, window.innerHeight - margin * 2)}px`
      el.style.maxWidth = `${Math.max(40, window.innerWidth - margin * 2)}px`
      el.style.overflowY = 'auto'
      el.style.overscrollBehavior = 'contain'
      const rect = el.getBoundingClientRect()
      const parent = anchor?.getBoundingClientRect()
      let left = parent ? (submenu ? parent.right : parent.left) : initial.left
      const top = parent ? (submenu ? parent.top : parent.bottom) : initial.top
      if (parent && submenu && left + rect.width > window.innerWidth - margin) left = parent.left - rect.width
      el.style.left = `${Math.max(margin, Math.min(left, window.innerWidth - rect.width - margin))}px`
      el.style.top = `${Math.max(margin, Math.min(top, window.innerHeight - rect.height - margin))}px`
      el.style.marginLeft = '0'
    }
    const onScroll = (event: Event) => {
      if (event.target !== el && !(event.target instanceof Node && el.contains(event.target))) place()
    }
    place()
    const frame = requestAnimationFrame(place)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    cleanups.set(el, () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    })
  },
  unmounted(el) {
    cleanups.get(el)?.()
    cleanups.delete(el)
  },
}
