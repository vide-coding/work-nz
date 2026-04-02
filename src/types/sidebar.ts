import type { Component } from 'vue'

/**
 * Navigation item type used in sidebar components
 */
export interface SidebarNavItem {
  id: string
  labelKey: string
  icon: Component
}
