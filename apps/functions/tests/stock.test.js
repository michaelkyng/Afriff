import { describe, expect, test } from 'bun:test'
import { stockLevels } from '../src/stock.ts'

describe('stock levels read in a transaction', () => {
  const stock = stockLevels(
    new Map([
      ['prod_festival_pass', { remaining: 12 }],
      ['prod_screening', { remaining: null }],
      ['prod_gone', undefined],
    ]),
    new Map([
      ['scn_1', { capacity: 120, sold: 100 }],
      ['scn_over', { capacity: 10, sold: 12 }],
    ]),
  )

  test('an unlimited product stays unlimited (a regression: it once read as sold out)', () => {
    expect(stock.remaining('prod_screening')).toBeNull()
  })

  test('a limited product says how many are left; a missing one has none', () => {
    expect(stock.remaining('prod_festival_pass')).toBe(12)
    expect(stock.remaining('prod_gone')).toBe(0)
    expect(stock.remaining('prod_never_read')).toBe(0)
  })

  test('seats left at a screening, never below none', () => {
    expect(stock.seatsLeft('scn_1')).toBe(20)
    expect(stock.seatsLeft('scn_over')).toBe(0)
    expect(stock.seatsLeft('scn_unknown')).toBe(0)
  })
})
