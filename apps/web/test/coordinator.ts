// Test only. The entry the test Worker is built from: the real Coordinator, so
// that a command the upload route sends is decided and written exactly as it
// would be in the running app. Nothing in the app is built from this file.

export { Coordinator } from '@crazy/core'

export default {
  fetch: () => new Response('Not found', { status: 404 }),
}
