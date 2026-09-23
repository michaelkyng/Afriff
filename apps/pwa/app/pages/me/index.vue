<script setup lang="ts">
import {
  CheckIcon,
  ChevronRightIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  PencilIcon,
  RotateCcwIcon,
  SunIcon,
  UserRoundIcon,
} from 'lucide-vue-next'
import { isApiError } from '@afriff/api'
import { mockDb } from '@afriff/api/mock/db'
import type { ThemeMode } from '~/stores/prefs'

useHead({ title: 'Me' })

const { mode } = useTheme()
const { user, isSignedIn, initials, updateProfile, signOut: endSession } = useAuth()
const api = useApi()

/** Recent orders, for the account section. Only loaded when signed in. */
const { data: orders } = useLazyAsyncData('me:orders', () => api.orders.list(), {
  immediate: false,
})
watchEffect(() => {
  if (isSignedIn.value && !orders.value) refreshNuxtData('me:orders')
})

const orderTone = { paid: 'success', pending: 'accent', failed: 'danger' } as const
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

// ------------------------------------------------------------------ profile

const editing = ref(false)
const form = reactive({ name: '', phone: '' })
const formErrors = reactive({ name: '', phone: '' })
const saving = ref(false)

function startEditing() {
  form.name = user.value?.name ?? ''
  form.phone = user.value?.phone ?? ''
  formErrors.name = ''
  formErrors.phone = ''
  editing.value = true
}

async function saveProfile() {
  saving.value = true
  formErrors.name = ''
  formErrors.phone = ''
  try {
    await updateProfile({ name: form.name, phone: form.phone })
    editing.value = false
  }
  catch (error) {
    const field = isApiError(error) && error.details?.field === 'phone' ? 'phone' : 'name'
    formErrors[field] = isApiError(error) ? error.message : 'We could not save that. Try again.'
  }
  finally {
    saving.value = false
  }
}

