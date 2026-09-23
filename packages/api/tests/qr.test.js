import { describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { encodeQr, qrPath } from '../src/qr.ts'

/**
 * The encoder is checked against symbols produced by a reference implementation
 * (the `qrcode` Python library, which follows ISO/IEC 18004). Full matrices
 * would drown the file, so each expectation is a digest of one; the version one
 * symbol below is written out in full so a human can read a real example.
 */

const TEXTS = {
  payload: 'AFRIFF1|tkt_9x2k4m8q|AF-7KQ2-P4NR|2026-11-03T18:30:00+01:00',
  short: 'a',
  unicode: 'Salt Roads — Landmark ★ 18:30',
  medium: 'x'.repeat(100),
  long: 'AFRIFF '.repeat(40),
  huge: 'z'.repeat(1000),
}

/** [text, level, mask, expected version, first 16 hex of the matrix digest] */
const REFERENCE = [
  ['payload', 'L', 0, 4, '98852530f37eba66'],
  ['payload', 'M', 0, 4, '2535d93385b5cddc'],
  ['payload', 'Q', 0, 5, 'f6d422a80c24a662'],
  ['payload', 'H', 0, 7, '51dbb094431bd6e0'],
  ['short', 'L', 0, 1, 'bf35b1e154e92eb4'],
  ['short', 'M', 0, 1, 'ad65f877bf9411d1'],
  ['short', 'Q', 0, 1, 'ecb9176b4e9b6282'],
  ['short', 'H', 0, 1, '2ade26a3126ff85b'],
  ['unicode', 'L', 0, 3, '1950f9471043d1a6'],
  ['unicode', 'M', 0, 3, '73f043cd173ea985'],
  ['unicode', 'Q', 0, 4, '712cad2eb8f61624'],
  ['unicode', 'H', 0, 4, 'e25b2bf552702d33'],
  ['medium', 'L', 0, 5, '8329f9290d7ddd42'],
  ['medium', 'M', 0, 6, '898a791db8daf879'],
  ['medium', 'Q', 0, 8, 'd727cbf84d36ca1d'],
  ['medium', 'H', 0, 10, '178489a5d151e515'],
  ['long', 'L', 0, 11, '8db0cd72988c05b2'],
  ['long', 'M', 0, 12, '59d9e47d7f9f4db8'],
  ['long', 'Q', 0, 15, 'f972826f4217bdd5'],
  ['long', 'H', 0, 17, '979899a01b34502b'],
  ['huge', 'L', 0, 22, '5a56e81f18b28d2e'],
  ['huge', 'M', 0, 26, '107688e8568fc6ba'],
  ['huge', 'Q', 0, 31, '2b7bcf83a1970beb'],
  ['huge', 'H', 0, 36, '37edad8275330d34'],
  ['payload', 'Q', 1, 5, '1411298e673194bb'],
  ['payload', 'Q', 2, 5, 'ecc0690b08b70ad1'],
  ['payload', 'Q', 3, 5, '266d1d4ddb18afab'],
  ['payload', 'Q', 4, 5, 'a23dd7aceeaeae3c'],
  ['payload', 'Q', 5, 5, '56567b5f57d377f5'],
  ['payload', 'Q', 6, 5, '2c3e26ada77bf957'],
  ['payload', 'Q', 7, 5, 'b1865a361305ab9b'],
]

/** "AFRIFF" at version 1, level M, mask 2, as the reference draws it. */
const AFRIFF_V1_M2 = [
  '111111100101101111111',
  '100000100100001000001',
  '101110101011001011101',
  '101110101100101011101',
  '101110101101101011101',
  '100000101000101000001',
  '111111101010101111111',
  '000000001101100000000',
  '101111100110101111100',
  '011001000010100101100',
  '010000111001010010010',
  '111001010110000111110',
  '011010111111010011100',
  '000000001011111100100',
  '111111100000101100010',
  '100000101111111111101',
  '101110101100100000110',
  '101110101110100100000',
  '101110101001010001100',
  '100000100100000111100',
  '111111101001010000110',
]

const render = (code) => code.modules.map((row) => row.map((module) => (module ? '1' : '0')).join(''))
const digest = (code) => createHash('sha256').update(render(code).join('\n')).digest('hex').slice(0, 16)

describe('encodeQr', () => {
  it('draws the same symbol as the reference implementation', () => {
    for (const [name, level, mask, version, expected] of REFERENCE) {
      const code = encodeQr(TEXTS[name], { level, mask })
      expect(`${name}/${level}/${mask}: v${code.version} ${digest(code)}`).toBe(
        `${name}/${level}/${mask}: v${version} ${expected}`,
      )
    }
  })

  it('matches a written-out symbol module for module', () => {
    const code = encodeQr('AFRIFF', { level: 'M', version: 1, mask: 2 })
    expect(render(code)).toEqual(AFRIFF_V1_M2)
  })

  it('takes the smallest version the data fits into', () => {
    expect(encodeQr('a', { level: 'L' }).version).toBe(1)
    // 17 bytes is the whole of version 1 at level L; one more needs version 2.
    expect(encodeQr('a'.repeat(17), { level: 'L' }).version).toBe(1)
    expect(encodeQr('a'.repeat(18), { level: 'L' }).version).toBe(2)
  })

  it('picks a mask by penalty, and honours one that is given', () => {
    const chosen = encodeQr(TEXTS.payload, { level: 'M' })
    expect(chosen.mask).toBeGreaterThanOrEqual(0)
    expect(chosen.mask).toBeLessThanOrEqual(7)
    expect(digest(chosen)).toBe(digest(encodeQr(TEXTS.payload, { level: 'M', mask: chosen.mask })))
  })

  it('keeps the function patterns where a scanner looks for them', () => {
    const code = encodeQr(TEXTS.payload)
    const dark = (row, col) => code.modules[row][col]
    for (const [top, left] of [[0, 0], [0, code.size - 7], [code.size - 7, 0]]) {
      expect(dark(top, left)).toBe(true)
      expect(dark(top + 1, left + 1)).toBe(false)
      expect(dark(top + 3, left + 3)).toBe(true)
      expect(dark(top + 6, left + 6)).toBe(true)
    }
    // Timing patterns alternate from the sixth row and column.
    for (let i = 8; i < code.size - 8; i += 1) {
      expect(code.modules[6][i]).toBe(i % 2 === 0)
      expect(code.modules[i][6]).toBe(i % 2 === 0)
    }
  })

  it('refuses data that no version can hold', () => {
    expect(() => encodeQr('z'.repeat(3000), { level: 'H' })).toThrow()
  })
})

describe('qrPath', () => {
  it('draws every dark module once, inside the quiet zone', () => {
    const code = encodeQr('AFRIFF', { level: 'M', version: 1, mask: 2 })
    const { extent, path } = qrPath(code, 4)
    expect(extent).toBe(code.size + 8)
    const drawn = [...path.matchAll(/h(\d+)/g)].reduce((sum, match) => sum + Number(match[1]), 0)
    const expected = code.modules.flat().filter(Boolean).length
    expect(drawn).toBe(expected)
    expect(path.startsWith('M')).toBe(true)
  })
})
