// A shell. Nothing calls a model yet, and nothing calls this.
//
// What will fill it: every LLM call Crazy makes — the Brief, the Priority
// stack's order and reasons, Signals, Circles and Overlaps, the Client
// suggestion on a Time entry, natural-language Time entry. All of them run
// here, from a Workflow or a Queue consumer, never from the Coordinator, which
// bills wall-clock time while awake and must never await a model (ADR 0002).
//
// It goes through an AI Gateway rather than straight at a provider so that
// every call is logged, cached, rate-limited and costed in one place, and so
// that changing model or provider is a change here and nowhere else.
//
// What it must never do: be called from `apps/web` or from the Coordinator, and
// never hold a provider key of its own — the gateway holds those.

/**
 * The AI Gateway this Worker's model calls go through. The gateway itself is
 * the owner's to create, and its id is `AI_GATEWAY_ID` in `wrangler.jsonc`
 * (docs/BRIEF.md, "Before this can be deployed"): the binding deploys without
 * one, so a Worker that never asks for a model never needs a gateway.
 *
 * Nothing calls this yet. It exists so that the first thing that does has one
 * place to come to.
 */
export function aiGateway(env: Env): AiGateway {
  // Read as a plain string: `wrangler types` gives a var the literal type of
  // whatever is in the config, and this has to mean "whatever the owner set".
  const id: string = env.AI_GATEWAY_ID
  if (!id) throw new Error('No AI Gateway is configured: set AI_GATEWAY_ID (docs/BRIEF.md).')
  return env.AI.gateway(id)
}
