<script setup lang="ts">
import { DownloadIcon, MonitorIcon, MoonIcon, SunIcon, UserRoundIcon } from 'lucide-vue-next'
import type { ThemeMode } from '~/stores/prefs'

/**
 * Desktop app navigation. Icon rail on tablets (md), full sidebar on laptops (lg+).
 * Phones use AppHeader + AppTabBar instead.
 */
const route = useRoute()
const { data: festival } = useFestival()
const { phase, today, countdown } = useFestivalClock(festival)
const { mode } = useTheme()
const { user, isSignedIn, initials } = useAuth()
const pwa = usePWA()
const plan = usePlanStore()

const nextTheme: Record<ThemeMode, ThemeMode> = { system: 'dark', dark: 'light', light: 'system' }
const themeMeta = computed(() => ({
  system: { label: 'System theme', icon: MonitorIcon },
  dark: { label: 'Dark theme', icon: MoonIcon },
  light: { label: 'Light theme', icon: SunIcon },
})[mode.value])

const status = computed(() => {
  const f = festival.value
  if (!f || !phase.value) return null
  if (phase.value === 'before') {
    const days = countdown.value?.days ?? 0
    return { title: days ? `${days} ${days === 1 ? 'day' : 'days'} to go` : 'Opens today', detail: `Opening night, ${f.days[0]?.label ?? ''}` }
  }
  if (phase.value === 'during') {
    return { title: `Day ${today.value?.number ?? 1} of ${f.days.length}`, detail: today.value?.highlight ?? today.value?.label ?? '' }
  }
  return { title: 'That’s a wrap', detail: 'See you next year' }
})
</script>

<template>
  <aside
    class="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface md:flex md:w-[4.75rem] lg:w-64"
    aria-label="App navigation"
  >
    <!-- Brand -->
    <div class="flex h-14 shrink-0 items-center px-4 lg:px-5">
      <NuxtLink to="/" aria-label="AFRIFF home" class="rounded-lg">
        <span class="lg:hidden"><AppLogo :show-wordmark="false" /></span>
        <span class="hidden lg:block"><AppLogo /></span>
      </NuxtLink>
    </div>

    <!-- Primary nav -->
    <nav aria-label="Primary" class="px-3 pt-2">
      <ul class="space-y-1">
        <li v-for="item in primaryNav" :key="item.to">
          <NuxtLink
            :to="item.to"
            :title="item.label"
            :aria-current="isNavActive(item, route.path) ? 'page' : undefined"
            class="flex h-10 items-center gap-3 rounded-tile px-3 font-medium transition-colors md:justify-center lg:justify-start"
            :class="
              isNavActive(item, route.path) ? 'bg-accent-soft text-accent-ink' : 'text-muted hover:bg-hover hover:text-ink'
            "
          >
            <component
              :is="item.icon"
              class="size-5 shrink-0"
              :stroke-width="isNavActive(item, route.path) ? 2.25 : 1.75"
              aria-hidden="true"
            />
            <span class="md:sr-only lg:not-sr-only">{{ item.label }}</span>
          </NuxtLink>
        </li>
      </ul>

      <ul class="mt-1 space-y-1 border-t border-line pt-1">
        <li v-for="item in secondaryNav" :key="item.to">
          <NuxtLink
            :to="item.to"
            :title="item.label"
            :aria-current="isNavActive(item, route.path) ? 'page' : undefined"
            class="flex h-10 items-center gap-3 rounded-tile px-3 font-medium transition-colors md:justify-center lg:justify-start"
            :class="
              isNavActive(item, route.path) ? 'bg-accent-soft text-accent-ink' : 'text-muted hover:bg-hover hover:text-ink'
            "
          >
            <component
              :is="item.icon"
              class="size-5 shrink-0"
              :stroke-width="isNavActive(item, route.path) ? 2.25 : 1.75"
              aria-hidden="true"
            />
            <span class="md:sr-only lg:not-sr-only">{{ item.label }}</span>
            <span
              v-if="plan.count"
              class="ml-auto hidden text-meta text-muted tabular-nums lg:inline"
            >{{ plan.count }}</span>
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <!-- Festival status -->
    <NuxtLink
      v-if="status"
      to="/programme"
      class="card-interactive mx-3 mt-6 hidden rounded-card border border-line bg-canvas p-3.5 lg:block"
    >
      <p class="font-semibold">{{ status.title }}</p>
      <p class="mt-0.5 truncate text-meta text-muted">{{ status.detail }}</p>
    </NuxtLink>

    <div class="flex-1" />

    <!-- Utilities -->
    <div class="space-y-1 border-t border-line p-3">
      <button
        v-if="pwa?.showInstallPrompt"
        type="button"
        title="Install the app"
        class="flex h-10 w-full items-center gap-3 rounded-tile px-3 text-meta font-medium text-muted transition-colors hover:bg-hover hover:text-ink md:justify-center lg:justify-start"
        @click="pwa?.install()"
      >
        <DownloadIcon class="size-5 shrink-0" aria-hidden="true" />
        <span class="md:sr-only lg:not-sr-only">Install app</span>
      </button>

      <button
        type="button"
        :title="`${themeMeta.label}. Click to change`"
        :aria-label="`${themeMeta.label}. Change theme`"
        class="flex h-10 w-full items-center gap-3 rounded-tile px-3 text-meta font-medium text-muted transition-colors hover:bg-hover hover:text-ink md:justify-center lg:justify-start"
        @click="mode = nextTheme[mode]"
      >
        <component :is="themeMeta.icon" class="size-5 shrink-0" aria-hidden="true" />
        <span class="md:sr-only lg:not-sr-only">{{ themeMeta.label }}</span>
      </button>

      <NuxtLink
        :to="isSignedIn ? '/me' : '/signin'"
        :title="isSignedIn ? user?.name : 'Sign in'"
        class="flex items-center gap-3 rounded-tile p-2 transition-colors hover:bg-hover md:justify-center lg:justify-start"
      >
        <span
          v-if="isSignedIn"
          class="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-label font-semibold text-accent-ink"
          aria-hidden="true"
        >
          {{ initials }}
        </span>
        <span v-else class="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-raised text-muted" aria-hidden="true">
          <UserRoundIcon class="size-4" />
        </span>
        <span class="min-w-0 md:sr-only lg:not-sr-only">
          <span class="block truncate text-meta font-semibold">{{ isSignedIn ? user?.name : 'Guest' }}</span>
          <span class="block truncate text-label text-muted">
            {{ isSignedIn ? user?.email : 'Sign in to buy passes' }}
          </span>
        </span>
      </NuxtLink>
    </div>
  </aside>
</template>
