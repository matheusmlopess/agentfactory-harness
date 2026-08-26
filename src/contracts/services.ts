/**
 * Cross-feature service contracts (the neutral "bolt-spec").
 *
 * Features never import each other; they publish/consume these bridge
 * interfaces through the typed ServiceRegistry the host injects. Adding a new
 * cross-feature capability = add a key to ServiceMap here.
 *
 * Type references to shared/core/orchestration are `import type` only (erased
 * at compile time), so this module carries no runtime dependency on them.
 */
import type { SessionMeta } from '../features/session/panel.js'
import type { ModelEntry } from '../core/llm/index.js'
import type { Plan } from '../orchestration/schema.js'
import type { StepEvent } from '../orchestration/executor.js'

/** Provided by the session feature under key 'session'. */
export interface SessionBridge {
  metas(): SessionMeta[]
  switchTo(idx: number): void
  /** Activate the loaded session with this id; false if it isn't loaded. */
  switchToId(id: string): boolean
  /** Create a named session without stealing focus (canvas node binding). */
  createSession(name: string, model?: ModelEntry | null): SessionMeta
  /** Resume a saved rollout by id; returns the NEW record's meta or null. */
  resumeById(id: string): SessionMeta | null
  /** Post a user message to a session and resolve with the assistant text. */
  postMessage(id: string, text: string): Promise<string>
  getSelectedModel(): ModelEntry | null
  getChatMode(): boolean
  toggleChatMode(): void
  openModelPicker(): void
  openNewSessionMenu(): void
  hasSelection(): boolean
  copySelection(): void
  clearSelection(): void
}

/** Provided by the canvas feature under key 'plan' (status bar + Ctrl+R). */
export interface PlanBridge {
  isRunning(): boolean
  hasPlan(): boolean
  run(): Promise<void>
}

/** Provided by the agents feature under key 'plan-events' (live run dashboard). */
export interface PlanEventSink {
  setPlan(plan: Plan): void
  onPlanEvent(event: StepEvent): void
}

/** The single source of truth for cross-feature service keys → their contract. */
export interface ServiceMap {
  session: SessionBridge
  plan: PlanBridge
  'plan-events': PlanEventSink
}

export type ServiceKey = keyof ServiceMap

/**
 * Typed replacement for the old `Map<string, unknown>` + `as X` casts.
 * `get` returns `ServiceMap[K] | undefined` so every consumer is forced to
 * handle an absent (e.g. toggled-off) provider — the graceful-degradation path
 * becomes compiler-enforced.
 */
export interface ServiceRegistry {
  set<K extends ServiceKey>(key: K, value: ServiceMap[K]): void
  get<K extends ServiceKey>(key: K): ServiceMap[K] | undefined
  has(key: ServiceKey): boolean
}

export function createServiceRegistry(): ServiceRegistry {
  const m = new Map<ServiceKey, unknown>()
  return {
    set(key, value) {
      if (m.has(key)) throw new Error(`Service already registered: ${key}`)
      m.set(key, value)
    },
    get(key) {
      return m.get(key) as ServiceMap[typeof key] | undefined
    },
    has(key) {
      return m.has(key)
    },
  }
}
