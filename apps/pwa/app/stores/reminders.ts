/**
 * Reminders for what is on the plan, kept on this device under `afriff:reminders`.
 *
 * Not on the account: a notification is a property of the phone in your pocket,
 * not of who you are. Until there is a backend to push them, they are local
 * timers, so they only fire while the app is open. F7 replaces the mechanism,
 * not the setting.
 */
export const useRemindersStore = defineStore(
  'reminders',
  () => {
    /** Plan keys (`screening:scn_x`) the attendee wants a nudge for. */
    const keys = ref<string[]>([])
    /** How long before the start, in minutes. */
    const leadMinutes = ref(30)

    const count = computed(() => keys.value.length)
    const has = (key: string) => keys.value.includes(key)

    function toggle(key: string): boolean {
      if (has(key)) {
        keys.value = keys.value.filter((item) => item !== key)
        return false
      }
      keys.value = [...keys.value, key]
      return true
    }

    /** Drops reminders for slots that are no longer on the plan. */
    function prune(live: Set<string>) {
      const next = keys.value.filter((key) => live.has(key))
      if (next.length !== keys.value.length) keys.value = next
    }

    return { keys, leadMinutes, count, has, toggle, prune }
  },
  { persist: true },
)
