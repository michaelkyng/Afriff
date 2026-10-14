<script setup lang="ts">
import { computed, useId } from 'vue'

/** A labelled multi-line field, styled like `UiInput`, with an optional character count against a limit. */
const props = withDefaults(
  defineProps<{ label: string; hint?: string; error?: string; disabled?: boolean; rows?: number; maxlength?: number; placeholder?: string }>(),
  { rows: 4 },
)

const model = defineModel<string>({ default: '' })
const id = useId()
const describedBy = computed(() => [props.error ? `${id}-error` : null, props.hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined)
</script>

<template>
  <div>
    <div class="flex items-baseline justify-between gap-3">
      <label :for="id" class="block text-meta font-medium">{{ label }}</label>
      <span v-if="maxlength" class="text-label text-muted tabular-nums" aria-hidden="true">{{ model.length }} / {{ maxlength }}</span>
    </div>
    <textarea
      :id="id"
      v-model="model"
      :rows="rows"
      :maxlength="maxlength"
      :placeholder="placeholder"
      :disabled="disabled"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="describedBy"
      class="mt-1.5 block w-full resize-y rounded-tile border bg-surface px-3.5 py-2.5 leading-relaxed text-ink shadow-card transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-subtle focus:outline-none disabled:opacity-60"
      :class="error ? 'border-danger' : 'border-line hover:border-line-strong focus:border-accent/60 focus:shadow-[0_0_0_3px_var(--c-accent-soft)]'"
    />
    <p v-if="error" :id="`${id}-error`" role="alert" class="mt-1.5 text-meta text-danger">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-hint`" class="mt-1.5 text-meta text-muted">{{ hint }}</p>
  </div>
</template>
