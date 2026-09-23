/**
 * A tiny localStorage-backed "database" for the mock API.
 *
 * Only the mock adapter uses this — it plays the role of the server's storage
 * for things attendees create (accounts, orders, tickets). It is deleted when
 * the real backend arrives. Read-only seed data never goes in here.
 */

const PREFIX = 'afriff:mockdb:'
/** Bump when stored shapes change; older data is discarded. */
const SCHEMA_VERSION = 2

interface Envelope<T> {
  v: number
  data: T
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  }
  catch {
    return null
  }
}

export const mockDb = {
  read<T>(collection: string, fallback: T): T {
    const raw = storage()?.getItem(PREFIX + collection)
    if (!raw) return fallback
    try {
      const parsed = JSON.parse(raw) as Envelope<T>
      return parsed.v === SCHEMA_VERSION ? parsed.data : fallback
    }
    catch {
      return fallback
    }
  },

  write<T>(collection: string, data: T): void {
    const envelope: Envelope<T> = { v: SCHEMA_VERSION, data }
    try {
      storage()?.setItem(PREFIX + collection, JSON.stringify(envelope))
    }
    catch (error) {
      console.warn('[mockDb] write failed', collection, error)
    }
  },

  /** Wipe everything the mock "server" has stored. */
  reset(): void {
    const store = storage()
    if (!store) return
    Object.keys(store)
      .filter((key) => key.startsWith(PREFIX))
      .forEach((key) => store.removeItem(key))
  },
}
