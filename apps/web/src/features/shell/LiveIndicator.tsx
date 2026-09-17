/**
 * Whether this screen is current. The socket to the Coordinator is not wired
 * yet, so it says so rather than claiming to be live.
 */
export function LiveIndicator() {
  return (
    <div className="live" data-state="off">
      <span className="live__dot" aria-hidden="true" />
      Not live yet
    </div>
  )
}
