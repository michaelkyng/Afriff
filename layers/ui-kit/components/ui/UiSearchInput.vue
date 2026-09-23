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
    <SearchIcon class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
    <input
      v-model="draft"
      type="search"
      :placeholder="placeholder"
      :aria-label="label"
      autocomplete="off"
      enterkeyhint="search"
      class="h-10 w-full rounded-full border border-line bg-surface pr-10 pl-10 text-body text-ink shadow-card transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-subtle hover:border-line-strong focus:border-accent/60 focus:shadow-[0_0_0_3px_var(--c-accent-soft)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
    />
    <button
      v-if="draft"
      type="button"
      class="pressable absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-hover hover:text-ink"
      aria-label="Clear search"
      @click="clear"
    >
      <XIcon class="size-4" />
    </button>
  </div>
</template>
