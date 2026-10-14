import { createHmac } from 'node:crypto'
import { describe, expect, test } from 'bun:test'
import { createPaystack, hasValidSignature, orderIdOf, PaystackError } from '../src/paystack.ts'

const SECRET = 'sk_test_example'

/** A fetch that records what it was asked and answers with the given body. */
function fakeFetch(body, status = 200) {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : undefined })
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  }
  return { fetchImpl, calls }
}

describe('webhook signatures', () => {
  const body = JSON.stringify({ event: 'charge.success', data: { reference: 'AF-7KQ2P-1' } })
  const sign = (payload, key = SECRET) => createHmac('sha512', key).update(payload).digest('hex')

  test('accepts the HMAC-SHA512 of the raw body, keyed by the secret key', () => {
    expect(hasValidSignature(body, sign(body), SECRET)).toBe(true)
    expect(hasValidSignature(Buffer.from(body), sign(body).toUpperCase(), SECRET)).toBe(true)
  })

  test('refuses a missing, malformed, tampered or wrongly keyed signature', () => {
    expect(hasValidSignature(body, undefined, SECRET)).toBe(false)
    expect(hasValidSignature(body, 'abc', SECRET)).toBe(false)
    expect(hasValidSignature(body, sign(body).replace(/^./, 'z'), SECRET)).toBe(false)
    expect(hasValidSignature(body.replace('AF-7KQ2P-1', 'AF-XXXXX-1'), sign(body), SECRET)).toBe(false)
    expect(hasValidSignature(body, sign(body, 'sk_test_other'), SECRET)).toBe(false)
  })
})

describe('the order a transaction belongs to', () => {
  test('is read from metadata, whether Paystack sends it as an object or as JSON text', () => {
    expect(orderIdOf({ metadata: { orderId: 'ord_1' } })).toBe('ord_1')
    expect(orderIdOf({ metadata: '{"orderId":"ord_2"}' })).toBe('ord_2')
  })

  test('is unknown when the metadata is missing or not ours', () => {
    for (const metadata of [undefined, '', 'not json', { orderId: 42 }, { other: 'x' }, null]) {
      expect(orderIdOf({ metadata })).toBeUndefined()
    }
  })
})

describe('the Paystack client', () => {
  test('opens a transaction in kobo and naira, with the order in the metadata', async () => {
    const { fetchImpl, calls } = fakeFetch({
      status: true,
      data: { authorization_url: 'https://checkout.paystack.com/abc', access_code: 'abc', reference: 'AF-7KQ2P-1' },
    })
    const opened = await createPaystack(SECRET, fetchImpl).initialize({
      email: 'ada@example.com',
      amount: 75_000_00,
      reference: 'AF-7KQ2P-1',
      callbackUrl: 'https://app.example.com/orders/ord_1',
      metadata: { orderId: 'ord_1', userId: 'usr_1' },
    })

    expect(opened).toEqual({ authorizationUrl: 'https://checkout.paystack.com/abc', accessCode: 'abc', reference: 'AF-7KQ2P-1' })
    expect(calls[0].url).toBe('https://api.paystack.co/transaction/initialize')
    expect(calls[0].init.method).toBe('POST')
    expect(calls[0].init.headers.authorization).toBe(`Bearer ${SECRET}`)
    expect(calls[0].body).toEqual({
      email: 'ada@example.com',
      amount: 75_000_00,
      currency: 'NGN',
      reference: 'AF-7KQ2P-1',
      callback_url: 'https://app.example.com/orders/ord_1',
      metadata: { orderId: 'ord_1', userId: 'usr_1', cancel_action: 'https://app.example.com/orders/ord_1' },
    })
  })

  test('verifies by reference, escaping it in the path', async () => {
    const { fetchImpl, calls } = fakeFetch({ status: true, data: { reference: 'AF/1', status: 'success', amount: 100, currency: 'NGN' } })
    const transaction = await createPaystack(SECRET, fetchImpl).verify('AF/1')
    expect(transaction.status).toBe('success')
    expect(calls[0].url).toBe('https://api.paystack.co/transaction/verify/AF%2F1')
  })

  test('turns a refusal into a PaystackError with Paystack’s message', async () => {
    const { fetchImpl } = fakeFetch({ status: false, message: 'Transaction reference not found' }, 400)
    const error = await createPaystack(SECRET, fetchImpl).verify('nope').catch((caught) => caught)
    expect(error).toBeInstanceOf(PaystackError)
    expect(error).toMatchObject({ status: 400, message: 'Transaction reference not found' })
  })
})
