import { X } from 'lucide-react'
import { dismiss, useNotices } from '#/lib/notices'

/** What went wrong with something the user just did, until they dismiss it. */
export function Notices() {
  const notices = useNotices()

  return (
    <div className="notices" role="alert">
      {notices.map((notice) => (
        <div key={notice.id} className="notice">
          <span>{notice.text}</span>
          <button
            type="button"
            className="notice__dismiss"
            aria-label="Dismiss"
            onClick={() => dismiss(notice.id)}
          >
            <X size={14} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  )
}
