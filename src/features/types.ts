/**
 * Back-compat re-export. The Feature contract now lives in src/contracts/.
 * Existing `import … from '../types.js'` sites keep working; new code should
 * import from '../../contracts/index.js' directly.
 */
export type {
  Feature,
  FeatureCtx,
  KeyBindingContribution,
} from '../contracts/feature.js'
