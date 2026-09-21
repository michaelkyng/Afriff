<script setup lang="ts">
import { ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { SearchIcon, XIcon } from 'lucide-vue-next'

/** Search field with a clear button. Emits `update:modelValue` after a short pause in typing. */
const props = withDefaults(defineProps<{ placeholder?: string; label?: string; debounce?: number }>(), {
  placeholder: 'Search',
  label: 'Search',
  debounce: 250,
})
const model = defineModel<string>({ default: '' })

const draft = ref(model.value)
watch(model, (value) => {
  if (value !== draft.value) draft.value = value
})
const push = useDebounceFn((value: string) => (model.value = value), () => props.debounce)
watch(draft, (value) => push(value))

function clear() {
  draft.value = ''
  model.value = ''
}
</script>

<template>
  <div class="relative">
    <SearchIcon class="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted" aria-hidden="true" />
    <input
      v-model="draft"
      type="search"
      :placeholder="placeholder"
      :aria-label="label"
      autocomplete="off"
      enterkeyhint="search"
      class="h-11 w-full rounded-full border border-line bg-surface pr-10 pl-10 text-[0.9375rem] text-ink placeholder:text-subtle focus:border-line-strong focus:outline-none [&::-webkit-search-cancel-button]:hidden"
    />
    <button
      v-if="draft"
      type="button"
      class="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-raised hover:text-ink"
      aria-label="Clear search"
      @click="clear"
    >
      <XIcon class="size-4" />
    </button>
  </div>
</template>
