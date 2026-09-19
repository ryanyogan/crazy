import { useCallback, useSyncExternalStore } from 'react'

// Whether the screen's own timer bar — the full card at the top of Today — is
// still where the user can see it. The Shell's compact header asks, because it
// must never be shown beside the thing it stands in for: on a phone the docked
// strip appears only once the card has scrolled away, and on desktop the bar
// is itself what takes the compact measurements.
//
// A sentinel just below the bar answers it, watched by an IntersectionObserver.
// No scroll listener: nothing here runs per frame.

/** True while no bar has said otherwise, which is every screen that draws none. */
let onScreen = true
const listeners = new Set<() => void>()

function say(showing: boolean): void {
  if (showing === onScreen) return
  onScreen = showing
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Whether the screen's full bar is on the screen. A server render knows no
 * scroll position, and every screen starts at the top, so it answers yes.
 */
export function useBarOnScreen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => onScreen,
    () => true,
  )
}

/**
 * The sentinel the full bar puts just below itself. While it is above the top
 * of the viewport the bar has been scrolled past; when the bar leaves the page
 * altogether the sentinel goes with it and says so, so that a screen without
 * one is never mistaken for a screen scrolled past one.
 */
export function useBarSentinel(): (node: HTMLElement | null) => (() => void) | undefined {
  return useCallback((node: HTMLElement | null) => {
    if (!node) return
    const watch = new IntersectionObserver(
      ([entry]) => {
        // Below the fold counts as on the screen: a bar taller than the
        // viewport has not been scrolled past, it has not been reached.
        if (entry) say(entry.isIntersecting || entry.boundingClientRect.top > 0)
      },
      { threshold: 0 },
    )
    watch.observe(node)
    return () => {
      watch.disconnect()
      say(true)
    }
  }, [])
}
