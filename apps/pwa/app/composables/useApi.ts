import type { AttendeeApi } from '@afriff/api'

/** The attendee API. Pages and stores should use this rather than importing an adapter. */
export function useApi(): AttendeeApi {
  return useNuxtApp().$api
}