async function signOut() {
  await endSession()
  await navigateTo('/')
}

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
  <div class="mx-auto max-w-2xl space-y-7">
    <AppPageHeader title="Me" />

    <!-- Account -->
    <UiCard v-if="isSignedIn" :padded="false">
      <div class="flex flex-wrap items-center gap-3.5 p-4 md:p-5">
        <div
          class="grid size-11 shrink-0 place-items-center rounded-full bg-accent-soft font-display font-semibold text-accent-ink"
          aria-hidden="true"
        >
          {{ initials }}
        </div>
        <div class="min-w-0 flex-1 basis-52">
          <p class="truncate font-semibold">{{ user?.name }}</p>
          <p class="truncate text-meta text-muted">{{ user?.email }}</p>
        </div>
        <UiButton v-if="!editing" size="sm" variant="secondary" @click="startEditing">
          <PencilIcon aria-hidden="true" />
          Edit
        </UiButton>
      </div>

      <form v-if="editing" class="space-y-4 border-t border-line p-4 md:p-5" novalidate @submit.prevent="saveProfile">
        <UiInput v-model="form.name" label="Name" autocomplete="name" :error="formErrors.name" :disabled="saving" />
        <UiInput
          v-model="form.phone"
          label="Phone"
          type="tel"
          inputmode="tel"
          autocomplete="tel"
          placeholder="0803 123 4567"
          hint="Optional. Used for ticket reminders."
          :error="formErrors.phone"
          :disabled="saving"
        />
        <div class="flex gap-2">
          <UiButton type="submit" size="sm" :loading="saving">
            <CheckIcon aria-hidden="true" />
            Save
          </UiButton>
          <UiButton size="sm" variant="ghost" :disabled="saving" @click="editing = false">Cancel</UiButton>
        </div>
      </form>

      <dl v-else-if="user?.phone" class="border-t border-line px-4 py-3 text-meta md:px-5">
        <div class="flex justify-between gap-4">
          <dt class="text-muted">Phone</dt>
          <dd class="tabular-nums">{{ user.phone }}</dd>
        </div>
      </dl>

      <div class="flex items-center justify-between gap-4 border-t border-line px-4 py-3 md:px-5">
        <p class="text-meta text-muted">Signed in on this device</p>
        <UiButton size="sm" variant="ghost" @click="signOut">
          <LogOutIcon aria-hidden="true" />
          Sign out
        </UiButton>
      </div>
    </UiCard>

    <UiCard v-else class="flex flex-wrap items-center gap-3.5">
      <div class="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-raised text-muted" aria-hidden="true">
        <UserRoundIcon class="size-5" />
      </div>
      <div class="min-w-0 flex-1 basis-52">
        <p class="font-semibold">Browsing as a guest</p>
        <p class="text-meta text-muted">Sign in to buy passes and keep your tickets.</p>
      </div>
      <UiButton size="sm" to="/signin">Sign in</UiButton>
    </UiCard>

    <!-- Orders -->
    <section v-if="isSignedIn" aria-labelledby="orders-title" class="space-y-2">
      <h2 id="orders-title" class="px-1 text-meta font-semibold text-muted">Orders</h2>
      <UiCard v-if="orders?.length" :padded="false">
        <ul class="divide-y divide-line">
          <li v-for="order in orders.slice(0, 5)" :key="order.id">
            <NuxtLink :to="`/orders/${order.id}`" class="row-interactive flex items-center gap-3 px-4 py-3 md:px-5">
              <span class="min-w-0 flex-1">
                <span class="block truncate font-medium tabular-nums">{{ order.reference }}</span>
                <span class="block truncate text-meta text-muted tabular-nums">
                  {{ formatDay(order.placedAt) }} · {{ order.lines.length }}
                  {{ order.lines.length === 1 ? 'item' : 'items' }}
                </span>
              </span>
              <UiBadge :tone="orderTone[order.status]">{{ order.status }}</UiBadge>
              <span class="shrink-0 font-medium tabular-nums">{{ formatMoney(order.total) }}</span>
              <ChevronRightIcon class="size-4 shrink-0 text-subtle" aria-hidden="true" />
            </NuxtLink>
          </li>
        </ul>
      </UiCard>
      <UiCard v-else class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-meta text-muted">No orders yet.</p>
        <UiButton size="sm" variant="secondary" to="/tickets">Browse tickets</UiButton>
      </UiCard>
    </section>

    <!-- Appearance -->
    <section aria-labelledby="appearance-title" class="space-y-2">
      <h2 id="appearance-title" class="flex items-center gap-2 px-1 text-meta font-semibold text-muted">
        Appearance
      </h2>
      <UiCard class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="font-medium">Theme</p>
          <p class="text-meta text-muted">System follows your device setting.</p>
        </div>
        <UiSegmented v-model="mode" :options="themeOptions" label="Theme" />
      </UiCard>
    </section>

    <!-- App -->
    <section aria-labelledby="app-title" class="space-y-2">
      <h2 id="app-title" class="flex items-center gap-2 px-1 text-meta font-semibold text-muted">
        App
      </h2>
      <UiCard :padded="false" class="divide-y divide-line">
        <div class="flex items-center justify-between gap-4 px-4 py-3.5 md:px-5">
          <div>
            <p class="font-medium">Install on this device</p>
            <p class="text-meta text-muted">
              {{ pwa?.isPWAInstalled ? 'Installed. You’re using the app.' : 'Add AFRIFF to your home screen.' }}
            </p>
          </div>
          <UiButton v-if="pwa?.showInstallPrompt" size="sm" @click="pwa?.install()">Install</UiButton>
          <UiBadge v-else-if="pwa?.isPWAInstalled" tone="success">Installed</UiBadge>
        </div>
        <div class="flex items-center justify-between gap-4 px-4 py-3.5 md:px-5">
          <p class="font-medium">Connection</p>
          <UiBadge :tone="online ? 'success' : 'neutral'">{{ online ? 'Online' : 'Offline' }}</UiBadge>
        </div>
        <div class="flex items-center justify-between gap-4 px-4 py-3.5 md:px-5">
          <p class="font-medium">Ready for offline use</p>
          <UiBadge :tone="pwa?.offlineReady || pwa?.swActivated ? 'success' : 'neutral'">
            {{ pwa?.offlineReady || pwa?.swActivated ? 'Yes' : 'Not yet' }}
          </UiBadge>
        </div>
      </UiCard>
    </section>

    <!-- Developer -->
    <section aria-labelledby="dev-title" class="space-y-2">
      <h2 id="dev-title" class="flex items-center gap-2 px-1 text-meta font-semibold text-muted">
        Developer
        <UiBadge tone="info">Local build</UiBadge>
      </h2>
      <UiCard :padded="false" class="divide-y divide-line">
        <div class="space-y-2.5 px-4 py-4 md:px-5">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <p class="font-medium">Festival clock</p>
            <p class="text-meta text-muted tabular-nums">
              {{ formatDay(now) }}, {{ formatTime(now) }}
              <UiBadge v-if="isSimulated" tone="info" class="ml-1">Simulated</UiBadge>
            </p>
          </div>
          <p class="text-meta text-muted">Preview how the app looks at different points in festival week.</p>
          <div class="flex flex-wrap gap-1.5 pt-1">
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
        <NuxtLink to="/styleguide" class="row-interactive flex items-center justify-between gap-4 px-4 py-3.5 md:px-5">
          <div>
            <p class="font-medium">Styleguide</p>
            <p class="text-meta text-muted">Design tokens and UI components.</p>
          </div>
          <ChevronRightIcon class="size-4 text-subtle" aria-hidden="true" />
        </NuxtLink>
        <div class="flex items-center justify-between gap-4 px-4 py-3.5 md:px-5">
          <div>
            <p class="font-medium">Reset demo data</p>
            <p class="text-meta text-muted">Clears mock accounts, orders, tickets and preferences on this device.</p>
          </div>
          <UiButton size="sm" variant="danger" @click="resetDemoData">
            <RotateCcwIcon aria-hidden="true" />
            {{ confirmingReset ? 'Tap to confirm' : 'Reset' }}
          </UiButton>
        </div>
      </UiCard>
    </section>

  </div>
</template>
