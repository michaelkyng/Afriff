import { describe, expect, test } from 'bun:test'
import { fromLagosInput, toLagosInput } from '../app/utils/labels.ts'

describe('date-time fields in Lagos time', () => {
  test('a field value is read as Lagos time, whatever the device’s zone', () => {
    expect(fromLagosInput('2026-11-03T21:00')).toBe('2026-11-03T21:00:00+01:00')
    expect(Date.parse(fromLagosInput('2026-11-03T21:00'))).toBe(Date.parse('2026-11-03T20:00:00Z'))
  })

  test('an instant is shown in Lagos time, and survives the round trip', () => {
    expect(toLagosInput('2026-11-03T17:30:00Z')).toBe('2026-11-03T18:30')
    expect(toLagosInput(fromLagosInput('2026-11-07T23:45'))).toBe('2026-11-07T23:45')
  })
})
