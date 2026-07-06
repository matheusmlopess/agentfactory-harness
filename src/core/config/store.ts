import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import type { FieldType } from './providers.js'

export interface ConfigFile {
  keys: Record<string, string>
  urls: Record<string, string>
  /** UI settings: theme, reducedMotion, sizeProfile, layout.*Ratio, … */
  settings: Record<string, string>
}

export class ConfigStore {
  private data: ConfigFile = { keys: {}, urls: {}, settings: {} }
  private loaded = false
  lastWriteError: string | null = null

  async init(): Promise<void> {
    if (this.loaded) return
    this.loaded = true
    try {
      const raw = await readFile(this.configPath(), 'utf8')
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const p = parsed as Record<string, unknown>
        this.data = {
          keys: isStringRecord(p['keys']) ? p['keys'] : {},
          urls: isStringRecord(p['urls']) ? p['urls'] : {},
          settings: isStringRecord(p['settings']) ? p['settings'] : {},
        }
      }
    } catch (err) {
      if (isEnoent(err)) return  // first run — no config yet
      this.lastWriteError = `config read: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  getSetting(key: string): string | undefined {
    return this.data.settings[key]
  }

  setSetting(key: string, value: string): void {
    this.data.settings[key] = value
    this.persist()
  }

  getKey(configKey: string, envVar?: string): string | undefined {
    const fileVal = this.data.keys[configKey] ?? this.data.urls[configKey]
    if (fileVal !== undefined && fileVal !== '') return fileVal
    if (envVar) return process.env[envVar]
    return undefined
  }

  setKey(configKey: string, value: string, fieldType: FieldType): void {
    if (fieldType === 'url') {
      this.data.urls[configKey] = value
      delete this.data.keys[configKey]
    } else {
      this.data.keys[configKey] = value
      delete this.data.urls[configKey]
    }
    this.persist()
  }

  clearKey(configKey: string): void {
    delete this.data.keys[configKey]
    delete this.data.urls[configKey]
    this.persist()
  }

  private persist(): void {
    const path = this.configPath()
    void mkdir(dirname(path), { recursive: true })
      .then(() => writeFile(path, JSON.stringify(this.data, null, 2), 'utf8'))
      .catch(err => {
        this.lastWriteError = `config write: ${err instanceof Error ? err.message : String(err)}`
      })
  }

  private configPath(): string {
    return join(homedir(), '.config', 'agentfactory', 'config.json')
  }
}

function isStringRecord(v: unknown): v is Record<string, string> {
  return v !== null && typeof v === 'object' && !Array.isArray(v) &&
    Object.values(v as object).every(x => typeof x === 'string')
}

function isEnoent(err: unknown): boolean {
  return err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT'
}

export const store = new ConfigStore()
