<script setup lang="ts">
import { ArrowLeftIcon } from 'lucide-vue-next'

/** Goes back in history when there is somewhere to go back to, otherwise to `fallback`. */
defineProps<{ fallback: string; label?: string }>()
const router = useRouter()

function back(event: MouseEvent) {
  if (typeof window !== 'undefined' && window.history.state?.back) {
    event.preventDefault()
    router.back()
  }
  // otherwise let the link navigate to the fallback
}
</script>

<template>
  <NuxtLink
    :to="fallback"
    class="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-muted hover:text-ink"
    @click="back"
  >
    <ArrowLeftIcon class="size-4" aria-hidden="true" />
    {{ label ?? 'Back' }}
  </NuxtLink>
</template>
