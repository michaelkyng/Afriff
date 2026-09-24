<script setup lang="ts">
import { ArrowRightIcon, FilmIcon, MonitorIcon, MoonIcon, SunIcon, TicketIcon } from 'lucide-vue-next'
import type { PosterMotif } from '@afriff/api'

useHead({ title: 'Styleguide' })

const api = useApi()
const { data: films } = useLazyAsyncData('styleguide:films', () => api.programme.listFilms())

const emblem = ['bg-emblem-blue', 'bg-emblem-sky', 'bg-emblem-green', 'bg-emblem-yellow', 'bg-emblem-red']

const semantic = [
  { name: 'canvas', className: 'bg-canvas' },
  { name: 'surface', className: 'bg-surface' },
  { name: 'raised', className: 'bg-raised' },
  { name: 'line-strong', className: 'bg-line-strong' },
  { name: 'ink', className: 'bg-ink' },
  { name: 'muted', className: 'bg-muted' },
  { name: 'accent', className: 'bg-accent' },
  { name: 'accent-soft', className: 'bg-accent-soft' },
  { name: 'success', className: 'bg-success' },
  { name: 'danger', className: 'bg-danger' },
  { name: 'info', className: 'bg-info' },
]

const navy = ['bg-navy-50', 'bg-navy-100', 'bg-navy-200', 'bg-navy-300', 'bg-navy-400', 'bg-navy-500', 'bg-navy-600', 'bg-navy-700', 'bg-navy-800', 'bg-navy-900', 'bg-navy-950']
const gold = ['bg-gold-50', 'bg-gold-100', 'bg-gold-200', 'bg-gold-300', 'bg-gold-400', 'bg-gold-500', 'bg-gold-600', 'bg-gold-700', 'bg-gold-800', 'bg-gold-900']

const { mode } = useTheme()
const themeOptions = [
  { value: 'system' as const, label: 'System', icon: MonitorIcon },
  { value: 'dark' as const, label: 'Dark', icon: MoonIcon },
  { value: 'light' as const, label: 'Light', icon: SunIcon },
]

const typeRoles = [
  { token: 'text-display-lg', className: 'font-display text-display-lg font-semibold', sample: 'Salt Roads', use: '44, film title (wide)' },
  { token: 'text-display', className: 'font-display text-display font-semibold', sample: 'Salt Roads', use: '36, film title, hero' },
  { token: 'text-h1', className: 'font-display text-h1 font-semibold', sample: 'Programme', use: '28, page titles' },
  { token: 'text-h2', className: 'font-display text-h2 font-semibold', sample: 'Up next today', use: '20, section titles' },
  { token: 'text-h3', className: 'text-h3 font-semibold', sample: 'Filters', use: '17, panel titles' },
  { token: 'text-prose', className: 'text-prose', sample: 'A retired postman finds a sack of letters.', use: '16, long reading' },
  { token: 'text-body', className: 'text-body font-semibold', sample: 'The Harmattan Letters', use: '15, UI copy, card titles' },
  { token: 'text-meta', className: 'text-meta text-muted', sample: 'Landmark, Cinema 2', use: '13, secondary lines' },
  { token: 'text-label', className: 'text-label text-muted', sample: 'Landmark, Cinema 2', use: '12, compact card details, captions' },
  { token: 'text-micro', className: 'text-micro font-medium', sample: 'Q&A', use: '11, badges, tab labels' },
]

const chipA = ref(true)
const chipB = ref(false)
const loading = ref(false)
function fakeLoad() {
  loading.value = true
  setTimeout(() => (loading.value = false), 1500)
}

const motifs: PosterMotif[] = ['sun', 'rays', 'bands', 'orb', 'grid', 'waves']
const postersByMotif = computed(() =>
  motifs.map((motif) => films.value?.find((film) => film.poster.motif === motif)).filter((film) => film !== undefined),
)
</script>

