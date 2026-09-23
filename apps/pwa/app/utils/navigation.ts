import type { Component } from 'vue'
import { CalendarDaysIcon, HouseIcon, TicketIcon, UserRoundIcon } from 'lucide-vue-next'

export interface NavItem {
  label: string
  to: string
  icon: Component
  /** Only highlight on an exact path match (used for Home). */
  exact?: boolean
}

export const primaryNav: NavItem[] = [
  { label: 'Home', to: '/', icon: HouseIcon, exact: true },
  { label: 'Programme', to: '/programme', icon: CalendarDaysIcon },
  { label: 'Tickets', to: '/tickets', icon: TicketIcon },
  { label: 'Me', to: '/me', icon: UserRoundIcon },
]

export function isNavActive(item: NavItem, path: string): boolean {
  if (item.exact) return path === item.to
  return path === item.to || path.startsWith(`${item.to}/`)
}
