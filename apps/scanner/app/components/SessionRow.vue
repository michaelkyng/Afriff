<script setup lang="ts">
import { ChevronRightIcon } from 'lucide-vue-next'
import { doorsOpenAt } from '@afriff/api/door'
import type { DoorSession } from '@afriff/api/door'
import type { SessionState } from '~/utils/sessions'

/** One screening or event in the list, with whether its doors are open. */
const props = defineProps<{ session: DoorSession; state: SessionState }>()

const KIND: Record<string, string> = { gala: 'Gala', masterclass: 'Masterclass', panel: 'Panel', awards: 'Awards', social: 'Social' }
const kind = computed(() => (props.session.eventKind ? KIND[props.session.eventKind] : props.session.format === 'Gala' ? 'Gala screening' : undefined))
</script>

<template>
  <NuxtLink
    :to="`/scan/${session.ref.kind}/${session.ref.id}`"
    class="row-interactive flex items-center gap-3.5 px-4 py-3.5"
    :class="state === 'ended' && 'opacity-60'"
  >
    <span class="w-12 shrink-0 font-display text-h3 font-semibold tabular-nums">{{ formatTime(session.startsAt) }}</span>
    <span class="min-w-0 flex-1">
      <span class="block truncate font-semibold">{{ session.title }}</span>
      <span class="block truncate text-label text-muted">
        <template v-if="kind">{{ kind }} · </template>{{ session.place }}
      </span>
    </span>
    <UiBadge v-if="state === 'open'" tone="success" class="self-center!">Doors open</UiBadge>
    <span v-else-if="state === 'upcoming'" class="shrink-0 text-label text-muted tabular-nums">Opens {{ formatTime(doorsOpenAt(session)) }}</span>
    <span v-else class="shrink-0 text-label text-muted">Ended</span>
    <ChevronRightIcon class="size-4 shrink-0 text-subtle" aria-hidden="true" />
  </NuxtLink>
</template>
