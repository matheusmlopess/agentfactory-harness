import { z } from 'zod'

const stepIdPattern = /^[a-z0-9_-]+$/

export const StepSchema = z.object({
  id: z.string().regex(stepIdPattern, 'Step id must match /^[a-z0-9_-]+$/'),
  agent: z.string().min(1),
  prompt: z.string().min(1),
  dependsOn: z.array(z.string()).default([]),
  timeout: z.number().int().positive().optional(),
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

export const PlanSchema = z
  .object({
    version: z.literal('1.0'),
    name: z.string().min(1),
    steps: z.array(StepSchema).min(1),
  })
  .superRefine(validatePlan)

export type Plan = z.infer<typeof PlanSchema>
