import type { Op, Patch } from '@crazy/shared'

/** How many patches a reconnecting client can be replayed before it must refetch. */
export const REPLAY_BUFFER = 200

/**
 * The Coordinator's sequence counter and replay buffer, kept in its own SQLite
 * so they survive hibernation. It is bookkeeping about what was broadcast, not
 * domain data: D1 already holds everything a patch says (ADR 0002).
 */
const TABLE = 'CREATE TABLE IF NOT EXISTS patch (seq INTEGER PRIMARY KEY, ops TEXT NOT NULL)'

export class PatchLog {
  constructor(private readonly sql: SqlStorage) {
    sql.exec(TABLE)
  }

  /**
   * Throws the log away and starts from nothing, whether or not the table is
   * still there: `deleteAll` may have taken it, and this instance goes on
   * living either way.
   */
  empty(): void {
    this.sql.exec(TABLE)
    this.sql.exec('DELETE FROM patch')
  }

  /** The sequence number of the last patch committed; 0 before the first. */
  last(): number {
    const row = this.sql.exec<{ last: number | null }>('SELECT max(seq) AS last FROM patch').one()
    return row.last ?? 0
  }

  /** Stamps operations with the next sequence number and remembers them. */
  append(ops: Op[]): Patch {
    const seq = this.last() + 1
    this.sql.exec('INSERT INTO patch (seq, ops) VALUES (?, ?)', seq, JSON.stringify(ops))
    this.sql.exec('DELETE FROM patch WHERE seq <= ?', seq - REPLAY_BUFFER)
    return { seq, ops }
  }

  /**
   * The patches committed after `seq`, oldest first, or 'gap' when they cannot
   * all be given: the buffer no longer reaches back that far, or `seq` is one
   * this log never issued. A client told 'gap' reads everything again.
   */
  since(seq: number): Patch[] | 'gap' {
    const last = this.last()
    if (seq === last) return []
    if (seq > last) return 'gap'
    const rows = this.sql
      .exec<{ seq: number; ops: string }>(
        'SELECT seq, ops FROM patch WHERE seq > ? ORDER BY seq',
        seq,
      )
      .toArray()
    if (rows[0]?.seq !== seq + 1) return 'gap'
    return rows.map((row) => ({ seq: row.seq, ops: JSON.parse(row.ops) as Op[] }))
  }
}
