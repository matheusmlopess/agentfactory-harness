/**
 * contracts/ — the neutral bolt-spec every block agrees on.
 *
 * The Feature plugin contract + the cross-feature service bridges and their
 * typed registry. Features, shared, and the host import from here instead of
 * reaching into each other, so any block can be upgraded behind its contract
 * without touching its neighbours.
 */
export type {
  Feature,
  FeatureCtx,
  KeyBindingContribution,
} from './feature.js'

export type {
  SessionBridge,
  PlanBridge,
  PlanEventSink,
  ServiceMap,
  ServiceKey,
  ServiceRegistry,
} from './services.js'

export { createServiceRegistry } from './services.js'
