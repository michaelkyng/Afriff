export type ThemeMode = 'system' | 'dark' | 'light'

/**
 * Device-level preferences, persisted to localStorage under `afriff:prefs`.
 * The pre-paint script in nuxt.config reads `theme` from the same key.
 */
export const usePrefsStore = defineStore(
  'prefs',
  () => {
    const theme = ref<ThemeMode>('system')
    /** Dev-only clock override (ISO string) for previewing festival-week states. */
    const devNow = ref<string | null>(null)

    function setTheme(mode: ThemeMode) {
      theme.value = mode
    }

    function setDevNow(value: string | null) {
      devNow.value = value
    }

    return { theme, devNow, setTheme, setDevNow }
  },
  { persist: true },
)
