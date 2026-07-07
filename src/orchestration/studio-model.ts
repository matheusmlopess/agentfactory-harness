/**
 * Pure studio core (ui-consolidation P6, standalone PLAN-13): the canvas's
 * source of truth. No TUI imports — a future web renderer reuses this file
 * unchanged. Serializes to/from af-plan.json via the additive x-studio
 * extension so files remain runnable by the existing executor and CLI.
 */
import { PlanSchema, type Plan, type Step } from './schema.js'
import { detectCycles } from './graph.js'

const NODE_ID_PATTERN = /^[a-z0-9_-]+$/

export interface StudioNode {
  id: string
  kind: 'agent'
  /** Canvas layout (cells, relative to the canvas inner area). */
  row: number
  col: number
  agent: string
  prompt: string
  provider?: 'anthropic' | 'openai'
  model?: string
  timeout?: number
  /** View-only size hints (not serialized; defaults 20×5). */
  w?: number
  h?: number
}

export interface StudioEdge {
  id: string
  from: string
  to: string
  kind: 'dependency' | 'handoff'
  /** Handoff only: 'summary' | 'full' | 'outputs.<key>' (forward-compat). */
  payload?: string
}

export interface StudioModel {
  name: string
  nodes: StudioNode[]
  edges: StudioEdge[]
}

export interface StudioIssue {
  nodeId?: string
  edgeId?: string
  message: string
  fatal: boolean
}

/** Structural render view — matches the canvas Block/CanvasWire shapes. */
export interface StudioBlockView {
  id: string
  row: number
  col: number
  height: number
  width: number
  title: string
  status: 'idle' | 'pending' | 'running' | 'done' | 'error' | 'skipped'
  outputs: string[]
  inputs: string[]
}

export interface StudioWireView {
  id: string
  fromBlockId: string
  fromPort: string
  toBlockId: string
  toPort: string
  kind: 'dependency' | 'handoff'
  payload?: string
}

const BLOCK_W = 20
const BLOCK_H = 5
const COL_STRIDE = 26
const ROW_STRIDE = 8

export function emptyModel(name = 'untitled'): StudioModel {
  return { name, nodes: [], edges: [] }
}

/** Design-time validation — fatal issues block save/run. */
export function validateStudio(m: StudioModel): StudioIssue[] {
  const issues: StudioIssue[] = []
  const ids = new Set<string>()

  if (m.name.trim().length === 0) {
    issues.push({ message: 'Plan name is empty', fatal: true })
  }
  if (m.nodes.length === 0) {
    issues.push({ message: 'Plan has no agent nodes', fatal: true })
  }

  for (const node of m.nodes) {
    if (!NODE_ID_PATTERN.test(node.id)) {
      issues.push({ nodeId: node.id, message: `Node id "${node.id}" must match a-z0-9_-`, fatal: true })
    }
    if (ids.has(node.id)) {
      issues.push({ nodeId: node.id, message: `Duplicate node id "${node.id}"`, fatal: true })
    }
    ids.add(node.id)
    if (node.agent.trim().length === 0) {
      issues.push({ nodeId: node.id, message: `Node "${node.id}" has no agent`, fatal: true })
    }
    if (node.prompt.trim().length === 0) {
      issues.push({ nodeId: node.id, message: `Node "${node.id}" has an empty prompt`, fatal: true })
    }
  }

  for (const edge of m.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) {
      issues.push({ edgeId: edge.id, message: `Edge ${edge.from}→${edge.to} references a missing node`, fatal: true })
    } else if (edge.from === edge.to) {
      issues.push({ edgeId: edge.id, message: `Edge ${edge.from}→${edge.to} is a self-loop`, fatal: true })
    }
  }

  // Cycle detection over the dependency graph (reuses graph.ts)
  if (issues.every(i => !i.fatal || (i.edgeId === undefined && i.nodeId === undefined) === false)) {
    const pseudoSteps: Step[] = m.nodes.map(n => ({
      id: n.id,
      agent: n.agent || 'agent',
      prompt: n.prompt || 'x',
      dependsOn: m.edges.filter(e => e.to === n.id && ids.has(e.from)).map(e => e.from),
    }))
    try {
      const cycles = detectCycles(pseudoSteps)
      for (const cycle of cycles) {
        issues.push({ message: `Cycle: ${cycle.join(' → ')}`, fatal: true })
      }
    } catch {
      // malformed graph already reported above
    }
  }

  return issues
}

