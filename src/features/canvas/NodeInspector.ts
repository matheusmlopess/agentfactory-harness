import type { CellBuffer } from '../../shared/renderer/cell-buffer.js'
import type { Rect } from '../../shared/renderer/layout.js'
import type { KeyEvent } from '../../shared/input/keyboard.js'
import type { MouseEvent } from '../../shared/input/mouse.js'
import { Colors } from '../../shared/renderer/theme.js'
import { Overlay } from '../../shared/widgets/Overlay.js'
import type { StudioNode } from '@factory/orchestration/studio-model.js'

const NODE_ID_PATTERN = /^[a-z0-9_-]+$/
const PROVIDERS = ['', 'anthropic', 'openai'] as const

interface FieldDef {
  key: 'id' | 'agent' | 'provider' | 'model' | 'timeout' | 'prompt'
  label: string
}

const FIELDS: readonly FieldDef[] = [
  { key: 'id',       label: 'id' },
  { key: 'agent',    label: 'agent' },
  { key: 'provider', label: 'provider' },
  { key: 'model',    label: 'model' },
  { key: 'timeout',  label: 'timeout' },
  { key: 'prompt',   label: 'prompt' },
]

export interface NodeInspectorOpts {
  onSave(node: StudioNode): void
  onCancel(): void
  /** Node ids already taken (excluding the edited node's original id). */
  takenIds: readonly string[]
}

/**
 * Modal node editor (PLAN-13 §6): the real replacement for the no-op
 * "Open session". Tab cycles fields, typing edits, ←/→ cycles the provider,
 * Enter saves, Esc cancels; inline validation blocks bad saves.
 */
export class NodeInspector {
  private readonly overlay: Overlay
  private fieldIdx = 0
  private values: Record<FieldDef['key'], string>

  constructor(private readonly original: StudioNode, private readonly opts: NodeInspectorOpts) {
    this.overlay = new Overlay({
      title: `Edit: ${original.id}`, tier: 'md',
      footerHint: 'Tab field · Enter save · Esc cancel',
      onDismiss: () => this.opts.onCancel(),
    })
    this.values = {
      id: original.id,
      agent: original.agent,
      provider: original.provider ?? '',
      model: original.model ?? '',
      timeout: original.timeout !== undefined ? String(original.timeout) : '',
      prompt: original.prompt,
    }
  }

  /** Validation issues for the current field values. */
  issues(): string[] {
    const out: string[] = []
    if (!NODE_ID_PATTERN.test(this.values.id)) out.push('id must match a-z0-9_-')
    if (this.opts.takenIds.includes(this.values.id)) out.push(`id "${this.values.id}" already exists`)
    if (this.values.agent.trim().length === 0) out.push('agent is required')
    if (this.values.prompt.trim().length === 0) out.push('prompt is required')
    if (this.values.provider !== '' && !['anthropic', 'openai'].includes(this.values.provider)) {
      out.push('provider must be anthropic or openai')
    }
    if (this.values.timeout !== '' && !/^\d+$/.test(this.values.timeout)) out.push('timeout must be a number')
    return out
  }

  private contentRows(): number {
    return FIELDS.length + 3  // fields + blank + issues/hint rows
  }

  render(buf: CellBuffer, container: Rect): void {
    const f = this.overlay.renderFrame(buf, container, this.contentRows())
    const labelW = 10
    for (let i = 0; i < FIELDS.length; i++) {
      const field = FIELDS[i]!
      const row = f.inner.row + i
      const active = i === this.fieldIdx
      buf.write(row, f.inner.col + 1, field.label.padEnd(labelW), {
        fg: active ? Colors.textBright : Colors.textDim, bg: Colors.surfacePanel, bold: active,
      })
      const value = this.values[field.key] + (active ? '█' : '')
      const fieldW = f.inner.width - labelW - 2
      const shown = value.length > fieldW ? value.slice(-fieldW) : value
      buf.write(row, f.inner.col + 1 + labelW, shown.padEnd(fieldW), {
        fg: Colors.text, bg: active ? Colors.surfaceActive : Colors.surfacePanel,
      })
    }
    const issues = this.issues()
    const msgRow = f.inner.row + FIELDS.length + 1
    if (issues.length > 0) {
      buf.write(msgRow, f.inner.col + 1, `✗ ${issues[0]!}`.substring(0, f.inner.width - 2), {
        fg: Colors.danger, bg: Colors.surfacePanel, bold: true,
      })
    } else {
      buf.write(msgRow, f.inner.col + 1, '✓ valid', { fg: Colors.success, bg: Colors.surfacePanel })
    }
  }

  /** Frame for hit-testing (mouse dismissal). */
  layout(container: Rect): ReturnType<Overlay['layout']> {
    return this.overlay.layout(container, this.contentRows())
  }

  onKey(e: KeyEvent): boolean {
    if (this.overlay.handleKey(e)) return true
    if (e.key === 'tab' || e.key === 'arrow_down') {
      this.fieldIdx = (this.fieldIdx + 1) % FIELDS.length
      return true
    }
    if (e.key === 'arrow_up') {
      this.fieldIdx = (this.fieldIdx - 1 + FIELDS.length) % FIELDS.length
      return true
    }
    const field = FIELDS[this.fieldIdx]!
    if (field.key === 'provider' && (e.key === 'arrow_left' || e.key === 'arrow_right')) {
      const idx = PROVIDERS.indexOf(this.values.provider as typeof PROVIDERS[number])
      const dir = e.key === 'arrow_right' ? 1 : -1
      this.values.provider = PROVIDERS[(idx + dir + PROVIDERS.length) % PROVIDERS.length]!
      return true
    }
    if (e.key === 'enter') {
      if (this.issues().length > 0) return true  // blocked — inline error shows why
      this.opts.onSave(this.toNode())
      return true
    }
    if (e.key === 'backspace') {
      this.values[field.key] = this.values[field.key].slice(0, -1)
      return true
    }
    if (e.key.length === 1 && e.key >= ' ') {
      this.values[field.key] += e.key
      return true
    }
    return true  // modal: consume everything while open
  }

  onMouse(e: MouseEvent, container: Rect): boolean {
    this.overlay.handleMouse(e, this.layout(container))
    return true
  }

  private toNode(): StudioNode {
    const node: StudioNode = {
      ...this.original,
      id: this.values.id,
      agent: this.values.agent,
      prompt: this.values.prompt,
    }
    delete node.provider
    delete node.model
    delete node.timeout
    if (this.values.provider !== '') node.provider = this.values.provider as 'anthropic' | 'openai'
    if (this.values.model !== '') node.model = this.values.model
    if (this.values.timeout !== '') node.timeout = Number(this.values.timeout)
    return node
  }
}
