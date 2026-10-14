import { isApiError } from '@afriff/api'

/**
 * Error text per form field, filled from an `ApiError`. The message goes beside
 * the field the error names (by its last part, so "contact.email" lands on
 * `email`), or beside `fallback` when it names none on this form.
 */
export function useFieldErrors<F extends string>(fields: readonly F[]) {
  const errors = reactive({} as Record<F, string>) as Record<F, string>
  for (const field of fields) errors[field] = ''

  function clear() {
    for (const field of fields) errors[field] = ''
  }

  function show(error: unknown, fallback: F, fallbackMessage: string) {
    const named = isApiError(error) ? (String(error.details?.field ?? '').split('.').at(-1) ?? '') : ''
    const field = (fields as readonly string[]).includes(named) ? (named as F) : fallback
    errors[field] = isApiError(error) ? error.message : fallbackMessage
  }

  return { errors, clear, show }
}
