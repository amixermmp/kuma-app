export type TabType = 'sendcar' | 'returncar' | 'rental' | 'booking'

export interface StaffTab {
  id: string
  type: TabType
  title: string
  href: string
}

const KEY = 'kuma_tabs'
const MAX = 5
const EV = 'kuma-tabs-changed'

export function getTabs(): StaffTab[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

function save(tabs: StaffTab[]) {
  localStorage.setItem(KEY, JSON.stringify(tabs))
  window.dispatchEvent(new Event(EV))
}

export function addTab(tab: Omit<StaffTab, 'id'>): void {
  const tabs = getTabs()
  if (tabs.find(t => t.href === tab.href)) return   // already open
  if (tabs.length >= MAX) tabs.shift()              // drop oldest if full
  // number duplicate types: ส่งรถ → ส่งรถ 2, ส่งรถ 3 …
  const sameType = tabs.filter(t => t.type === tab.type).length
  const title = sameType === 0 ? tab.title : `${tab.title} ${sameType + 1}`
  tabs.push({ ...tab, title, id: crypto.randomUUID() })
  save(tabs)
}

export function removeTab(id: string): void {
  save(getTabs().filter(t => t.id !== id))
}

export function listenTabs(cb: () => void) {
  window.addEventListener(EV, cb)
  return () => window.removeEventListener(EV, cb)
}
