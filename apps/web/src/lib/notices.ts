import { useSyncExternalStore } from 'react'

// What went wrong, said where the user will see it. Only the browser ever adds
// one, so a server render always sees none.

export interface Notice {
  id: number
  text: string
}

const NONE: Notice[] = []
let notices = NONE
let nextId = 1
const listeners = new Set<() => void>()

function set(next: Notice[]) {
  notices = next
  for (const listener of listeners) listener()
}

export function notify(text: string): void {
  set([...notices, { id: nextId++, text }])
}

export function dismiss(id: number): void {
  set(notices.filter((notice) => notice.id !== id))
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useNotices(): Notice[] {
  return useSyncExternalStore(
    subscribe,
    () => notices,
    () => NONE,
  )
}
