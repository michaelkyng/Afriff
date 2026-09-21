<script setup lang="ts">
import {
  ChevronRightIcon,
  DownloadIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  RotateCcwIcon,
  SunIcon,
  TimerIcon,
  UserRoundIcon,
} from 'lucide-vue-next'
import { mockDb } from '@afriff/api/mock/db'
import type { ThemeMode } from '~/stores/prefs'

useHead({ title: 'Me' })

const { mode } = useTheme()
const prefs = usePrefsStore()
const pwa = usePWA()
const online = useOnline()
const { data: festival } = useFestival()
const { now, isSimulated } = useFestivalClock(festival)

const themeOptions: { value: ThemeMode; label: string; icon: typeof SunIcon }[] = [
  { value: 'system', label: 'System', icon: MonitorIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
  { value: 'light', label: 'Light', icon: SunIcon },
]

const clockPresets: { label: string; value: string | null }[] = [
  { label: 'Real time', value: null },
  { label: 'Week before', value: '2026-10-25T12:00:00+01:00' },
  { label: 'Opening night', value: '2026-11-01T18:30:00+01:00' },
  { label: 'Day 3, afternoon', value: '2026-11-03T14:15:00+01:00' },
  { label: 'Closing night', value: '2026-11-07T19:00:00+01:00' },
  { label: 'After the festival', value: '2026-11-09T10:00:00+01:00' },
]

const confirmingReset = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | undefined

function resetDemoData() {
  if (!confirmingReset.value) {
    confirmingReset.value = true
    resetTimer = setTimeout(() => (confirmingReset.value = false), 4000)
    return
  }
  clearTimeout(resetTimer)
  mockDb.reset()
  Object.keys(localStorage)
    .filter((key) => key.startsWith('afriff:'))
    .forEach((key) => localStorage.removeItem(key))
  reloadNuxtApp({ path: '/', force: true })
}

onBeforeUnmount(() => clearTimeout(resetTimer))
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-8">
    <AppPageHeader title="Me" />

    <!-- Account -->
    <UiCard class="flex flex-wrap items-center gap-4">
      <div class="grid size-14 shrink-0 place-items-center rounded-full bg-raised text-muted" aria-hidden="true">
        <UserRoundIcon class="size-6" />
      </div>
      <div class="min-w-0 flex-1 basis-52">
        <p class="font-semibold">Browsing as a guest</p>
        <p class="text-sm text-muted">Sign in to buy passes and keep your tickets.</p>
      </div>
      <UiButton size="sm" variant="secondary" disabled>Sign in</UiButton>
    </UiCard>

    <!-- Appearance -->
    <section aria-labelledby="appearance-title" class="space-y-3">
      <h2 id="appearance-title" class="flex items-center gap-2 text-sm font-semibold text-muted">
        <PaletteIcon class="size-4" aria-hidden="true" />
        Appearance
      </h2>
      <UiCard class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="font-medium">Theme</p>
          <p class="text-sm text-muted">System follows your phone’s setting.</p>
        </div>
        <UiSegmented v-model="mode" :options="themeOptions" label="Theme" />
      </UiCard>
    </section>

    <!-- App -->
    <section aria-labelledby="app-title" class="space-y-3">
      <h2 id="app-title" class="flex items-center gap-2 text-sm font-semibold text-muted">
        <DownloadIcon class="size-4" aria-hidden="true" />
        App
      </h2>
      <UiCard :padded="false" class="divide-y divide-line">
        <div class="flex items-center justify-between gap-4 p-5">
          <div>
            <p class="font-medium">Install on this device</p>
            <p class="text-sm text-muted">
              {{ pwa?.isPWAInstalled ? 'Installed — you’re using the app.' : 'Add AFRIFF to your home screen.' }}
            </p>
          </div>
          <UiButton v-if="pwa?.showInstallPrompt" size="sm" @click="pwa?.install()">Install</UiButton>
          <UiBadge v-else-if="pwa?.isPWAInstalled" tone="success">Installed</UiBadge>
        </div>
        <div class="flex items-center justify-between gap-4 p-5">
          <p class="font-medium">Connection</p>
          <UiBadge :tone="online ? 'success' : 'neutral'">{{ online ? 'Online' : 'Offline' }}</UiBadge>
        </div>
        <div class="flex items-center justify-between gap-4 p-5">
          <p class="font-medium">Ready for offline use</p>
          <UiBadge :tone="pwa?.offlineReady || pwa?.swActivated ? 'success' : 'neutral'">
            {{ pwa?.offlineReady || pwa?.swActivated ? 'Yes' : 'Not yet' }}
          </UiBadge>
        </div>
      </UiCard>
    </section>

    <!-- Developer -->
    <section aria-labelledby="dev-title" class="space-y-3">
      <h2 id="dev-title" class="flex items-center gap-2 text-sm font-semibold text-muted">
        <TimerIcon class="size-4" aria-hidden="true" />
        Developer
        <UiBadge tone="info">Local build</UiBadge>
      </h2>
      <UiCard :padded="false" class="divide-y divide-line">
        <div class="space-y-3 p-5">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <p class="font-medium">Festival clock</p>
            <p class="text-sm text-muted tabular-nums">
              {{ formatDay(now) }}, {{ formatTime(now) }}
              <UiBadge v-if="isSimulated" tone="info" class="ml-1">Simulated</UiBadge>
            </p>
          </div>
          <p class="text-sm text-muted">Preview how the app looks at different points in festival week.</p>
          <div class="flex flex-wrap gap-2">
            <UiChip
              v-for="preset in clockPresets"
              :key="preset.label"
              :model-value="prefs.devNow === preset.value"
              @update:model-value="prefs.setDevNow(preset.value)"
            >
              {{ preset.label }}
            </UiChip>
          </div>
        </div>
        <NuxtLink to="/styleguide" class="flex items-center justify-between gap-4 p-5 hover:bg-raised/50">
          <div>
            <p class="font-medium">Styleguide</p>
            <p class="text-sm text-muted">Design tokens and UI components.</p>
          </div>
          <ChevronRightIcon class="size-5 text-muted" aria-hidden="true" />
        </NuxtLink>
        <div class="flex items-center justify-between gap-4 p-5">
          <div>
            <p class="font-medium">Reset demo data</p>
            <p class="text-sm text-muted">Clears mock accounts, orders, tickets and preferences on this device.</p>
          </div>
          <UiButton size="sm" variant="danger" @click="resetDemoData">
            <RotateCcwIcon aria-hidden="true" />
            {{ confirmingReset ? 'Tap to confirm' : 'Reset' }}
          </UiButton>
        </div>
      </UiCard>
    </section>

    <AppPlanned
      feature="F3"
      title="Account (mock auth)"
      :items="['Sign up / sign in with email and a one-time code', 'Profile and order history', 'Sign out']"
    />
  </div>
</template>
