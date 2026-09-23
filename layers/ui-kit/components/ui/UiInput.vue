<script setup lang="ts">
import { EyeIcon, EyeOffIcon } from 'lucide-vue-next'
import { computed, onMounted, ref, useId, useTemplateRef } from 'vue'

/** Labelled text field with hint and error text. Errors are announced to screen readers. */
const props = withDefaults(
  defineProps<{
    label: string
    type?: 'text' | 'email' | 'tel' | 'password'
    hint?: string
    error?: string
    placeholder?: string
    autocomplete?: string
    inputmode?: 'text' | 'email' | 'tel' | 'numeric'
    maxlength?: number
    name?: string
    disabled?: boolean
    /** Centres and spaces the text, for codes and PINs. */
    code?: boolean
    /** Adds a show/hide button, for a PIN the attendee may want to check before submitting. */
    reveal?: boolean
    /** What that button calls the value, e.g. "Show PIN". The field label rarely reads well there. */
    revealLabel?: string
    /** Hides the label visually; it still labels the field. */
    hideLabel?: boolean
    /** Focuses the field once it is on screen. */
    autofocus?: boolean
  }>(),
  { type: 'text', revealLabel: 'value' },
)

const model = defineModel<string>({ default: '' })
const id = useId()
const input = useTemplateRef<HTMLInputElement>('input')

onMounted(() => {
  if (props.autofocus) input.value?.focus()
})

const revealed = ref(false)
const resolvedType = computed(() => (props.reveal && revealed.value ? 'text' : props.type))

const describedBy = computed(() => {
  const ids = [props.error ? `${id}-error` : null, props.hint ? `${id}-hint` : null].filter(Boolean)
  return ids.length ? ids.join(' ') : undefined
})
</script>

<template>
  <div>
    <label :for="id" class="block text-meta font-medium" :class="hideLabel && 'sr-only'">{{ label }}</label>
    <div class="relative mt-1.5">
      <input
        :id="id"
        ref="input"
        v-model="model"
        :type="resolvedType"
        :name="name"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        :inputmode="inputmode"
        :maxlength="maxlength"
        :disabled="disabled"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        class="h-11 w-full rounded-tile border bg-surface px-3.5 text-ink shadow-card transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-subtle focus:outline-none disabled:opacity-60"
        :class="[
          error
            ? 'border-danger focus:shadow-[0_0_0_3px_var(--c-danger-soft)]'
            : 'border-line hover:border-line-strong focus:border-accent/60 focus:shadow-[0_0_0_3px_var(--c-accent-soft)]',
          code && 'text-center font-display text-h2 font-semibold tracking-[0.35em] tabular-nums',
          // Pad both sides when centred, so the toggle does not shove the digits off-centre.
          reveal && (code ? 'px-11' : 'pr-11'),
        ]"
      >
      <!-- Keyboard-reachable on purpose: checking a PIN before submitting should not need a mouse. -->
      <button
        v-if="reveal"
        type="button"
        class="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-tile text-muted transition-colors hover:text-ink focus-visible:[outline-offset:-3px] disabled:opacity-60"
        :disabled="disabled"
        :aria-label="revealed ? `Hide ${revealLabel}` : `Show ${revealLabel}`"
        :aria-pressed="revealed"
        @click="revealed = !revealed"
      >
        <EyeOffIcon v-if="revealed" class="size-4.5" aria-hidden="true" />
        <EyeIcon v-else class="size-4.5" aria-hidden="true" />
      </button>
    </div>
    <p v-if="error" :id="`${id}-error`" role="alert" class="mt-1.5 text-meta text-danger">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-hint`" class="mt-1.5 text-meta text-muted">{{ hint }}</p>
  </div>
</template>
