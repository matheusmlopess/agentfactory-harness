/**
 * Feature manifest + runtime gating (Stage E).
 *
 * The host loads a feature only when it is enabled (config-driven) AND its
 * declared contract major matches the host's. Both checks are pure functions so
 * they can be unit-tested without a running app.
 */
import type { ServiceKey } from './services.js'

/** The contract version the host implements. Bump the MAJOR on a breaking
 *  change to the Feature/FeatureCtx/ServiceMap surface. */
export const CONTRACT_VERSION = '1.0.0'

export interface FeatureManifest {
  id: string
  /** Semver the feature was built against, e.g. "1.0.0". */
  contract: string
  /** Service keys this feature registers. */
  provides?: ServiceKey[]
  /** Service keys this feature consumes (optional/lazy). */
  consumes?: ServiceKey[]
  /** Enabled when config says nothing. Defaults to true. */
  defaultEnabled?: boolean
}

/** The major component of a semver string ("1.2.3" -> "1"). */
export function contractMajor(version: string): string {
  return version.split('.')[0] ?? '0'
}

/** True when a feature's contract major matches the host's. */
export function isContractCompatible(featureContract: string, host: string = CONTRACT_VERSION): boolean {
  return contractMajor(featureContract) === contractMajor(host)
}

/**
 * Enabled unless config explicitly turns it off. `getSetting('features.<id>')`
 * of "off"/"false" disables; "on"/"true" force-enables; otherwise the
 * manifest's defaultEnabled (default true) wins.
 */
export function isFeatureEnabled(
  manifest: FeatureManifest,
  getSetting: (key: string) => string | undefined,
): boolean {
  const v = getSetting(`features.${manifest.id}`)
  if (v === 'off' || v === 'false') return false
  if (v === 'on' || v === 'true') return true
  return manifest.defaultEnabled ?? true
}
