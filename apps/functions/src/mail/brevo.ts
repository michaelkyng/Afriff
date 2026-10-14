/**
 * Brevo's transactional email API, over plain `fetch`.
 * https://developers.brevo.com/reference/sendtransacemail
 */

const ENDPOINT = 'https://api.brevo.com/v3/smtp/email'
const TIMEOUT_MS = 15_000

export interface BrevoMessage {
  sender: { email: string; name?: string }
  to: { email: string; name?: string }[]
  replyTo?: { email: string; name?: string }
  subject: string
  htmlContent: string
  textContent: string
  /** Shows up in Brevo's logs and statistics. */
  tags?: string[]
}

export class BrevoError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Rate limits and server errors are worth another go; a bad request or key is not. */
    readonly retryable: boolean,
  ) {
    super(message)
    this.name = 'BrevoError'
  }
}

export async function sendWithBrevo(apiKey: string, message: BrevoMessage, fetchImpl: typeof fetch = fetch): Promise<{ messageId: string }> {
  const response = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const body = (await response.json().catch(() => ({}))) as { messageId?: string; message?: string; code?: string }
  if (!response.ok) {
    throw new BrevoError(response.status, body.message ?? body.code ?? response.statusText, response.status === 429 || response.status >= 500)
  }
  return { messageId: body.messageId ?? '' }
}
