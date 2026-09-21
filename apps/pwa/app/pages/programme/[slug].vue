<script setup lang="ts">
import { CheckIcon, Share2Icon } from 'lucide-vue-next'
import type { ScreeningItem } from '@afriff/api/programme'

const route = useRoute()
const slug = computed(() => String(route.params.slug))

const { data: festival } = useFestival()
const { data: programme, timeline, lookups, pending } = useProgramme()
const { now } = useFestivalClock(festival)

const film = computed(() => programme.value?.films.find((f) => f.slug === slug.value) ?? null)
const section = computed(() => (film.value ? lookups.value?.section.get(film.value.sectionId) : undefined))

const screenings = computed(() =>
  timeline.value.filter((item): item is ScreeningItem => item.kind === 'screening' && item.film.slug === slug.value),
)
const upcomingCount = computed(() => screenings.value.filter((s) => !hasEnded(s, now.value)).length)

const moreFromSection = computed(() =>
  film.value ? (programme.value?.films ?? []).filter((f) => f.sectionId === film.value?.sectionId && f.id !== film.value.id) : [],
)

// Unknown slug → the app's 404 page (once data has loaded).
watchEffect(() => {
  if (programme.value && !film.value) {
    showError({ statusCode: 404, statusMessage: 'Film not found' })
  }
})

useHead({ title: () => film.value?.title ?? 'Film' })
usePageCrumb(() => film.value?.title)

// ------------------------------------------------------------------ share
const { share, isSupported: canShare } = useShare()
const { copy, copied } = useClipboard({ copiedDuring: 2000 })

async function shareFilm() {
  if (!film.value) return
  const url = typeof window !== 'undefined' ? window.location.href : ''
  const text = `${film.value.title} at ${festival.value?.editionTitle ?? 'AFRIFF'}`
  if (canShare.value) {
    try {
      await share({ title: film.value.title, text, url })
    }
    catch {
      // user cancelled the share sheet
    }
  }
  else {
    await copy(url)
  }
}
</script>

<template>
  <div class="space-y-10 md:space-y-12">
    <AppBackLink fallback="/programme" label="Programme" class="md:hidden" />

    <!-- Loading -->
    <div v-if="pending || !film" class="grid gap-8 md:grid-cols-[minmax(0,18rem)_1fr]" aria-busy="true">
      <UiSkeleton class="mx-auto aspect-[2/3] w-48 md:w-full" />
      <div class="space-y-4">
        <UiSkeleton class="h-4 w-40" />
        <UiSkeleton class="h-12 w-3/4" />
        <UiSkeleton class="h-4 w-1/2" />
        <UiSkeleton class="h-24 w-full" />
      </div>
    </div>

    <template v-else>
      <!-- Film header -->
      <article class="grid gap-8 md:grid-cols-[minmax(0,18rem)_1fr] md:gap-12">
        <FilmPoster :film="film" size="lg" class="mx-auto w-48 md:w-full" />

        <div>
          <div class="flex flex-wrap items-center gap-2">
            <NuxtLink
              v-if="section"
              :to="{ path: '/programme', query: { view: 'films', section: section.slug } }"
              class="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.12em] text-accent-ink uppercase hover:underline"
            >
              <span class="size-2 rounded-full" :style="{ background: `hsl(${section.hue} 70% 55%)` }" aria-hidden="true" />
              {{ section.name }}
            </NuxtLink>
            <UiBadge v-if="film.premiere" tone="accent">{{ film.premiere }}</UiBadge>
            <UiBadge v-if="film.inCompetition" tone="neutral">In competition</UiBadge>
          </div>

          <h1 class="mt-3 font-display text-4xl leading-[1.05] font-semibold tracking-tight md:text-5xl">{{ film.title }}</h1>

          <p class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            <span>{{ film.year }}</span>
            <span aria-hidden="true">·</span>
            <span>{{ formatRuntime(film.runtimeMin) }}</span>
            <span aria-hidden="true">·</span>
            <span
              class="rounded border border-line-strong px-1.5 text-xs font-semibold text-ink"
              :title="`Rated ${film.rating}`"
            >
              {{ film.rating }}
            </span>
            <span aria-hidden="true">·</span>
            <span>{{ film.countries.join(', ') }}</span>
          </p>

          <p class="mt-6 font-display text-xl leading-snug text-balance italic md:text-2xl">{{ film.logline }}</p>
          <p class="mt-4 max-w-2xl leading-relaxed text-muted">{{ film.synopsis }}</p>

          <dl class="mt-6 grid max-w-2xl gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
            <div>
              <dt class="font-semibold text-muted">Director</dt>
              <dd class="mt-0.5">{{ film.director }}</dd>
            </div>
            <div v-if="film.cast.length">
              <dt class="font-semibold text-muted">Cast</dt>
              <dd class="mt-0.5">{{ film.cast.join(', ') }}</dd>
            </div>
            <div>
              <dt class="font-semibold text-muted">Language</dt>
              <dd class="mt-0.5">{{ film.languages.join(', ') }}</dd>
            </div>
            <div>
              <dt class="font-semibold text-muted">Genre</dt>
              <dd class="mt-0.5">{{ film.genres.join(', ') }}</dd>
            </div>
          </dl>

          <div class="mt-7 flex flex-wrap gap-3">
            <UiButton :to="screenings.length ? '#screenings' : '/passes'">
              {{ upcomingCount ? `${upcomingCount} ${upcomingCount === 1 ? 'screening' : 'screenings'}` : 'See screenings' }}
            </UiButton>
            <UiButton variant="secondary" @click="shareFilm">
              <CheckIcon v-if="copied" aria-hidden="true" />
              <Share2Icon v-else aria-hidden="true" />
              {{ copied ? 'Link copied' : 'Share' }}
            </UiButton>
          </div>
        </div>
      </article>

      <!-- Screenings -->
      <section id="screenings" aria-labelledby="screenings-title" class="scroll-mt-24">
        <UiSectionHeader title="Screenings" title-id="screenings-title" eyebrow="Where & when" />
        <ul v-if="screenings.length" class="grid gap-3 md:grid-cols-2">
          <li v-for="item in screenings" :key="item.id">
            <FilmScreeningRow :item="item" :now="now" />
          </li>
        </ul>
        <p v-else class="text-muted">Screening times will be announced soon.</p>
      </section>

      <!-- More from this section -->
      <section v-if="moreFromSection.length" aria-labelledby="more-title">
        <UiSectionHeader
          :title="`More from ${section?.name ?? 'this section'}`"
          title-id="more-title"
          :to="section ? `/programme?view=films&section=${section.slug}` : undefined"
        />
        <UiCarousel :label="`More from ${section?.name ?? 'this section'}`">
          <li v-for="other in moreFromSection" :key="other.id" class="w-36 shrink-0 snap-start md:w-44">
            <FilmCard :film="other" />
          </li>
        </UiCarousel>
      </section>
    </template>
  </div>
</template>
