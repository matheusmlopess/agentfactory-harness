/**
 * Back-compat re-export. The Feature contract now lives in src/contracts/.
 * Existing `import … from '../types.js'` sites keep working; new code should
 * import from '@factory/contracts/index.js' directly.
 */
export type {
  Feature,
  FeatureCtx,
  KeyBindingContribution,
} from '@factory/contracts/feature.js'
