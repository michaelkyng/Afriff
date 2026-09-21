<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    /** Renders a NuxtLink when set. */
    to?: RouteLocationRaw
    type?: 'button' | 'submit' | 'reset'
    block?: boolean
    loading?: boolean
    disabled?: boolean
  }>(),
  { variant: 'primary', size: 'md', type: 'button', to: undefined },
)

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover shadow-[0_8px_24px_-12px_var(--c-accent)]',
  secondary: 'bg-raised text-ink border border-line hover:border-line-strong',
  ghost: 'text-ink hover:bg-raised',
  danger: 'bg-danger-soft text-danger hover:bg-danger hover:text-white',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 [&_svg]:size-4',
  md: 'h-11 px-5 text-[0.9375rem] gap-2 [&_svg]:size-[1.125rem]',
  lg: 'h-13 px-6 text-base gap-2.5 [&_svg]:size-5',
}

const classes = computed(() => [
  'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-[-0.01em] whitespace-nowrap',
  'transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97]',
  'disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45',
  variants[props.variant],
  sizes[props.size],
  props.block && 'w-full',
])
</script>

<template>
  <NuxtLink v-if="to" :to="to" :class="classes" :aria-disabled="disabled || undefined">
    <slot />
  </NuxtLink>
  <button v-else :type="type" :class="classes" :disabled="disabled || loading" :aria-busy="loading || undefined">
    <span
      v-if="loading"
      class="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
      aria-hidden="true"
    />
    <slot />
  </button>
</template>
