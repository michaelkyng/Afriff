import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * The few Paystack endpoints the festival needs, over plain `fetch`.
 * https://paystack.com/docs/api/transaction/
 *
 * Amounts are in kobo, as everywhere else in the app. The secret key decides
 * test or live mode; nothing else changes between the two.
 */

const API = 'https://api.paystack.co'
const TIMEOUT_MS = 15_000

export type PaystackStatus =
  | 'success'
  | 'failed'
  | 'abandoned'
  | 'ongoing'
  | 'pending'
  | 'processing'
  | 'queued'
  | 'reversed'

/** The fields of a Paystack transaction this codebase reads. The webhook's `data` has the same shape. */
export interface PaystackTransaction {
  reference: string
  status: PaystackStatus
  amount: number
  currency: string
  channel?: string | null
  gateway_response?: string | null
  paid_at?: string | null
  authorization?: { last4?: string | null; card_type?: string | null; brand?: string | null } | null
  metadata?: unknown
}

/** Statuses that mean the attendee may still pay on this attempt. */
export const OPEN_STATUSES: readonly PaystackStatus[] = ['abandoned', 'ongoing', 'pending', 'processing', 'queued']

export class PaystackError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'PaystackError'
  }
}

export interface InitializeInput {
  email: string
  /** In kobo. */
  amount: number
  reference: string
  /** Where Paystack's own checkout page sends the attendee afterwards. */
  callbackUrl: string
  metadata: Record<string, unknown>
}

export interface PaystackClient {
  initialize(input: InitializeInput): Promise<{ authorizationUrl: string; accessCode: string; reference: string }>
  verify(reference: string): Promise<PaystackTransaction>
}

export function createPaystack(secretKey: string, fetchImpl: typeof fetch = fetch): PaystackClient {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetchImpl(`${API}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${secretKey}`, 'content-type': 'application/json', accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const body = (await response.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null
    if (!response.ok || !body?.status || body.data === undefined) {
      throw new PaystackError(response.status, body?.message ?? response.statusText)
    }
    return body.data
  }

  return {
    async initialize(input) {
      const data = await request<{ authorization_url: string; access_code: string; reference: string }>('/transaction/initialize', {
        method: 'POST',
        body: JSON.stringify({
          email: input.email,
          amount: input.amount,
          currency: 'NGN',
          reference: input.reference,
          callback_url: input.callbackUrl,
          // `cancel_action` is where the hosted page's "Cancel" goes.
          metadata: { ...input.metadata, cancel_action: input.callbackUrl },
        }),
      })
      return { authorizationUrl: data.authorization_url, accessCode: data.access_code, reference: data.reference }
    },

    verify: (reference) => request<PaystackTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`),
  }
}

/**
 * Paystack signs each webhook with HMAC-SHA512 of the raw body, keyed by the
 * secret key. Anything unsigned or tampered with is refused before it is parsed.
 */
export function hasValidSignature(rawBody: Buffer | string, signature: string | undefined, secretKey: string): boolean {
  if (!signature || !/^[0-9a-f]{128}$/i.test(signature)) return false
  const expected = createHmac('sha512', secretKey).update(rawBody).digest()
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'))
}

/** The order a transaction was opened for. Paystack echoes metadata back as an object, or as JSON text. */
export function orderIdOf(transaction: Pick<PaystackTransaction, 'metadata'>): string | undefined {
  let metadata = transaction.metadata
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata)
    }
    catch {
      return undefined
    }
  }
  const orderId = metadata && typeof metadata === 'object' ? (metadata as { orderId?: unknown }).orderId : undefined
  return typeof orderId === 'string' && orderId ? orderId : undefined
}
