export { Coordinator } from './coordinator/Coordinator'

// No UI and no public routes yet. The Queue consumer, the Workflows and the
// Provider webhook routes will be added to this handler.
export default {
  fetch() {
    return new Response('Not found', { status: 404 })
  },
} satisfies ExportedHandler<Env>
