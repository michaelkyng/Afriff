<script setup lang="ts">
import {
  AccessibilityIcon,
  ArrowUpRightIcon,
  CarIcon,
  CheckIcon,
  ClockIcon,
  MailIcon,
  MapPinIcon,
  MessageCircleIcon,
  PhoneIcon,
  ScrollTextIcon,
  SearchXIcon,
} from 'lucide-vue-next'
import type { FaqTopic } from '@afriff/api'

/**
 * Everything that does not change through the week: where the venues are and
 * how to reach them, the questions people ask, the rules they are owed before
 * they buy, and who to talk to.
 */
useHead({ title: 'Info and help' })

const api = useApi()
const { data: programme } = useProgramme()

const { data: info, status } = useLazyAsyncData('info:all', () => api.info.get(), {
  getCachedData: reuseLoaded,
})
const loading = computed(() => status.value !== 'success' && status.value !== 'error')

const venues = computed(() => programme.value?.venues ?? [])

// ------------------------------------------------------------------ faqs

const topics: { value: FaqTopic; label: string }[] = [
  { value: 'tickets', label: 'Tickets' },
  { value: 'at-the-festival', label: 'At the festival' },
  { value: 'access', label: 'Access' },
  { value: 'getting-there', label: 'Getting there' },
]

const search = ref('')

const matches = computed(() => {
  const term = search.value.trim().toLowerCase()
  const all = info.value?.faqs ?? []
  if (!term) return all
  return all.filter((faq) => `${faq.question} ${faq.answer}`.toLowerCase().includes(term))
})

const grouped = computed(() =>
  topics
    .map((topic) => ({ ...topic, faqs: matches.value.filter((faq) => faq.topic === topic.value) }))
    .filter((group) => group.faqs.length),
)

/** Searching opens what it found; browsing leaves the questions closed. */
const searching = computed(() => search.value.trim().length > 1)