<template>
  <div class="space-y-12">
    <AppPageHeader title="Styleguide" description="Tokens and components from the shared UI kit.">
      <template #actions>
        <UiSegmented v-model="mode" :options="themeOptions" label="Theme" />
      </template>
    </AppPageHeader>

    <section class="space-y-5">
      <UiSectionHeader title="Brand" meta="From afriff.com" />
      <div class="grid gap-4 md:grid-cols-3">
        <UiCard class="grid place-items-center py-8">
          <BrandLockup :emblem-size="72" />
        </UiCard>
        <div class="grid place-items-center rounded-card border border-line bg-white py-8 text-navy-900">
          <BrandLockup :emblem-size="72" />
        </div>
        <div class="grid place-items-center rounded-card border border-line bg-navy-950 py-8 text-white">
          <BrandLockup :emblem-size="72" />
        </div>
      </div>
      <p class="text-meta text-muted">
        Emblem cut from the official logo; wordmark and festival name traced to vectors so they follow the theme colour.
        Swap in official vector artwork when the festival supplies it.
      </p>
    </section>

    <section class="space-y-5">
      <UiSectionHeader title="Colour" />
      <div>
        <p class="mb-2 text-meta font-semibold text-muted">Semantic (switch with the theme)</p>
        <ul class="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <li v-for="token in semantic" :key="token.name" class="text-meta">
            <div class="h-16 rounded-tile border border-line" :class="token.className" />
            <p class="mt-1.5 font-mono text-label text-muted">{{ token.name }}</p>
          </li>
        </ul>
      </div>
      <div class="space-y-2">
        <p class="text-meta font-semibold text-muted">Brand scales</p>
        <div class="flex overflow-hidden rounded-tile">
          <div v-for="c in navy" :key="c" class="h-10 flex-1" :class="c" :title="c" />
        </div>
        <div class="flex overflow-hidden rounded-tile">
          <div v-for="c in gold" :key="c" class="h-10 flex-1" :class="c" :title="c" />
        </div>
        <div class="flex max-w-sm overflow-hidden rounded-tile">
          <div v-for="c in emblem" :key="c" class="h-10 flex-1" :class="c" :title="c" />
        </div>
      </div>
    </section>

    <section class="space-y-5">
      <UiSectionHeader title="Type" meta="Archivo for titles, Onest for everything else" />
      <ul class="card divide-y divide-line">
        <li v-for="role in typeRoles" :key="role.token" class="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-4 py-3.5 md:px-5">
          <code class="w-28 shrink-0 font-mono text-label text-muted">{{ role.token }}</code>
          <p class="min-w-0 flex-1 truncate" :class="role.className">{{ role.sample }}</p>
          <p class="text-label text-subtle">{{ role.use }}</p>
        </li>
      </ul>
      <p class="font-display text-h1 font-semibold tabular-nums">18:30 · ₦75,000</p>
    </section>

    <section class="space-y-5">
      <UiSectionHeader title="Buttons" />
      <div class="flex flex-wrap items-center gap-3">
        <UiButton>Primary</UiButton>
        <UiButton variant="secondary">Secondary</UiButton>
        <UiButton variant="ghost">Ghost</UiButton>
        <UiButton variant="danger">Danger</UiButton>
        <UiButton disabled>Disabled</UiButton>
        <UiButton :loading="loading" @click="fakeLoad">{{ loading ? 'Loading' : 'Click to load' }}</UiButton>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <UiButton size="sm">Small</UiButton>
        <UiButton>Medium</UiButton>
        <UiButton size="lg">
          <TicketIcon aria-hidden="true" />
          Large with icon
        </UiButton>
        <UiButton variant="secondary" to="/programme">
          Link button
          <ArrowRightIcon aria-hidden="true" />
        </UiButton>
      </div>
      <p class="flex items-center gap-1 font-semibold tabular-nums">
        AF-7KQ2P
        <UiCopyButton value="AF-7KQ2P" label="order reference" />
      </p>
    </section>

    <section class="space-y-5">
      <UiSectionHeader title="Badges, chips, toggles" />
      <div class="flex flex-wrap gap-2">
        <UiBadge>Neutral</UiBadge>
        <UiBadge tone="accent">World Premiere</UiBadge>
        <UiBadge tone="success">Available</UiBadge>
        <UiBadge tone="danger">Sold out</UiBadge>
        <UiBadge tone="info">Q&A</UiBadge>
      </div>
      <div class="flex flex-wrap gap-2">
        <UiChip v-model="chipA">Landmark</UiChip>
        <UiChip v-model="chipB">
          <FilmIcon aria-hidden="true" />
          Documentary
        </UiChip>
      </div>
    </section>

    <section class="space-y-5">
      <UiSectionHeader title="Surfaces" to="/styleguide" link-label="Section link" />
      <div class="grid gap-4 md:grid-cols-2">
        <UiCard interactive>
          <p class="font-semibold">Card</p>
          <p class="mt-1 text-meta text-muted">Surface with a hairline border. Add <code>interactive</code> for hover and press feedback.</p>
        </UiCard>
        <UiCard class="space-y-3">
          <UiSkeleton class="h-5 w-2/3" />
          <UiSkeleton class="h-4 w-full" />
          <UiSkeleton class="h-4 w-5/6" />
        </UiCard>
      </div>
      <UiCard>
        <UiEmptyState :icon="TicketIcon" title="Empty state" description="Used when a list has nothing in it yet.">
          <UiButton size="sm">Primary action</UiButton>
        </UiEmptyState>
      </UiCard>
    </section>

    <section class="space-y-5">
      <UiSectionHeader title="Poster art" meta="Generated, works offline" />
      <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <li v-for="film in postersByMotif" :key="film.id">
          <FilmPoster :film="film" />
          <p class="mt-1.5 font-mono text-label text-muted">{{ film.poster.motif }}</p>
        </li>
      </ul>
    </section>
  </div>
</template>
