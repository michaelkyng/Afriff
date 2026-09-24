/**
 * Which updates have been read, kept on this device under `afriff:inbox`.
 *
 * Not on the account: updates are public festival news, and "I have seen this"
 * is about the screen in your hand. It also means the badge is honest for
 * someone who never signs in.
 */
export const useInboxStore = defineStore(
  'inbox',
  () => {
    const readIds = ref<string[]>([])
    /** Urgent updates the attendee has dismissed from the banner but not opened. */
    const dismissedIds = ref<string[]>([])

    const isRead = (id: string) => readIds.value.includes(id)
    const isDismissed = (id: string) => dismissedIds.value.includes(id)

    function markRead(id: string) {
      if (!isRead(id)) readIds.value = [...readIds.value, id]
    }

    function markAllRead(ids: string[]) {
      const next = new Set(readIds.value)
      ids.forEach((id) => next.add(id))
      readIds.value = [...next]
    }

    function dismiss(id: string) {
      if (!isDismissed(id)) dismissedIds.value = [...dismissedIds.value, id]
    }

    function reset() {
      readIds.value = []
      dismissedIds.value = []
    }

    return { readIds, dismissedIds, isRead, isDismissed, markRead, markAllRead, dismiss, reset }
  },
  { persist: true },
)
