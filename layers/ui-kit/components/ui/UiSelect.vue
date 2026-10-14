<script setup lang="ts" generic="T extends string">
import { ChevronDownIcon } from 'lucide-vue-next'
import { computed, useId } from 'vue'

/** A labelled native select, styled like `UiInput`, so the keyboard and screen readers get the real thing. */
const props = defineProps<{
  label: string
  options: { value: T; label: string }[]
  hint?: string
  error?: string
  disabled?: boolean
  /** Shown first, with no value: "Choose a screen". */
  placeholder?: string
}>()

const model = defineModel<T | ''>({ default: '' })
const id = useId()
const describedBy = computed(() => [props.error ? `${id}-error` : null, props.hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined)
</script>

<template>
  <div>
    <label :for="id" class="block text-meta font-medium">{{ label }}</label>
    <div class="relative mt-1.5">
      <select
        :id="id"
        v-model="model"
        :disabled="disabled"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        class="h-11 w-full appearance-none rounded-tile border bg-surface pr-10 pl-3.5 text-ink shadow-card transition-[border-color,box-shadow] duration-150 ease-out focus:outline-none disabled:opacity-60"
        :class="error ? 'border-danger' : 'border-line hover:border-line-strong focus:border-accent/60 focus:shadow-[0_0_0_3px_var(--c-accent-soft)]'"
      >
        <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
        <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
      <ChevronDownIcon class="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
    </div>
    <p v-if="error" :id="`${id}-error`" role="alert" class="mt-1.5 text-meta text-danger">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-hint`" class="mt-1.5 text-meta text-muted">{{ hint }}</p>
  </div>
</template>
