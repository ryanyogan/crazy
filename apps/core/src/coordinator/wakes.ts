/** What brought a sleeping Coordinator back: the first thing asked of it after it was constructed. */
export type WakeCause = 'request' | 'command' | 'socket' | 'message' | 'close' | 'schedule'

export interface Wake {
  at: string
  cause: WakeCause
}

/** Enough to count a day's wakes many times over, and no more. */
const KEPT = 500

/**
 * Each time the Coordinator woke and why, in its own SQLite. An idle socket
 * hibernates and costs nothing; this is how that is seen to be true.
 */
export class WakeLog {
  private noted = false

  constructor(private readonly sql: SqlStorage) {
    sql.exec(
      'CREATE TABLE IF NOT EXISTS wake (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, cause TEXT NOT NULL)',
    )
  }

  /** Records a wake the first time it is called in this instance's life; later calls are the same wake. */
  note(cause: WakeCause, now: Date): void {
    if (this.noted) return
    this.noted = true
    this.sql.exec('INSERT INTO wake (at, cause) VALUES (?, ?)', now.toISOString(), cause)
    this.sql.exec('DELETE FROM wake WHERE id <= (SELECT max(id) FROM wake) - ?', KEPT)
  }

  last(): Wake | null {
    const [row] = this.sql
      .exec<{ at: string; cause: WakeCause }>('SELECT at, cause FROM wake ORDER BY id DESC LIMIT 1')
      .toArray()
    return row ?? null
  }

  countSince(since: Date): number {
    return this.sql
      .exec<{ wakes: number }>(
        'SELECT count(*) AS wakes FROM wake WHERE at >= ?',
        since.toISOString(),
      )
      .one().wakes
  }
}
