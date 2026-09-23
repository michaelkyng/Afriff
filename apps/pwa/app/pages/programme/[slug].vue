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
  <div class="space-y-10">
    <AppBackLink fallback="/programme" label="Programme" class="md:hidden" />

    <!-- Loading -->
    <div v-if="pending || !film" class="grid gap-8 md:grid-cols-[minmax(0,18rem)_1fr]" aria-busy="true">
      <UiSkeleton class="mx-auto aspect-[2/3] w-48 md:w-full" />
      <div class="space-y-4">
        <UiSkeleton class="h-4 w-40 rounded-md" />
        <UiSkeleton class="h-10 w-3/4" />
        <UiSkeleton class="h-4 w-1/2 rounded-md" />
        <UiSkeleton class="h-24 w-full" />
      </div>
    </div>

    <template v-else>
      <!-- Film header -->
      <article class="grid gap-7 md:grid-cols-[minmax(0,17rem)_1fr] md:gap-10 lg:gap-12">
        <FilmPoster :film="film" size="lg" class="mx-auto w-44 md:w-full" />

        <div>
          <div class="flex flex-wrap items-center gap-2">
            <NuxtLink
              v-if="section"
              :to="{ path: '/programme', query: { view: 'films', section: section.slug } }"
              class="inline-flex h-5 items-center gap-1.5 rounded-tag border border-line px-1.5 text-label font-medium text-ink transition-colors hover:border-line-strong hover:bg-hover"
            >
              <span class="size-1.5 rounded-full" :style="{ background: `hsl(${section.hue} 70% 55%)` }" aria-hidden="true" />
              {{ section.name }}
            </NuxtLink>
            <UiBadge v-if="film.premiere" tone="accent">{{ film.premiere }}</UiBadge>
            <UiBadge v-if="film.inCompetition" tone="neutral">In competition</UiBadge>
          </div>

          <h1 class="mt-3 font-display text-display font-semibold md:text-display-lg">{{ film.title }}</h1>

          <ul class="mt-3 flex flex-wrap items-center gap-y-1 text-meta text-muted tabular-nums [&>li+li]:ml-3 [&>li+li]:border-l [&>li+li]:border-line-strong [&>li+li]:pl-3">
            <li>{{ film.year }}</li>
            <li>{{ formatRuntime(film.runtimeMin) }}</li>
            <li>
              <span class="rounded-tag border border-line-strong px-1 text-label font-semibold text-ink" :title="`Rated ${film.rating}`">
                {{ film.rating }}
              </span>
            </li>
            <li>{{ film.countries.join(', ') }}</li>
          </ul>

          <p class="mt-6 max-w-[48ch] font-display text-h2 leading-snug italic md:text-[1.375rem] md:leading-8">{{ film.logline }}</p>
          <p class="mt-3 max-w-[65ch] text-prose text-muted">{{ film.synopsis }}</p>

          <dl class="mt-6 grid max-w-2xl gap-x-8 gap-y-3.5 border-t border-line pt-5 sm:grid-cols-2">
            <div>
              <dt class="text-meta text-muted">Director</dt>
              <dd class="mt-0.5 font-medium">{{ film.director }}</dd>
            </div>
            <div v-if="film.cast.length">
              <dt class="text-meta text-muted">Cast</dt>
              <dd class="mt-0.5 font-medium">{{ film.cast.join(', ') }}</dd>
            </div>
            <div>
              <dt class="text-meta text-muted">Language</dt>
              <dd class="mt-0.5 font-medium">{{ film.languages.join(', ') }}</dd>
            </div>
            <div>
              <dt class="text-meta text-muted">Genre</dt>
              <dd class="mt-0.5 font-medium">{{ film.genres.join(', ') }}</dd>
            </div>
          </dl>

          <div class="mt-6 flex flex-wrap gap-2.5">
            <UiButton :to="screenings.length ? '#screenings' : '/tickets'">
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
        <UiSectionHeader
          title="Screenings"
          title-id="screenings-title"
          :meta="upcomingCount ? `${upcomingCount} upcoming` : undefined"
        />
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
          <li v-for="other in moreFromSection" :key="other.id" class="w-32 shrink-0 snap-start md:w-40">
            <FilmCard :film="other" />
          </li>
        </UiCarousel>
      </section>
    </template>
  </div>
</template>
