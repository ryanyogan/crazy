import type { ChapterName } from '@crazy/shared'
import { useCallback, useSyncExternalStore } from 'react'

// Which chapters of the rundown are open. It is UI state and nothing else —
// which is why it lives on the device and never in D1 (ADR 0002): what she
// closed on her laptop is no business of her phone's, and no chapter's state
// is anything Crazy would ever want to reason about.

const STORE = 'crazy.today.chapters'

/** What the device remembers: only the chapters she has decided about herself. */
type Decided = Partial<Record<ChapterName, boolean>>

/** Nothing decided: what a server render knows, and what a browser that cannot store falls back to. */
const NOTHING: Decided = Object.freeze({})

/**
 * The last value read, kept so that `useSyncExternalStore` is handed the same
 * object each time it asks and does not re-render forever.
 */
let held: Decided = NOTHING
let read = false

function parse(raw: string | null): Decided {
  if (!raw) return NOTHING
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return NOTHING
    const decided = Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([, open]) => typeof open === 'boolean',
      ),
    ) as Decided
    return Object.keys(decided).length === 0 ? NOTHING : decided
  } catch {
    return NOTHING
  }
}

function snapshot(): Decided {
  if (read) return held
  try {
    held = parse(window.localStorage.getItem(STORE))
  } catch {
    // A private window, or storage the browser will not hand over: the
    // defaults are perfectly good, and there is nothing here worth failing for.
    held = NOTHING
  }
  read = true
  return held
}

const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  // Another tab of the same screen changed its mind: this one follows.
  const elsewhere = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORE) return
    read = false
    for (const each of listeners) each()
  }
  window.addEventListener('storage', elsewhere)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', elsewhere)
  }
}

function remember(next: Decided): void {
  held = next
  read = true
  try {
    window.localStorage.setItem(STORE, JSON.stringify(next))
  } catch {
    // Nothing to do and nothing to say: the screen works either way.
  }
  for (const listener of listeners) listener()
}

export interface Chapters {
  /** Whether this chapter is open, by what she decided or, failing that, the default. */
  isOpen: (name: ChapterName, byDefault: boolean) => boolean
  toggle: (name: ChapterName, byDefault: boolean) => void
  /** Open it, whatever it was: how `#hash` and the ribbon dive into a chapter. */
  open: (name: ChapterName) => void
}

/**
 * The chapters' open state, kept on the device.
 *
 * A server render knows nothing of the device, so it draws the defaults — a
 * chapter with something in it open, an empty one closed — and hydration draws
 * exactly the same thing, so the common case never flashes. What she has
 * decided is laid over once the page is live, and again whenever another tab
 * decides something.
 */
export function useChapters(): Chapters {
  const decided = useSyncExternalStore(subscribe, snapshot, () => NOTHING)

  return {
    isOpen: useCallback(
      (name: ChapterName, byDefault: boolean) => decided[name] ?? byDefault,
      [decided],
    ),
    toggle: useCallback(
      (name: ChapterName, byDefault: boolean) =>
        remember({ ...decided, [name]: !(decided[name] ?? byDefault) }),
      [decided],
    ),
    open: useCallback(
      (name: ChapterName) => {
        if (decided[name] === true) return
        remember({ ...decided, [name]: true })
      },
      [decided],
    ),
  }
}

/**
 * Where the URL says to dive in: `#meetings` opens that chapter and brings it
 * to the top of the screen, so the ribbon, the index and a link from another
 * screen all arrive the same way. Smooth only where motion is welcome.
 */
export function scrollToChapter(name: ChapterName): void {
  const node = document.getElementById(name)
  if (!node) return
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  node.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
}
