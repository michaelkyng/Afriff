import type { ThemeMode } from '~/stores/prefs'

export type ResolvedTheme = 'dark' | 'light'

export const THEME_COLORS: Record<ResolvedTheme, string> = {
  dark: '#060A26',
  light: '#F6F6F9',
}

/** Resolves the saved theme preference ("system" follows the OS) to dark or light. */
export function useTheme() {
  const prefs = usePrefsStore()
  const scheme = usePreferredColorScheme()

  const resolved = computed<ResolvedTheme>(() => {
    if (prefs.theme === 'system') return scheme.value === 'light' ? 'light' : 'dark'
    return prefs.theme
  })

  const mode = computed<ThemeMode>({
    get: () => prefs.theme,
    set: (value) => prefs.setTheme(value),
  })

  return { mode, resolved }
}