const sections = [
  { id: 'venues', label: 'Venues' },
  { id: 'faqs', label: 'Questions' },
  { id: 'policies', label: 'Policies' },
  { id: 'contact', label: 'Contact' },
]
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8">
    <AppPageHeader
      title="Info and help"
      description="Where the venues are, how tickets work, what the rules are, and who to ask."
    />

    <nav aria-label="On this page" class="flex flex-wrap gap-1.5">
      <a
        v-for="section in sections"
        :key="section.id"
        :href="`#${section.id}`"
        class="pressable rounded-full border border-line bg-surface px-3 py-1.5 text-meta font-medium text-muted transition-colors hover:border-line-strong hover:text-ink"
      >
        {{ section.label }}
      </a>
    </nav>

    <!-- ================================================= Venues -->
    <section id="venues" aria-labelledby="venues-title" class="scroll-mt-24">
      <UiSectionHeader
        title="Venues and getting there"
        title-id="venues-title"
        :meta="venues.length ? `${venues.length} across Lagos` : undefined"
      />
      <div v-if="!venues.length" class="grid gap-3 md:grid-cols-2">
        <UiSkeleton v-for="n in 4" :key="n" class="h-44 rounded-card" />
      </div>
      <ul v-else class="grid gap-3 md:grid-cols-2">
        <li v-for="venue in venues" :key="venue.id">
          <article class="card flex h-full flex-col p-4 md:p-5">
            <h3 class="font-semibold">
              <NuxtLink :to="`/venues/${venue.slug}`" class="hover:underline">{{ venue.name }}</NuxtLink>
            </h3>
            <p class="mt-0.5 flex items-start gap-1.5 text-label text-muted">
              <MapPinIcon class="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden="true" />
              {{ venue.area }}
            </p>

            <dl class="mt-3 space-y-2 text-meta">
              <div v-if="venue.travel?.parking" class="flex gap-2">
                <dt class="sr-only">Parking</dt>
                <CarIcon class="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden="true" />
                <dd class="text-muted">{{ venue.travel.parking }}</dd>
              </div>
              <div v-if="venue.travel?.timing" class="flex gap-2">
                <dt class="sr-only">When to leave</dt>
                <ClockIcon class="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden="true" />
                <dd class="text-muted">{{ venue.travel.timing }}</dd>
              </div>
              <div class="flex gap-2">
                <dt class="sr-only">Access</dt>
                <AccessibilityIcon class="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden="true" />
                <dd class="text-muted">{{ venue.accessibility.join(' · ') }}</dd>
              </div>
            </dl>

            <div class="mt-auto flex flex-wrap gap-2 pt-4">
              <UiButton :to="`/venues/${venue.slug}`" size="sm" variant="secondary">Venue details</UiButton>
              <UiButton :to="venue.mapsUrl" target="_blank" rel="noopener noreferrer" external size="sm" variant="ghost">
                Directions
                <ArrowUpRightIcon aria-hidden="true" />
              </UiButton>
            </div>
          </article>
        </li>
      </ul>
    </section>

    <!-- ================================================= FAQs -->
    <section id="faqs" aria-labelledby="faqs-title" class="scroll-mt-24">
      <UiSectionHeader title="Questions" title-id="faqs-title" />

      <UiSearchInput v-model="search" label="Search the questions" placeholder="Search questions" class="mb-3" />

      <div v-if="loading" class="space-y-3">
        <UiSkeleton v-for="n in 3" :key="n" class="h-32 rounded-card" />
      </div>

      <UiEmptyState
        v-else-if="!grouped.length"
        :icon="SearchXIcon"
        title="Nothing matches that"
        description="Try a different word, or ask us directly — the contact details are below."
      >
        <UiButton variant="secondary" @click="search = ''">Clear the search</UiButton>
      </UiEmptyState>

      <div v-else class="space-y-5">
        <section v-for="group in grouped" :key="group.value" :aria-label="group.label">
          <h3 class="mb-2 px-1 text-meta font-semibold text-muted">{{ group.label }}</h3>
          <UiCard :padded="false">
            <UiDisclosure
              v-for="faq in group.faqs"
              :key="faq.id"
              :title="faq.question"
              :open="searching"
            >
              <p>{{ faq.answer }}</p>
              <NuxtLink
                v-if="faq.link"
                :to="faq.link"
                class="mt-2 inline-flex items-center gap-1 font-medium text-ink underline decoration-line-strong hover:decoration-current"
              >
                {{ faq.linkLabel ?? 'Take a look' }}
              </NuxtLink>
            </UiDisclosure>
          </UiCard>
        </section>
      </div>
    </section>

    <!-- ================================================= Policies -->
    <section id="policies" aria-labelledby="policies-title" class="scroll-mt-24">
      <UiSectionHeader title="Festival policies" title-id="policies-title" />
      <div v-if="loading" class="space-y-2">
        <UiSkeleton v-for="n in 4" :key="n" class="h-16 rounded-card" />
      </div>
      <ul v-else class="grid gap-3 md:grid-cols-2">
        <li v-for="policy in info?.policies" :key="policy.id">
          <article class="card h-full p-4 md:p-5">
            <h3 class="flex items-center gap-2 font-semibold">
              <ScrollTextIcon class="size-4 shrink-0 text-subtle" aria-hidden="true" />
              {{ policy.title }}
            </h3>
            <p class="mt-1.5 text-meta text-muted">{{ policy.body }}</p>
          </article>
        </li>
      </ul>
    </section>

    <!-- ================================================= Contact -->
    <section id="contact" aria-labelledby="contact-title" class="scroll-mt-24">
      <UiSectionHeader title="Talk to us" title-id="contact-title" />
      <UiCard v-if="info" :padded="false" class="divide-y divide-line">
        <a :href="`mailto:${info.contact.email}`" class="row-interactive flex items-center gap-3 px-4 py-3.5 md:px-5">
          <MailIcon class="size-4 shrink-0 text-subtle" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            <span class="block font-semibold">Email</span>
            <span class="block truncate text-label text-muted">{{ info.contact.email }}</span>
          </span>
          <ArrowUpRightIcon class="size-4 shrink-0 text-subtle" aria-hidden="true" />
        </a>
        <a
          v-if="info.contact.phone"
          :href="`tel:${info.contact.phone.replace(/\s/g, '')}`"
          class="row-interactive flex items-center gap-3 px-4 py-3.5 md:px-5"
        >
          <PhoneIcon class="size-4 shrink-0 text-subtle" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            <span class="block font-semibold">Phone</span>
            <span class="block text-label text-muted tabular-nums">{{ info.contact.phone }}</span>
          </span>
          <ArrowUpRightIcon class="size-4 shrink-0 text-subtle" aria-hidden="true" />
        </a>
        <p v-if="info.contact.inPerson" class="flex items-start gap-3 px-4 py-3.5 md:px-5">
          <MessageCircleIcon class="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            <span class="block font-semibold">In person</span>
            <span class="block text-label text-muted">{{ info.contact.inPerson }}</span>
          </span>
        </p>
        <p class="flex items-start gap-3 px-4 py-3.5 md:px-5">
          <ClockIcon class="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            <span class="block font-semibold">When we answer</span>
            <span class="block text-label text-muted">{{ info.contact.hours }}</span>
          </span>
        </p>
      </UiCard>

      <p class="mt-3 flex items-start gap-2 px-1 text-label text-muted">
        <CheckIcon class="size-3.5 shrink-0 translate-y-px text-success" aria-hidden="true" />
        <span>
          Changes during the week are posted to
          <NuxtLink to="/updates" class="font-medium text-ink underline decoration-line-strong hover:decoration-current">Updates</NuxtLink>,
          and anything affecting a ticket you hold is flagged in the app.
        </span>
      </p>
    </section>
  </div>
</template>
