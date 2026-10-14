<script setup lang="ts">
import { MegaphoneIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-vue-next'
import type { FestivalUpdate } from '@afriff/api/types'

useHead({ title: 'Updates' })

const ops = useOps()
const { data: updates, refresh } = useAsyncData('ops:updates', () => ops.updates())
const { data: programme } = useOpsProgramme()

/** Scheduled or published is a matter of the time; it is checked again whenever the list changes, so a new update lands in the right group. */
const now = ref(new Date())
useIntervalFn(() => (now.value = new Date()), 30_000)
watch(updates, () => (now.value = new Date()))
const scheduled = computed(() => (updates.value ?? []).filter((item) => Date.parse(item.publishedAt) > now.value.getTime()).reverse())
const published = computed(() => (updates.value ?? []).filter((item) => Date.parse(item.publishedAt) <= now.value.getTime()))

/** What an update is about, in words: the film and time, the event, or the venue. */
function about(update: FestivalUpdate): string | undefined {
  const subject = update.subject
  if (!subject || !programme.value) return undefined
  const screening = subject.screeningId ? programme.value.screenings.find((item) => item.id === subject.screeningId) : undefined
  if (screening) return `${programme.value.films.find((item) => item.id === screening.filmId)?.title}, ${formatDay(screening.startsAt)} ${formatTime(screening.startsAt)}`
  if (subject.eventId) return programme.value.events.find((item) => item.id === subject.eventId)?.title
  if (subject.venueId) return programme.value.venues.find((item) => item.id === subject.venueId)?.name
  if (subject.filmId) return programme.value.films.find((item) => item.id === subject.filmId)?.title
  return undefined
}

const composing = ref(false)
const editing = ref<FestivalUpdate | null>(null)
function write(update: FestivalUpdate | null) {
  editing.value = update
  composing.value = true
}

const remove = useOpsAction('deleteUpdate')
const confirming = ref<string | null>(null)
async function deleteUpdate(update: FestivalUpdate) {
  if (confirming.value !== update.id) {
    confirming.value = update.id
    return
  }
  confirming.value = null
  if (await remove.run({ id: update.id }, 'Deleted.')) refresh()
}
</script>

<template>
  <div>
    <OpsHeader title="Updates" description="What attendees see under Updates, newest first. They appear when the clock reaches them.">
      <UiButton @click="write(null)">
        <PlusIcon aria-hidden="true" />
        New update
      </UiButton>
    </OpsHeader>

    <p v-if="remove.error.value" role="alert" class="mb-3 text-meta text-danger">{{ remove.error.value }}</p>

    <UiSkeleton v-if="!updates" class="h-80 rounded-card" />
    <template v-else>
      <section v-for="group in [{ id: 'scheduled', title: 'Scheduled', items: scheduled }, { id: 'published', title: 'Published', items: published }]" :key="group.id" class="mb-8" :aria-labelledby="`${group.id}-title`">
        <template v-if="group.items.length || group.id === 'published'">
          <UiSectionHeader :title="group.title" :title-id="`${group.id}-title`" :meta="String(group.items.length)" />
          <UiEmptyState v-if="!group.items.length" :icon="MegaphoneIcon" title="No updates yet" description="Write one for festival news, or open a screening to tell the people it affects about a change." />
          <UiCard v-else :padded="false" class="divide-y divide-line">
            <article v-for="update in group.items" :key="update.id" class="flex flex-wrap items-start gap-3 px-4 py-3.5 md:px-5">
              <div class="min-w-0 flex-1 basis-80">
                <p class="flex flex-wrap items-center gap-1.5">
                  <span class="font-semibold">{{ update.title }}</span>
                  <UiBadge v-if="update.severity === 'urgent'" tone="accent">Urgent</UiBadge>
                </p>
                <p class="mt-0.5 text-meta text-pretty text-muted">{{ update.body }}</p>
                <p class="mt-1.5 text-label text-subtle">
                  {{ UPDATE_KIND[update.kind] }} · {{ formatDay(update.publishedAt) }}, {{ formatTime(update.publishedAt) }}<template v-if="about(update)"> · About {{ about(update) }}</template>
                </p>
              </div>
              <div class="flex gap-1">
                <UiButton size="sm" variant="ghost" @click="write(update)">
                  <PencilIcon aria-hidden="true" />
                  Edit
                </UiButton>
                <UiButton size="sm" :variant="confirming === update.id ? 'danger' : 'ghost'" :loading="remove.pending.value && confirming === null" @click="deleteUpdate(update)">
                  <Trash2Icon aria-hidden="true" />
                  {{ confirming === update.id ? 'Delete it' : 'Delete' }}
                </UiButton>
              </div>
            </article>
          </UiCard>
        </template>
      </section>
    </template>

    <UpdateComposer v-model:open="composing" :existing="editing" :subject-label="editing ? about(editing) : undefined" @published="refresh()" />
  </div>
</template>
