import { z } from 'zod'

const stepIdPattern = /^[a-z0-9_-]+$/

export const StepSchema = z.object({
  id: z.string().regex(stepIdPattern, 'Step id must match /^[a-z0-9_-]+$/'),
  agent: z.string().min(1),
  prompt: z.string().min(1),
  dependsOn: z.array(z.string()).default([]),
  timeout: z.number().int().positive().optional(),
  provider: z.enum(['anthropic', 'openai']).optional(),
  model: z.string().optional(),
})

export type Step = z.infer<typeof StepSchema>

function validatePlan(
  data: { steps?: unknown },
  ctx: z.RefinementCtx,
): void {
  const steps = data.steps
  if (!Array.isArray(steps)) return

  const ids = new Set<string>()
  for (const step of steps) {
    if (typeof step?.id !== 'string') continue
    if (ids.has(step.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate step id: "${step.id}"`,
      })
      return
    }
    ids.add(step.id)
  }

  for (const step of steps) {
    if (!Array.isArray(step?.dependsOn)) continue
    for (const dep of step.dependsOn as unknown[]) {
      if (typeof dep === 'string' && !ids.has(dep)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Step "${step.id}" has unknown dependsOn ref: "${dep}"`,
        })
      }
    }
  }
}

/**
 * Optional, additive studio extension (ui-consolidation P6): carries canvas
 * layout and typed edge metadata for lossless round-trips. The executor and
 * CLI ignore it entirely — old plan files parse unchanged.
 */
export const StudioExtSchema = z.object({
  layout: z.record(z.object({ row: z.number().int(), col: z.number().int() })).default({}),
  edges: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        kind: z.enum(['dependency', 'handoff']),
        payload: z.string().optional(),
      }),
    )
    .default([]),
  /** nodeId → bound chat session id (rollout id). Additive; old files parse. */
  sessions: z.record(z.string()).default({}),
})

export type StudioExt = z.infer<typeof StudioExtSchema>

export const PlanSchema = z
  .object({
    version: z.literal('1.0'),
    name: z.string().min(1),
    steps: z.array(StepSchema).min(1),
    'x-studio': StudioExtSchema.optional(),
  })
  .superRefine(validatePlan)

export type Plan = z.infer<typeof PlanSchema>
