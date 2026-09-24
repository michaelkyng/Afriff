import {
  mergeRefs,
  publishedUpdates,
  refsFromSaved,
  refsFromTickets,
  touches,
  unreadCount,
  urgentForAttendee,
} from '@afriff/api/updates'
import type { FestivalUpdate } from '@afriff/api'

/**
 * Festival updates, as this attendee sees them.
 *
 * The list is public and shared under one key. What changes per attendee is
 * which of them touch something they hold or mean to be at, and which they have
 * already read — both worked out here so the badge, the banner and the inbox
 * never disagree.
 */
export function useUpdates() {
  const api = useApi()
  const inbox = useInboxStore()
  const plan = usePlanStore()
  const { data: festival } = useFestival()
  const { now } = useFestivalClock(festival)
  const { tickets, ensure } = useMyTickets()

  const { data: all } = useLazyAsyncData('updates:all', () => api.updates.list(), {
    default: () => [] as FestivalUpdate[],
    getCachedData: reuseLoaded,
  })

  // The banner needs the tickets, so this is where they get asked for.
  ensure()

  /** Everything the attendee is tied to: what they have bought, and what they saved. */
  const refs = computed(() =>
    mergeRefs(refsFromTickets(tickets.value ?? [], (ticket) => ticket.venueId), refsFromSaved(plan.items)),
  )

  const published = computed(() => publishedUpdates(all.value ?? [], now.value))
  const unread = computed(() => unreadCount(all.value ?? [], inbox.readIds, now.value))
  const isMine = (update: FestivalUpdate) => touches(update.subject, refs.value)

  /**
   * What to interrupt someone with: urgent, theirs, and neither read nor waved
   * away. Only the newest is ever shown.
   */
  const urgent = computed(() =>
    urgentForAttendee(all.value ?? [], refs.value, [...inbox.readIds, ...inbox.dismissedIds], now.value),
  )

  return { all, published, unread, urgent, isMine, inbox }
}
