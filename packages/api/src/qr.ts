/**
 * A QR encoder, byte mode, versions 1 to 40.
 *
 * A ticket has to render its code on a phone with no network and no native
 * bridge, so the encoder ships with the app rather than as a dependency. It
 * follows ISO/IEC 18004: the data is encoded in byte mode, split into
 * Reed-Solomon blocks, interleaved, laid out with the function patterns, and
 * the mask with the lowest penalty wins.
 *
 * Output is a plain grid. Rendering is the caller's business.
 */

export type QrEcLevel = 'L' | 'M' | 'Q' | 'H'

export interface QrCode {
  version: number
  level: QrEcLevel
  /** The mask the encoder settled on, 0 to 7. */
  mask: number
  /** Modules per side, quiet zone not included. */
  size: number
  /** Row-major grid, `modules[row][col]`; true is dark. */
  modules: boolean[][]
}

// ------------------------------------------------------------------ tables

/** Error-correction codewords per block, indexed by level then version. */
const EC_CODEWORDS_PER_BLOCK: Record<QrEcLevel, number[]> = {
  L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
}

/** How many Reed-Solomon blocks the data is split into, indexed by level then version. */
const NUM_ERROR_CORRECTION_BLOCKS: Record<QrEcLevel, number[]> = {
  L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
}

const LEVEL_FORMAT_BITS: Record<QrEcLevel, number> = { L: 1, M: 0, Q: 3, H: 2 }

// ------------------------------------------------------------------ GF(256)

const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)

for (let i = 0, x = 1; i < 255; i += 1) {
  EXP[i] = x
  LOG[x] = i
  x <<= 1
  if (x & 0x100) x ^= 0x11d
}
for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255]!

function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a]! + LOG[b]!]!
}

/** The generator polynomial for `degree` error-correction codewords, highest term first. */
function rsGenerator(degree: number): number[] {
  let poly = [1]
  for (let i = 0; i < degree; i += 1) {
    const next = new Array<number>(poly.length + 1).fill(0)
    for (let j = 0; j < poly.length; j += 1) {
      next[j] = next[j]! ^ gfMul(poly[j]!, 1)
      next[j + 1] = next[j + 1]! ^ gfMul(poly[j]!, EXP[i]!)
    }
    poly = next
  }
  return poly
}

/** The remainder of the data divided by the generator: the block's ECC codewords. */
function rsRemainder(data: number[], degree: number): number[] {
  const generator = rsGenerator(degree)
  const result = new Array<number>(degree).fill(0)
  for (const byte of data) {
    const factor = byte ^ result[0]!
    result.shift()
    result.push(0)
    for (let i = 0; i < degree; i += 1) result[i] = result[i]! ^ gfMul(generator[i + 1]!, factor)
  }
  return result
}

// ------------------------------------------------------------------ helpers

function getBit(value: number, index: number): boolean {
  return ((value >>> index) & 1) !== 0
}

/** Every module that is not a function pattern, in codewords. */
function totalCodewords(version: number): number {
  let modules = (16 * version + 128) * version + 64
  if (version >= 2) {
    const count = Math.floor(version / 7) + 2
    modules -= (25 * count - 10) * count - 55
    if (version >= 7) modules -= 36
  }
  return Math.floor(modules / 8)
}

function dataCodewords(version: number, level: QrEcLevel): number {
  return (
    totalCodewords(version)
    - EC_CODEWORDS_PER_BLOCK[level][version - 1]! * NUM_ERROR_CORRECTION_BLOCKS[level][version - 1]!
  )
}

/** Centres of the alignment patterns, which also decide how many there are. */
function alignmentPositions(version: number): number[] {
  if (version === 1) return []
  const count = Math.floor(version / 7) + 2
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2
  const positions = [6]
  for (let pos = version * 4 + 10; positions.length < count; pos -= step) positions.splice(1, 0, pos)
  return positions
}

function toUtf8(text: string): number[] {
  if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(text))
  return Array.from(unescape(encodeURIComponent(text)), (char) => char.charCodeAt(0))
}

// ------------------------------------------------------------------ encoder

class Grid {
  readonly size: number
  readonly modules: boolean[][]
  /** Function patterns are never masked and never carry data. */
  readonly isFunction: boolean[][]

