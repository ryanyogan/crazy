import { spawn } from 'node:child_process'
import { join } from 'node:path'

// The harness compares against the dev server, because only a development
// build honours a pinned time. It uses one that is already up, or runs its own.

const REPO = join(import.meta.dirname, '../../..')

async function answers(origin: string): Promise<boolean> {
  try {
    await fetch(origin, { signal: AbortSignal.timeout(2000), redirect: 'manual' })
    return true
  } catch {
    return false
  }
}

/** Makes sure the app is up at `origin`. Returns how to stop it, if this started it. */
export async function ensureApp(origin: string): Promise<() => void> {
  if (await answers(origin)) return () => {}

  const { port, hostname } = new URL(origin)
  if (hostname !== 'localhost' || !port) {
    throw new Error(`Nothing answers at ${origin}, and the harness can only start localhost`)
  }
  console.log(`Starting the app with \`pnpm dev --port ${port}\`…`)
  // Its own process group, so stopping it takes both Workers down with it.
  const dev = spawn('pnpm', ['dev', '--port', port], {
    cwd: REPO,
    detached: true,
    stdio: 'ignore',
  })
  const stop = () => {
    if (dev.pid !== undefined && dev.exitCode === null) process.kill(-dev.pid, 'SIGTERM')
  }
  process.once('exit', stop)

  for (let waited = 0; waited < 90; waited++) {
    if (dev.exitCode !== null) throw new Error(`\`pnpm dev\` exited with ${dev.exitCode}`)
    if (await answers(origin)) return stop
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  stop()
  throw new Error(`\`pnpm dev\` did not answer at ${origin} within 90 seconds`)
}