/** Edges into a node (both kinds become dependsOn — ordering semantics). */
function depsInto(nodeId: string, m: StudioModel): string[] {
  return m.edges.filter(e => e.to === nodeId).map(e => e.from)
}

/**
 * Serialize to a valid af-plan.json Plan the existing executor runs
 * unchanged. Handoff payloads ride the executor's {{depId}} interpolation:
 * when the target prompt lacks the marker, a standard input scaffold is
 * appended. Layout + edge kinds round-trip via x-studio.
 */
export function studioToPlan(m: StudioModel): Plan {
  const steps = m.nodes.map(node => {
    let prompt = node.prompt
    for (const edge of m.edges) {
      if (edge.to !== node.id || edge.kind !== 'handoff') continue
      if (!prompt.includes(`{{${edge.from}}}`)) {
        prompt += `\n\nInput from ${edge.from}:\n{{${edge.from}}}`
      }
    }
    return {
      id: node.id,
      agent: node.agent,
      prompt,
      dependsOn: depsInto(node.id, m),
      ...(node.provider !== undefined ? { provider: node.provider } : {}),
      ...(node.model !== undefined ? { model: node.model } : {}),
      ...(node.timeout !== undefined ? { timeout: node.timeout } : {}),
    }
  })

  const plan = {
    version: '1.0' as const,
    name: m.name,
    steps,
    'x-studio': {
      layout: Object.fromEntries(m.nodes.map(n => [n.id, { row: n.row, col: n.col }])),
      edges: m.edges.map(e => ({
        from: e.from,
        to: e.to,
        kind: e.kind,
        ...(e.payload !== undefined ? { payload: e.payload } : {}),
      })),
    },
  }
  return PlanSchema.parse(plan)
}

/** Inverse: load an af-plan.json for editing (auto-grid when no x-studio). */
export function planToStudio(plan: Plan): StudioModel {
  const ext = plan['x-studio']
  const nodes: StudioNode[] = plan.steps.map((step, i) => {
    const pos = ext?.layout[step.id] ?? {
      row: Math.floor(i / 4) * ROW_STRIDE,
      col: (i % 4) * COL_STRIDE,
    }
    return {
      id: step.id,
      kind: 'agent',
      row: pos.row,
      col: pos.col,
      agent: step.agent,
      prompt: step.prompt,
      ...(step.provider !== undefined ? { provider: step.provider } : {}),
      ...(step.model !== undefined ? { model: step.model } : {}),
      ...(step.timeout !== undefined ? { timeout: step.timeout } : {}),
    }
  })

  let edges: StudioEdge[]
  if (ext && ext.edges.length > 0) {
    edges = ext.edges.map(e => ({
      id: `${e.from}→${e.to}`,
      from: e.from,
      to: e.to,
      kind: e.kind,
      ...(e.payload !== undefined ? { payload: e.payload } : {}),
    }))
  } else {
    edges = plan.steps.flatMap(step =>
      step.dependsOn.map(dep => ({
        id: `${dep}→${step.id}`,
        from: dep,
        to: step.id,
        kind: 'dependency' as const,
      })),
    )
  }

  return { name: plan.name, nodes, edges }
}

/**
 * Derive the throwaway render view (ownership inversion, PLAN-13 §4.5):
 * blocks/wires are computed from the model, never the other way round.
 */
export function deriveView(
  m: StudioModel,
  statuses: Record<string, StudioBlockView['status']> = {},
): { blocks: StudioBlockView[]; wires: StudioWireView[] } {
  const blocks = m.nodes.map(node => ({
    id: node.id,
    row: node.row,
    col: node.col,
    height: node.h ?? BLOCK_H,
    width: node.w ?? BLOCK_W,
    title: node.id,
    status: statuses[node.id] ?? 'idle',
    outputs: ['out'],
    // Build mode: every agent always exposes an input port — a node could
    // never receive its FIRST wire otherwise
    inputs: ['in'],
  }))

  const wires = m.edges.map(edge => ({
    id: edge.id,
    fromBlockId: edge.from,
    fromPort: 'out',
    toBlockId: edge.to,
    toPort: 'in',
    kind: edge.kind,
    ...(edge.payload !== undefined ? { payload: edge.payload } : {}),
  }))

  return { blocks, wires }
}
