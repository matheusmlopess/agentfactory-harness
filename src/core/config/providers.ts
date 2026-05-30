export type FieldType = 'apikey' | 'token' | 'url'
export type Category  = 'api' | 'cli' | 'ide' | 'framework' | 'local'

export interface ProviderDef {
  id: string
  name: string
  category: Category
  envVar?: string    // env var used as fallback when config file has no value
  configKey: string  // key inside config.json "keys" or "urls" bucket
  hint: string       // format hint shown in edit mode
  fieldType: FieldType
  aliasOf?: string   // if set: informational only — not independently editable
}

export const PROVIDERS: readonly ProviderDef[] = [
  // ── API providers ─────────────────────────────────────────────────────────
  { id: 'anthropic',   name: 'Anthropic Claude',        category: 'api',       envVar: 'ANTHROPIC_API_KEY',      configKey: 'anthropic',   hint: 'sk-ant-api03-…',              fieldType: 'apikey' },
  { id: 'openai',      name: 'OpenAI / Codex',          category: 'api',       envVar: 'OPENAI_API_KEY',         configKey: 'openai',      hint: 'sk-…',                        fieldType: 'apikey' },
  { id: 'gemini',      name: 'Google Gemini',           category: 'api',       envVar: 'GEMINI_API_KEY',         configKey: 'gemini',      hint: 'AIza…',                       fieldType: 'apikey' },
  { id: 'mistral',     name: 'Mistral AI',              category: 'api',       envVar: 'MISTRAL_API_KEY',        configKey: 'mistral',     hint: 'mistral key',                 fieldType: 'apikey' },
  { id: 'cohere',      name: 'Cohere',                  category: 'api',       envVar: 'COHERE_API_KEY',         configKey: 'cohere',      hint: 'co-…',                        fieldType: 'apikey' },
  { id: 'together',    name: 'Together AI',             category: 'api',       envVar: 'TOGETHER_API_KEY',       configKey: 'together',    hint: 'together key',                fieldType: 'apikey' },
  { id: 'groq',        name: 'Groq',                    category: 'api',       envVar: 'GROQ_API_KEY',           configKey: 'groq',        hint: 'gsk_…',                       fieldType: 'apikey' },
  { id: 'replicate',   name: 'Replicate',               category: 'api',       envVar: 'REPLICATE_API_TOKEN',    configKey: 'replicate',   hint: 'r8_…',                        fieldType: 'token'  },
  { id: 'huggingface', name: 'Hugging Face',            category: 'api',       envVar: 'HF_TOKEN',               configKey: 'huggingface', hint: 'hf_…',                        fieldType: 'token'  },
  { id: 'perplexity',  name: 'Perplexity',              category: 'api',       envVar: 'PERPLEXITY_API_KEY',     configKey: 'perplexity',  hint: 'pplx-…',                      fieldType: 'apikey' },
  { id: 'xai',         name: 'xAI / Grok',              category: 'api',       envVar: 'XAI_API_KEY',            configKey: 'xai',         hint: 'xai-…',                       fieldType: 'apikey' },
  { id: 'deepseek',    name: 'DeepSeek',                category: 'api',       envVar: 'DEEPSEEK_API_KEY',       configKey: 'deepseek',    hint: 'deepseek key',                fieldType: 'apikey' },
  { id: 'fireworks',   name: 'Fireworks AI',            category: 'api',       envVar: 'FIREWORKS_API_KEY',      configKey: 'fireworks',   hint: 'fw-…',                        fieldType: 'apikey' },
  { id: 'cerebras',    name: 'Cerebras',                category: 'api',       envVar: 'CEREBRAS_API_KEY',       configKey: 'cerebras',    hint: 'csk-…',                       fieldType: 'apikey' },
  { id: 'ai21',        name: 'AI21 Labs',               category: 'api',       envVar: 'AI21_API_KEY',           configKey: 'ai21',        hint: 'ai21 key',                    fieldType: 'apikey' },
  { id: 'bedrock',     name: 'Amazon Bedrock',          category: 'api',       envVar: 'AWS_ACCESS_KEY_ID',      configKey: 'bedrock',     hint: 'AWS access key ID',           fieldType: 'apikey' },
  { id: 'azure',       name: 'Azure OpenAI',            category: 'api',       envVar: 'AZURE_OPENAI_API_KEY',   configKey: 'azure',       hint: 'Azure API key',               fieldType: 'apikey' },
  { id: 'azure_url',   name: 'Azure OpenAI Endpoint',  category: 'api',       envVar: 'AZURE_OPENAI_ENDPOINT',  configKey: 'azure_url',   hint: 'https://….openai.azure.com/', fieldType: 'url'    },

  // ── CLI tools ─────────────────────────────────────────────────────────────
  { id: 'claudecode',  name: 'Claude Code',             category: 'cli',       aliasOf: 'anthropic',             configKey: 'anthropic',   hint: 'Uses Anthropic key',          fieldType: 'apikey' },
  { id: 'geminicli',   name: 'Gemini CLI',              category: 'cli',       aliasOf: 'gemini',                configKey: 'gemini',      hint: 'Uses Google Gemini key',      fieldType: 'apikey' },
  { id: 'githubcli',   name: 'GitHub Copilot CLI',      category: 'cli',       aliasOf: 'github',                configKey: 'github',      hint: 'Uses GitHub Copilot token',   fieldType: 'token'  },
  { id: 'aider',       name: 'Aider',                   category: 'cli',       aliasOf: 'openai',                configKey: 'openai',      hint: 'Uses OpenAI key by default',  fieldType: 'apikey' },

  // ── IDE / editor tools ────────────────────────────────────────────────────
  { id: 'github',      name: 'GitHub Copilot',          category: 'ide',       envVar: 'GITHUB_TOKEN',           configKey: 'github',      hint: 'ghp_… or ghs_…',              fieldType: 'token'  },
  { id: 'vscopilot',   name: 'VS Code Copilot',         category: 'ide',       aliasOf: 'github',                configKey: 'github',      hint: 'Uses GitHub Copilot token',   fieldType: 'token'  },
  { id: 'cursor',      name: 'Cursor',                  category: 'ide',       aliasOf: 'openai',                configKey: 'openai',      hint: 'Uses OpenAI key',             fieldType: 'apikey' },
  { id: 'codeium',     name: 'Codeium',                 category: 'ide',       envVar: 'CODEIUM_API_KEY',        configKey: 'codeium',     hint: 'codeium key',                 fieldType: 'apikey' },
  { id: 'tabnine',     name: 'Tabnine',                 category: 'ide',       envVar: 'TABNINE_TOKEN',          configKey: 'tabnine',     hint: 'tabnine token',               fieldType: 'token'  },

  // ── Agent frameworks ──────────────────────────────────────────────────────
  { id: 'openhands',   name: 'OpenHands',               category: 'framework', aliasOf: 'openai',                configKey: 'openai',      hint: 'Uses OpenAI or Anthropic key', fieldType: 'apikey' },
  { id: 'continue',    name: 'Continue.dev',            category: 'framework', envVar: 'CONTINUE_API_KEY',       configKey: 'continue',    hint: 'continue key or model key',   fieldType: 'apikey' },
  { id: 'cline',       name: 'Cline',                   category: 'framework', aliasOf: 'anthropic',             configKey: 'anthropic',   hint: 'Uses Anthropic key',          fieldType: 'apikey' },
  { id: 'sweagent',    name: 'SWE-agent',               category: 'framework', aliasOf: 'openai',                configKey: 'openai',      hint: 'Uses OpenAI key by default',  fieldType: 'apikey' },

  // ── Local model servers ───────────────────────────────────────────────────
  { id: 'ollama',      name: 'Ollama',                  category: 'local',     envVar: 'OLLAMA_HOST',            configKey: 'ollama',      hint: 'http://localhost:11434',      fieldType: 'url'    },
  { id: 'lmstudio',    name: 'LM Studio',               category: 'local',     envVar: 'LM_STUDIO_BASE_URL',     configKey: 'lmstudio',    hint: 'http://localhost:1234/v1',    fieldType: 'url'    },
  { id: 'localai',     name: 'LocalAI',                 category: 'local',     envVar: 'LOCALAI_BASE_URL',       configKey: 'localai',     hint: 'http://localhost:8080/v1',    fieldType: 'url'    },
] as const

const CATEGORY_ORDER: Category[] = ['api', 'cli', 'ide', 'framework', 'local']

export function providersByCategory(): Map<Category, ProviderDef[]> {
  const map = new Map<Category, ProviderDef[]>(CATEGORY_ORDER.map(c => [c, []]))
  for (const p of PROVIDERS) {
    map.get(p.category)?.push(p)
  }
  return map
}
