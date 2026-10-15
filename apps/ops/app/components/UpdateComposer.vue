<script setup lang="ts">
import { BellIcon } from 'lucide-vue-next'
import type { UpdateDraft } from '@afriff/api/ops'
import type { FestivalUpdate, UpdateKind, UpdateSubject } from '@afriff/api/types'

/**
 * Writing a festival update: offered with a draft after a screening changes,
 * or empty for an announcement, or with an existing update to edit. Shows how
 * it will look in the app as it is written.
 */
const props = defineProps<{
  draft?: UpdateDraft | null
  existing?: FestivalUpdate | null
  /** What the subject is, ready to show: "Salt Roads, Tue 3 Nov 18:30". */
  subjectLabel?: string
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ published: [update: FestivalUpdate] }>()

const form = reactive({ kind: 'announcement' as UpdateKind, urgent: false, title: '', body: '', link: '', when: 'now' as 'now' | 'later', publishAt: '', email: false })
const subject = ref<UpdateSubject | undefined>()
const { run, pending, errorFor, formError } = useOpsAction('publishUpdate')

watch(open, (value) => {
  if (!value) return
  const source = props.existing ?? props.draft
  form.kind = source?.kind ?? 'announcement'
  form.urgent = source?.severity === 'urgent'
  form.title = source?.title ?? ''
  form.body = source?.body ?? ''
  form.link = source?.link ?? ''
  subject.value = source?.subject
  const later = props.existing && Date.parse(props.existing.publishedAt) > Date.now()
  form.when = later ? 'later' : 'now'
  form.publishAt = later ? toLagosInput(props.existing!.publishedAt) : ''
  form.email = false
})

const kinds = [
  { value: 'schedule' as const, label: UPDATE_KIND.schedule },
  { value: 'venue' as const, label: UPDATE_KIND.venue },
  { value: 'announcement' as const, label: UPDATE_KIND.announcement },
]
const whenOptions = [
  { value: 'now' as const, label: 'Now' },
  { value: 'later' as const, label: 'Later' },
]
const canEmail = computed(() => Boolean(subject.value?.screeningId || subject.value?.eventId))

async function submit() {
  const output = await run({
    id: props.existing?.id,
    kind: form.kind,
    severity: form.urgent ? 'urgent' : 'normal',
    title: form.title,
    body: form.body,
    subject: subject.value,
    link: form.link.trim() || undefined,
    publishAt: form.when === 'later' && form.publishAt ? fromLagosInput(form.publishAt) : undefined,
    emailTicketHolders: canEmail.value && form.email,
  }, (result) => `${props.existing ? 'Saved' : form.when === 'later' ? 'Scheduled' : 'Published'}.${result.emailed ? ` Emailing ${result.emailed} ${result.emailed === 1 ? 'person' : 'people'}.` : ''}`)
  if (!output) return
  open.value = false
  emit('published', output.update)
}
</script>

<template>
  <UiSheet v-model:open="open" :title="existing ? 'Edit update' : 'Tell attendees'">
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <p v-if="subjectLabel" class="rounded-tile border border-line bg-raised px-3.5 py-2.5 text-meta">
        <span class="text-muted">About</span> <span class="font-semibold">{{ subjectLabel }}</span>.
        <span class="text-muted">People with a ticket for it, or who saved it, see it marked for them.</span>
      </p>

      <UiSelect v-model="form.kind" label="Kind" :options="kinds" :disabled="pending" />
      <UiInput v-model="form.title" label="Title" :maxlength="90" :error="errorFor('title')" :disabled="pending" />
      <UiTextarea v-model="form.body" label="What has changed, and what to do" :rows="5" :maxlength="600" :error="errorFor('body')" :disabled="pending" />
      <UiInput v-model="form.link" label="Link in the app (optional)" placeholder="/programme/salt-roads" :error="errorFor('link')" :disabled="pending" />
      <UiCheckbox v-model="form.urgent" label="Urgent" hint="Pushes a notification to the people it is about (ticket holders and anyone who saved it; everyone, when it is about nothing in particular), and shows ticket holders a banner." :disabled="pending" />

      <div class="space-y-2">
        <UiSegmented v-model="form.when" :options="whenOptions" label="Publish" />
        <UiInput v-if="form.when === 'later'" v-model="form.publishAt" label="Publish at (Lagos time)" type="datetime-local" :error="errorFor('publishAt')" :disabled="pending" />
      </div>

      <UiCheckbox
        v-if="canEmail"
        v-model="form.email"
        label="Also email ticket holders"
        hint="For people who may not open the app before they set off. Sent once, now."
        :disabled="pending"
      />

      <!-- How it reads in the app -->
      <div aria-label="Preview" class="rounded-tile border border-dashed border-line-strong p-3">
        <p class="mb-2 text-label text-muted">In the app</p>
        <div class="flex gap-3">
          <span class="grid size-8 shrink-0 place-items-center rounded-full" :class="form.urgent ? 'bg-accent-soft text-accent-ink' : 'bg-raised text-muted'" aria-hidden="true">
            <BellIcon class="size-4" />
          </span>
          <div class="min-w-0">
            <p class="font-semibold">{{ form.title || 'Title' }}</p>
            <p class="mt-0.5 text-meta text-pretty whitespace-pre-line text-muted">{{ form.body || 'What has changed, and what to do.' }}</p>
            <p class="mt-1 text-label text-subtle">{{ UPDATE_KIND[form.kind] }}<template v-if="subject"> · Affects people holding a ticket</template></p>
          </div>
        </div>
      </div>

      <p v-if="formError(['title', 'body', 'link', 'publishAt'])" role="alert" class="text-meta text-danger">{{ formError(['title', 'body', 'link', 'publishAt']) }}</p>
      <UiButton type="submit" block :loading="pending">
        {{ existing ? 'Save update' : form.when === 'later' ? 'Schedule update' : 'Publish update' }}
      </UiButton>
    </form>
  </UiSheet>
</template>