  constructor(readonly version: number) {
    this.size = version * 4 + 17
    this.modules = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false))
    this.isFunction = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false))
  }

  /** `x` is the column and `y` the row, as the specification numbers them. */
  private setFunction(x: number, y: number, dark: boolean) {
    this.modules[y]![x] = dark
    this.isFunction[y]![x] = true
  }

  drawFunctionPatterns(level: QrEcLevel) {
    for (let i = 0; i < this.size; i += 1) {
      this.setFunction(6, i, i % 2 === 0)
      this.setFunction(i, 6, i % 2 === 0)
    }

    this.drawFinder(3, 3)
    this.drawFinder(this.size - 4, 3)
    this.drawFinder(3, this.size - 4)

    const positions = alignmentPositions(this.version)
    for (let i = 0; i < positions.length; i += 1) {
      for (let j = 0; j < positions.length; j += 1) {
        // The three corners belong to the finder patterns.
        const corner = (i === 0 && j === 0)
          || (i === 0 && j === positions.length - 1)
          || (i === positions.length - 1 && j === 0)
        if (!corner) this.drawAlignment(positions[i]!, positions[j]!)
      }
    }

    // Reserved now, written once the mask is known.
    this.drawFormatBits(level, 0)
    this.drawVersion()
  }

  private drawFinder(x: number, y: number) {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy))
        const px = x + dx
        const py = y + dy
        if (px >= 0 && px < this.size && py >= 0 && py < this.size) {
          this.setFunction(px, py, distance !== 2 && distance !== 4)
        }
      }
    }
  }

  private drawAlignment(x: number, y: number) {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        this.setFunction(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
      }
    }
  }

  drawFormatBits(level: QrEcLevel, mask: number) {
    const data = (LEVEL_FORMAT_BITS[level] << 3) | mask
    let remainder = data
    for (let i = 0; i < 10; i += 1) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537)
    const bits = ((data << 10) | remainder) ^ 0x5412

    for (let i = 0; i <= 5; i += 1) this.setFunction(8, i, getBit(bits, i))
    this.setFunction(8, 7, getBit(bits, 6))
    this.setFunction(8, 8, getBit(bits, 7))
    this.setFunction(7, 8, getBit(bits, 8))
    for (let i = 9; i < 15; i += 1) this.setFunction(14 - i, 8, getBit(bits, i))

    for (let i = 0; i < 8; i += 1) this.setFunction(this.size - 1 - i, 8, getBit(bits, i))
    for (let i = 8; i < 15; i += 1) this.setFunction(8, this.size - 15 + i, getBit(bits, i))
    this.setFunction(8, this.size - 8, true)
  }

  private drawVersion() {
    if (this.version < 7) return
    let remainder = this.version
    for (let i = 0; i < 12; i += 1) remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25)
    const bits = (this.version << 12) | remainder

    for (let i = 0; i < 18; i += 1) {
      const dark = getBit(bits, i)
      const a = this.size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      this.setFunction(a, b, dark)
      this.setFunction(b, a, dark)
    }
  }

  /** Lays the codewords out in the zigzag the specification describes. */
  drawCodewords(data: number[]) {
    let index = 0
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5
      for (let vertical = 0; vertical < this.size; vertical += 1) {
        for (let j = 0; j < 2; j += 1) {
          const x = right - j
          const upward = ((right + 1) & 2) === 0
          const y = upward ? this.size - 1 - vertical : vertical
          if (!this.isFunction[y]![x] && index < data.length * 8) {
            this.modules[y]![x] = getBit(data[index >>> 3]!, 7 - (index & 7))
            index += 1
          }
        }
      }
    }
  }

  applyMask(mask: number) {
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        if (this.isFunction[y]![x]) continue
        let invert: boolean
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break
          case 1: invert = y % 2 === 0; break
          case 2: invert = x % 3 === 0; break
          case 3: invert = (x + y) % 3 === 0; break
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break
          default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break
        }
        if (invert) this.modules[y]![x] = !this.modules[y]![x]
      }
    }
  }

  /** The four penalty rules. The lowest score picks the mask. */
  penalty(): number {
    let score = 0
    const { size, modules } = this

    // Rule 1: runs of five or more.
    for (let i = 0; i < size; i += 1) {
      for (const line of [modules[i]!, modules.map((row) => row[i]!)]) {
        let run = 1
        for (let j = 1; j < size; j += 1) {
          if (line[j] === line[j - 1]) {
            run += 1
            if (run === 5) score += 3
            else if (run > 5) score += 1
          }
          else run = 1
        }
      }
    }

    // Rule 2: two-by-two blocks of one colour.
    for (let y = 0; y < size - 1; y += 1) {
      for (let x = 0; x < size - 1; x += 1) {
        const first = modules[y]![x]
        if (first === modules[y]![x + 1] && first === modules[y + 1]![x] && first === modules[y + 1]![x + 1]) {
          score += 3
        }
      }
    }

    // Rule 3: anything that reads like a finder pattern.
    const forward = [true, false, true, true, true, false, true, false, false, false, false]
    const backward = [...forward].reverse()
    for (let i = 0; i < size; i += 1) {
      const row = modules[i]!
      const column = modules.map((line) => line[i]!)
      for (const line of [row, column]) {
        for (let j = 0; j + 11 <= size; j += 1) {
          const window = line.slice(j, j + 11)
          if (window.every((value, k) => value === forward[k])) score += 40
          if (window.every((value, k) => value === backward[k])) score += 40
        }
      }
    }

    // Rule 4: how far the balance of dark to light is from even.
    let dark = 0
    for (const row of modules) for (const module of row) if (module) dark += 1
    const total = size * size
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1
    score += Math.max(0, k) * 10

    return score
  }
}

