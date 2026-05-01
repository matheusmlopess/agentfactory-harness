import type { Step } from './schema.js'

/**
 * Kahn's algorithm topological sort.
 * Throws if a cycle is detected.
 */
export function toposort(steps: Step[]): string[] {
  const ids = new Set(steps.map((s) => s.id))
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>() // id → dependents

  for (const step of steps) {
    inDegree.set(step.id, step.dependsOn.length)
    adj.set(step.id, [])
  }

  for (const step of steps) {
    for (const dep of step.dependsOn) {
      if (!ids.has(dep)) continue
      adj.get(dep)!.push(step.id)
    }
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const result: string[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    result.push(id)
    for (const dependent of adj.get(id) ?? []) {
      const deg = (inDegree.get(dependent) ?? 1) - 1
      inDegree.set(dependent, deg)
      if (deg === 0) queue.push(dependent)
    }
  }

  if (result.length !== steps.length) {
    const cycles = detectCycles(steps)
    const cycleStr = cycles.map((c) => c.join(' → ')).join('; ')
    throw new Error(`Plan contains cycles: ${cycleStr}`)
  }

  return result
}

/** DFS-based cycle detection. Returns each cycle as an ordered id array. */
export function detectCycles(steps: Step[]): string[][] {
  const adj = new Map<string, string[]>()
  for (const step of steps) {
    adj.set(step.id, [...step.dependsOn])
  }

  const visited = new Set<string>()
  const stack = new Set<string>()
  const cycles: string[][] = []

  function dfs(id: string, path: string[]): void {
    if (stack.has(id)) {
      const cycleStart = path.indexOf(id)
      cycles.push(path.slice(cycleStart))
      return
    }
    if (visited.has(id)) return

    visited.add(id)
    stack.add(id)
    path.push(id)

    for (const dep of adj.get(id) ?? []) {
      dfs(dep, path)
    }

    path.pop()
    stack.delete(id)
  }

  for (const step of steps) {
    if (!visited.has(step.id)) {
      dfs(step.id, [])
    }
  }

  return cycles
}

/**
 * Returns the set of step ids that are ready to run:
 * status pending (not in completed) and all dependsOn ids are in completed.
 */
export function readySet(steps: Step[], completed: Set<string>): Set<string> {
  const ready = new Set<string>()
  for (const step of steps) {
    if (completed.has(step.id)) continue
    if (step.dependsOn.every((dep) => completed.has(dep))) {
      ready.add(step.id)
    }
  }
  return ready
}
