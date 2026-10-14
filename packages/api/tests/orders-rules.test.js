import { describe, expect, test } from 'bun:test'
import {
  assertAvailable,
  attemptReference,
  catalogFrom,
  demandOf,
  paymentChannel,
  paymentFailureReason,
  ticketsFor,
  withoutUndefined,
} from '@afriff/api/orders'
import * as seed from '@afriff/api/seed'

/** The order rules the mock and the Cloud Functions share, tested on their own. */

const catalog = catalogFrom(seed)
const unlimited = { remaining: () => null, seatsLeft: () => 100 }

describe('availability', () => {
  test('counts a product across lines, so splitting it cannot beat the per-order cap', () => {
    const demand = demandOf([
      { productId: 'prod_festival_pass', quantity: 2 },
      { productId: 'prod_festival_pass', quantity: 3 },
    ])
    expect(demand.products.get('prod_festival_pass')).toBe(5)
    expect(() => assertAvailable(demand, catalog, unlimited)).toThrow('Up to 4')
  })

  test('says how many are left, or that it is sold out', () => {
    const demand = demandOf([{ productId: 'prod_festival_pass', quantity: 3 }])
    expect(() => assertAvailable(demand, catalog, { ...unlimited, remaining: () => 2 })).toThrow('Only 2 left')
    expect(() => assertAvailable(demand, catalog, { ...unlimited, remaining: () => 0 })).toThrow('sold out')
  })

  test('counts seats per screening', () => {
    const demand = demandOf([
      { productId: 'prod_screening', quantity: 2, selection: { screeningId: 'scr_x' } },
      { productId: 'prod_screening', quantity: 2, selection: { screeningId: 'scr_x' } },
    ])
    expect(demand.screenings.get('scr_x')).toBe(4)
    expect(() => assertAvailable(demand, catalog, { ...unlimited, seatsLeft: () => 3 })).toThrow('Only 3 seats left')
  })
})

describe('tickets', () => {
  test('one per seat, each with its own id and code, and no undefined fields for Firestore', () => {
    const tickets = ticketsFor(
      { id: 'ord_1', contact: { name: 'Ada Okoye', email: 'ada@example.com' }, lines: [{ id: 'l1', productId: 'prod_festival_pass', productName: 'Festival Pass', kind: 'festival_pass', unitPrice: { amount: 1, currency: 'NGN' }, quantity: 3, title: 'Festival Pass' }] },
      catalog,
    )
    expect(tickets).toHaveLength(3)
    expect(new Set(tickets.map((ticket) => ticket.code)).size).toBe(3)
    for (const ticket of tickets) {
      expect(Object.values(ticket).includes(undefined)).toBe(false)
      expect(ticket).not.toHaveProperty('venueId')
    }
  })

  test('withoutUndefined keeps falsy values that mean something', () => {
    expect(withoutUndefined({ a: 0, b: '', c: null, d: false, e: undefined })).toEqual({ a: 0, b: '', c: null, d: false })
  })
})

describe('payments', () => {
  test('each attempt gets its own reference', () => {
    expect(attemptReference('AF-7KQ2P', 1)).toBe('AF-7KQ2P-1')
    expect(attemptReference('AF-7KQ2P', 2)).toBe('AF-7KQ2P-2')
  })

  test('folds Paystack’s channels into the ones the app shows', () => {
    expect(paymentChannel('card')).toBe('card')
    expect(paymentChannel('dedicated_nuban')).toBe('bank_transfer')
    expect(paymentChannel('ussd')).toBe('ussd')
    expect(paymentChannel('something_new')).toBe('other')
    expect(paymentChannel(undefined)).toBeUndefined()
  })

  test('words a failure so the attendee knows what to do next', () => {
    expect(paymentFailureReason('Declined')).toContain('declined')
    expect(paymentFailureReason('Insufficient Funds')).toContain('not enough money')
    expect(paymentFailureReason('Expired Card')).toContain('expired')
    expect(paymentFailureReason('Token Validation Error')).toContain('did not match')
    expect(paymentFailureReason(undefined)).toContain('Nothing was taken')
  })
})
