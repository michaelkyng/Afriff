import { isApiError } from '@afriff/api'
import { planKey } from '@afriff/api/plan'
import type { SavedInput, SavedItem, SavedKind } from '@afriff/api'

/**
 * What the attendee has put aside.
 *
 * Saving works signed out, because deciding what to see comes before making an
 * account. The list lives on the device under `afriff:plan` either way; once
 * there is an account it is also the account's, and whatever the device saved
 * first is folded in at sign-in. Every change is applied here straight away and
 * sent afterwards, so the star fills in the moment it is pressed.
 */
export const usePlanStore = defineStore(
  'plan',
  () => {
    const items = ref<SavedItem[]>([])
    /** True while the device list and the account's are being reconciled. */
    const syncing = ref(false)

    const films = computed(() => items.value.filter((item) => item.kind === 'film'))
    const count = computed(() => items.value.length)
    const keys = computed(() => new Set(items.value.map((item) => `${item.kind}:${item.refId}`)))

    /** Screenings and events, as the keys `buildPlan` uses. */
    const slotKeys = computed(
      () =>
        new Set(
          items.value
            .filter((item) => item.kind !== 'film')
            .map((item) => planKey(item.kind as 'screening' | 'event', item.refId)),
        ),
    )

    function has(kind: SavedKind, refId: string): boolean {
      return keys.value.has(`${kind}:${refId}`)
    }

    function apply(list: SavedItem[]) {
      items.value = [...list].sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    }

    /** Called after any failed write, so the screen never keeps a change the account refused. */
    async function reload() {
      const { isSignedIn } = useAuth()
      if (!isSignedIn.value) return
      try {
        apply(await useApi().saved.list())
      }
      catch {
        // Offline or signed out mid-flight: the device copy stands.
      }
    }

    async function add(kind: SavedKind, refId: string) {
      if (has(kind, refId)) return
      items.value = [{ kind, refId, savedAt: new Date().toISOString() }, ...items.value]
      const { isSignedIn } = useAuth()
      if (!isSignedIn.value) return
      try {
        apply(await useApi().saved.add({ kind, refId }))
      }
      catch (error) {
        if (isApiError(error) && (error.code === 'not_found' || error.code === 'conflict')) {
          items.value = items.value.filter((item) => !(item.kind === kind && item.refId === refId))
          throw error
        }
        await reload()
      }
    }

    async function remove(kind: SavedKind, refId: string) {
      items.value = items.value.filter((item) => !(item.kind === kind && item.refId === refId))
      const { isSignedIn } = useAuth()
      if (!isSignedIn.value) return
      try {
        apply(await useApi().saved.remove({ kind, refId }))
      }
      catch {
        await reload()
      }
    }

    /** Returns true when the thing is now saved, so a button can say what happened. */
    async function toggle(kind: SavedKind, refId: string): Promise<boolean> {
      if (has(kind, refId)) {
        await remove(kind, refId)
        return false
      }
      await add(kind, refId)
      return true
    }

    /**
     * Brings the device list and the account's together. Called on sign-in and
     * on start-up: anything saved while signed out is kept, and the account's
     * list becomes the one on screen.
     */
    async function sync() {
      const { isSignedIn } = useAuth()
      if (!isSignedIn.value || syncing.value) return
      syncing.value = true
      try {
        const api = useApi()
        const pending: SavedInput[] = items.value.map(({ kind, refId }) => ({ kind, refId }))
        apply(pending.length ? await api.saved.merge(pending) : await api.saved.list())
      }
      catch {
        // Leave the device copy alone; the next sync tries again.
      }
      finally {
        syncing.value = false
      }
    }

    /** Signing out leaves the account's plan with the account, not on the device. */
    function clear() {
      items.value = []
    }

    return { items, syncing, films, count, keys, slotKeys, has, add, remove, toggle, sync, clear }
  },
  // Only the list is kept. `syncing` is about this page load, and persisting a
  // true would leave every later sync thinking one was already in flight.
  { persist: { pick: ['items'] } },
)
