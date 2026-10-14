<script setup lang="ts">
import { ClockIcon } from 'lucide-vue-next'

/**
 * Rehearsal: run the door as if it were a moment in festival week. Only shown
 * where the API honours it (the mock and the emulators); a deployed server
 * always judges by its own clock.
 */
const props = defineProps<{ days: string[] }>()
const clock = useDoorClock()
const open = ref(false)

/** Early evening on each festival day, when most doors are open. */
const presets = computed(() => props.days.map((day) => ({ day, at: `${day}T18:15:00+01:00` })))

function choose(at: string | null) {
  clock.rehearseAt(at)
  open.value = false
}
</script>

<template>
  <div v-if="clock.available" class="rounded-tile border border-line bg-raised px-3.5 py-2.5">
    <div class="flex items-center gap-2.5">
      <ClockIcon class="size-4 shrink-0" :class="clock.rehearsing.value ? 'text-accent-ink' : 'text-subtle'" aria-hidden="true" />
      <p class="min-w-0 flex-1 text-meta">
        <span class="font-semibold">{{ clock.rehearsing.value ? 'Rehearsal clock' : 'Real time' }}</span>
        <span class="ml-1.5 text-muted tabular-nums">{{ formatDay(clock.now.value) }}, {{ formatTime(clock.now.value) }}</span>
      </p>
      <UiButton size="sm" variant="ghost" :aria-expanded="open" @click="open = !open">{{ open ? 'Done' : 'Change' }}</UiButton>
    </div>
    <div v-if="open" class="mt-2.5 flex flex-wrap gap-1.5 border-t border-line pt-2.5">
      <UiChip :model-value="!clock.rehearsing.value" @update:model-value="choose(null)">Real time</UiChip>
      <UiChip v-for="preset in presets" :key="preset.day" @update:model-value="choose(preset.at)">
        {{ formatDay(preset.at) }}, 18:15
      </UiChip>
      <p class="w-full pt-1 text-label text-pretty text-muted">For practising before the festival. The live door always uses the real time.</p>
    </div>
  </div>
</template>
