import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js'

export class Session {
  private history: MessageParam[] = []

  addMessage(msg: MessageParam): void {
    this.history.push(msg)
  }

  getHistory(): readonly MessageParam[] {
    return this.history
  }

  tokenCount(): number {
    if (this.history.length === 0) return 0
    return Math.ceil(JSON.stringify(this.history).length / 4)
  }

  clear(): void {
    this.history = []
  }
}
