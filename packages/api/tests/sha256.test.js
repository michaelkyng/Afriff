import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { sha256Hex } from '../src/mock/sha256.ts'

describe('mock SHA-256', () => {
  test('matches the platform digest, across block boundaries and for non-ASCII text', () => {
    const texts = ['', 'abc', 'slt_4f2a9c:481902', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(1000), 'Àṣẹ 🎬']
    for (const text of texts) {
      expect(sha256Hex(text)).toBe(createHash('sha256').update(text, 'utf8').digest('hex'))
    }
  })
})
