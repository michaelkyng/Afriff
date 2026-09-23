import { savedItemSchema, savedMergeSchema } from '@afriff/validation'
import { ApiError } from '../contract'
import type { AttendeeApi } from '../contract'
import type { SavedInput, SavedItem, SavedKind, User } from '../types'
import { mockDb } from './db'
import * as seed from './seed'

/**
 * What an attendee has put aside, for the mock API.
 *
 * One list per account covering all three kinds, because that is how the screen
 * uses it: My festival needs the saved screenings and events together, and the
 * watchlist is the film entries out of the same list.
 */

type StoredItem = SavedItem & { userId: string }

const LIMIT = 200

/** Every kind points at something in the programme; a stale id is rejected. */
function assertExists(kind: SavedKind, refId: string) {
  const found = kind === 'film'
    ? seed.films.some((film) => film.id === refId)
    : kind === 'screening'
      ? seed.screenings.some((screening) => screening.id === refId)
      : seed.events.some((event) => event.id === refId)
  if (!found) throw new ApiError('not_found', 'That is no longer in the programme.', { kind, refId })
}

function parse(input: SavedInput): { kind: SavedKind; refId: string } {
  const parsed = savedItemSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new ApiError('validation', first?.message ?? 'We could not save that.', { field: first?.path.join('.') })
  }
  assertExists(parsed.data.kind, parsed.data.refId)
  return parsed.data
}

export function createMockSaved(
  respond: <T>(produce: () => T | Promise<T>) => Promise<T>,
  requireUser: () => User,
): AttendeeApi['saved'] {
  const items: StoredItem[] = mockDb.read<StoredItem[]>('saved', [])
  const persist = () => mockDb.write('saved', items)

  /**
   * Newest first: the watchlist reads as a pile, most recent on top. Two saved
   * in the same millisecond fall back on the order they arrived, since the sort
   * is stable and the list is reversed before it runs.
   */
  const listFor = (userId: string): SavedItem[] =>
    items
      .filter((item) => item.userId === userId)
      .reverse()
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
      .map(({ userId: _userId, ...item }) => item)

  const held = (userId: string, kind: SavedKind, refId: string) =>
    items.find((item) => item.userId === userId && item.kind === kind && item.refId === refId)

  function put(userId: string, kind: SavedKind, refId: string) {
    if (held(userId, kind, refId)) return
    if (items.filter((item) => item.userId === userId).length >= LIMIT) {
      throw new ApiError('conflict', 'That is as much as one plan can hold.', { limit: LIMIT })
    }
    items.push({ userId, kind, refId, savedAt: new Date().toISOString() })
  }

  return {
    list: () => respond(() => listFor(requireUser().id)),

    add: (input: SavedInput) =>
      respond(() => {
        const user = requireUser()
        const { kind, refId } = parse(input)
        put(user.id, kind, refId)
        persist()
        return listFor(user.id)
      }),

    remove: (input: SavedInput) =>
      respond(() => {
        const user = requireUser()
        const parsed = savedItemSchema.safeParse(input)
        if (!parsed.success) throw new ApiError('validation', 'We could not remove that.')
        const index = items.findIndex(
          (item) => item.userId === user.id && item.kind === parsed.data.kind && item.refId === parsed.data.refId,
        )
        if (index >= 0) items.splice(index, 1)
        persist()
        return listFor(user.id)
      }),

    merge: (inputs: SavedInput[]) =>
      respond(() => {
        const user = requireUser()
        const parsed = savedMergeSchema.safeParse(inputs)
        if (!parsed.success) throw new ApiError('validation', 'We could not take that list.')
        // Anything the programme has dropped is skipped rather than failing the merge.
        for (const { kind, refId } of parsed.data) {
          try {
            assertExists(kind, refId)
          }
          catch {
            continue
          }
          put(user.id, kind, refId)
        }
        persist()
        return listFor(user.id)
      }),
  }
}
