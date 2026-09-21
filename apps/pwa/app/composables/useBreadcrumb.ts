/** Title of the current detail page, shown after the section name in the desktop top bar. */
export function useBreadcrumb() {
  return useState<string | null>('app:breadcrumb', () => null)
}

/** Call from a detail page to set its breadcrumb for as long as the page is mounted. */
export function usePageCrumb(title: MaybeRefOrGetter<string | null | undefined>) {
  const crumb = useBreadcrumb()
  watchEffect(() => {
    crumb.value = toValue(title) ?? null
  })
  onBeforeUnmount(() => {
    crumb.value = null
  })
}
