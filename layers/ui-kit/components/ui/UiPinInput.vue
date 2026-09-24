<script setup lang="ts">
import { EyeIcon, EyeOffIcon } from 'lucide-vue-next'
import { ref, useId, watch } from 'vue'

const props = withDefaults(defineProps<{
  label: string
  error?: string
  disabled?: boolean
  autocomplete?: string
}>(), { autocomplete: 'current-password' })

const model = defineModel<string>({ default: '' })
const id = useId()
const digits = ref<string[]>(Array.from({ length: 6 }, (_, index) => model.value[index] ?? ''))
const inputs = ref<HTMLInputElement[]>([])
const revealed = ref(false)

watch(model, (value) => {
  if (value !== digits.value.join('')) {
    digits.value = Array.from({ length: 6 }, (_, index) => value[index] ?? '')
  }
})

function focus(index: number) {
  inputs.value[Math.max(0, Math.min(5, index))]?.focus()
}

function write(value: string, index: number) {
  if (props.disabled) return
  const numbers = value.replace(/\D/g, '')
  if (!numbers) return
  // Password managers may fill the entire PIN into any focused box.
  const start = numbers.length >= 6 ? 0 : index
  for (const [offset, digit] of [...numbers.slice(0, 6 - start)].entries()) {
    digits.value[start + offset] = digit
  }
  model.value = digits.value.join('')
  focus(start + Math.min(numbers.length, 6 - start))
}

function onInput(event: Event, index: number) {
  const input = event.target as HTMLInputElement
  if (!input.value) {
    digits.value[index] = ''
    model.value = digits.value.join('')
  }
  else write(input.value, index)
  input.value = digits.value[index] ?? ''
}

function onKeydown(event: KeyboardEvent, index: number) {
  if (props.disabled) return
  if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault()
    const target = event.key === 'Backspace' && !digits.value[index] ? Math.max(0, index - 1) : index
    digits.value[target] = ''
    model.value = digits.value.join('')
    focus(target)
  }
  else if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault()
    focus(event.key === 'Home' ? 0 : event.key === 'End' ? 5 : index + (event.key === 'ArrowLeft' ? -1 : 1))
  }
}
</script>

<template>
  <div role="group" :aria-labelledby="`${id}-label`" :aria-describedby="error ? `${id}-error` : undefined">
    <div class="flex items-center justify-between">
      <label :id="`${id}-label`" :for="`${id}-0`" class="text-meta font-medium">{{ label }}</label>
      <button
        type="button"
        class="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-meta text-muted hover:text-ink disabled:opacity-60"
        :disabled="disabled"
        :aria-label="revealed ? 'Hide PIN' : 'Show PIN'"
        :aria-pressed="revealed"
        @click="revealed = !revealed"
      >
        <EyeOffIcon v-if="revealed" class="size-4" aria-hidden="true" />
        <EyeIcon v-else class="size-4" aria-hidden="true" />
        {{ revealed ? 'Hide' : 'Show' }}
      </button>
    </div>
    <div class="grid grid-cols-6 gap-2">
      <input
        v-for="(_, index) in digits"
        :id="`${id}-${index}`"
        :key="index"
        ref="inputs"
        :value="digits[index]"
        :type="revealed ? 'text' : 'password'"
        inputmode="numeric"
        pattern="[0-9]*"
        :autocomplete="index === 0 ? autocomplete : 'off'"
        :name="index === 0 ? 'pin' : undefined"
        :aria-label="`${label}, digit ${index + 1} of 6`"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error ? `${id}-error` : undefined"
        :disabled="disabled"
        class="h-12 w-full min-w-0 rounded-tile border bg-surface text-center font-display text-h2 font-semibold text-ink shadow-card tabular-nums transition-[border-color,box-shadow] focus:outline-none disabled:opacity-60"
        :class="error
          ? 'border-danger focus:shadow-[0_0_0_3px_var(--c-danger-soft)]'
          : 'border-line hover:border-line-strong focus:border-accent/60 focus:shadow-[0_0_0_3px_var(--c-accent-soft)]'"
        @focus="($event.target as HTMLInputElement).select()"
        @click="($event.target as HTMLInputElement).select()"
        @input="onInput($event, index)"
        @keydown="onKeydown($event, index)"
        @paste.prevent="write($event.clipboardData?.getData('text') ?? '', index)"
      >
    </div>
    <p v-if="error" :id="`${id}-error`" role="alert" class="mt-1.5 text-meta text-danger">{{ error }}</p>
  </div>
</template>
