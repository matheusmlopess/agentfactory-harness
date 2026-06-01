import { spawn } from 'node:child_process'
import { platform } from 'node:os'
import { saveToken } from './auth.js'
import { registryClient } from './client.js'
import type { AuthUser } from './auth.js'

export type LoginEvent =
  | { kind: 'code';     userCode: string; verifyUrl: string; expiresIn: number }
  | { kind: 'progress'; secondsLeft: number }
  | { kind: 'success';  user: AuthUser }
  | { kind: 'error';    message: string }

interface DeviceCodeResponse {
  device_code:      string
  user_code:        string
  verification_uri: string
  expires_in:       number
}

interface PollResponse {
  status: 'pending' | 'authorized' | 'expired'
  token?: string
  user?:  AuthUser
}

function openBrowser(url: string): void {
  const cmd = platform() === 'darwin' ? 'open'
            : platform() === 'win32'  ? 'start'
            : 'xdg-open'
  try { spawn(cmd, [url], { detached: true, stdio: 'ignore' }).unref() } catch { /* ignore */ }
}

const POLL_INTERVAL_S = 3

/**
 * Device-code login flow.
 *
 * API contract (webapp backend — issue #86):
 *   POST /auth/cli/device  → DeviceCodeResponse
 *   GET  /auth/cli/poll?device_code=<code>  → PollResponse
 *
 * Gracefully emits error when the backend endpoint is not yet live.
 */
export async function* startDeviceLogin(): AsyncIterable<LoginEvent> {
  let device: DeviceCodeResponse
  try {
    device = await registryClient.post<DeviceCodeResponse>('/auth/cli/device', {})
  } catch {
    yield { kind: 'error', message: 'Login service not yet available — visit app.agentfactory.dev' }
    return
  }

  yield { kind: 'code', userCode: device.user_code, verifyUrl: device.verification_uri, expiresIn: device.expires_in }
  openBrowser(device.verification_uri)

  let secondsLeft = device.expires_in

  while (secondsLeft > 0) {
    await new Promise<void>(r => setTimeout(r, POLL_INTERVAL_S * 1000))
    secondsLeft -= POLL_INTERVAL_S

    let poll: PollResponse
    try {
      poll = await registryClient.get<PollResponse>(`/auth/cli/poll?device_code=${encodeURIComponent(device.device_code)}`)
    } catch {
      yield { kind: 'progress', secondsLeft: Math.max(0, secondsLeft) }
      continue
    }

    if (poll.status === 'authorized' && poll.token && poll.user) {
      await saveToken(poll.token)
      yield { kind: 'success', user: poll.user }
      return
    }

    if (poll.status === 'expired') {
      yield { kind: 'error', message: 'Login code expired. Please try again.' }
      return
    }

    yield { kind: 'progress', secondsLeft: Math.max(0, secondsLeft) }
  }

  yield { kind: 'error', message: 'Login timed out. Please try again.' }
}