/** The bit stream for one message: header, data, terminator and padding. */
function buildCodewords(bytes: number[], version: number, level: QrEcLevel): number[] {
  const capacity = dataCodewords(version, level) * 8
  const countBits = version < 10 ? 8 : 16
  const bits: boolean[] = []
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push(getBit(value, i))
  }

  push(0b0100, 4)
  push(bytes.length, countBits)
  for (const byte of bytes) push(byte, 8)

  push(0, Math.min(4, capacity - bits.length))
  push(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8)

  const codewords: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | (bits[i + j] ? 1 : 0)
    codewords.push(byte)
  }
  return codewords
}

/** Splits the data into blocks, adds error correction, and interleaves the lot. */
function interleave(data: number[], version: number, level: QrEcLevel): number[] {
  const blockCount = NUM_ERROR_CORRECTION_BLOCKS[level][version - 1]!
  const ecLength = EC_CODEWORDS_PER_BLOCK[level][version - 1]!
  const total = totalCodewords(version)
  const shortBlockLength = Math.floor(total / blockCount) - ecLength
  const longBlockCount = total % blockCount

  const blocks: { data: number[]; ec: number[] }[] = []
  for (let i = 0, offset = 0; i < blockCount; i += 1) {
    const length = shortBlockLength + (i < blockCount - longBlockCount ? 0 : 1)
    const chunk = data.slice(offset, offset + length)
    offset += length
    blocks.push({ data: chunk, ec: rsRemainder(chunk, ecLength) })
  }

  const result: number[] = []
  for (let i = 0; i < shortBlockLength + 1; i += 1) {
    for (const block of blocks) if (i < block.data.length) result.push(block.data[i]!)
  }
  for (let i = 0; i < ecLength; i += 1) {
    for (const block of blocks) result.push(block.ec[i]!)
  }
  return result
}

export interface QrOptions {
  /** Error correction. M is the sensible default for a screen. */
  level?: QrEcLevel
  /** Force a version instead of taking the smallest one that fits. */
  version?: number
  /** Force a mask instead of the lowest-penalty one. */
  mask?: number
}

/**
 * Encodes text as a QR code.
 *
 * @throws when the text does not fit any version at the chosen level.
 */
export function encodeQr(text: string, options: QrOptions = {}): QrCode {
  const level = options.level ?? 'M'
  const bytes = toUtf8(text)

  let version = options.version ?? 0
  if (!version) {
    for (let candidate = 1; candidate <= 40; candidate += 1) {
      const countBits = candidate < 10 ? 8 : 16
      if (dataCodewords(candidate, level) * 8 >= 4 + countBits + bytes.length * 8) {
        version = candidate
        break
      }
    }
  }
  if (!version) throw new Error('That is too much data for one QR code.')

  const codewords = interleave(buildCodewords(bytes, version, level), version, level)

  let best: Grid | null = null
  let bestMask = 0
  let bestPenalty = Number.POSITIVE_INFINITY
  const masks = options.mask === undefined ? [0, 1, 2, 3, 4, 5, 6, 7] : [options.mask]

  for (const mask of masks) {
    const grid = new Grid(version)
    grid.drawFunctionPatterns(level)
    grid.drawCodewords(codewords)
    grid.applyMask(mask)
    grid.drawFormatBits(level, mask)
    const penalty = grid.penalty()
    if (penalty < bestPenalty) {
      best = grid
      bestMask = mask
      bestPenalty = penalty
    }
  }

  const grid = best!
  return { version, level, mask: bestMask, size: grid.size, modules: grid.modules }
}

/**
 * The dark modules as one SVG path, in a viewBox of `size + quietZone * 2`.
 * One path draws faster and scales more cleanly than a rectangle per module.
 */
export function qrPath(code: QrCode, quietZone = 4): { extent: number; path: string } {
  const parts: string[] = []
  for (let y = 0; y < code.size; y += 1) {
    const row = code.modules[y]!
    let x = 0
    while (x < code.size) {
      if (!row[x]) {
        x += 1
        continue
      }
      let run = 1
      while (x + run < code.size && row[x + run]) run += 1
      parts.push(`M${x + quietZone} ${y + quietZone}h${run}v1h-${run}z`)
      x += run
    }
  }
  return { extent: code.size + quietZone * 2, path: parts.join('') }
}
