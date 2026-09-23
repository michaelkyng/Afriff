<script setup lang="ts">
import { onMounted, useId, useTemplateRef, watch } from 'vue'
import { useScrollLock } from '@vueuse/core'
import { XIcon } from 'lucide-vue-next'

/**
 * Modal sheet built on the native <dialog>: focus is trapped, Esc closes it and the
 * page behind is inert. Slides up from the bottom on phones; a drawer from the right on larger screens.
 */
defineProps<{ title: string }>()
const open = defineModel<boolean>('open', { default: false })

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const titleId = useId()
const locked = useScrollLock(typeof document === 'undefined' ? null : document.body)

watch(
  open,
  (value) => {
    const el = dialog.value
    if (!el) return
    if (value && !el.open) el.showModal()
    if (!value && el.open) el.close()
    locked.value = value
  },
  { flush: 'post' },
)

onMounted(() => {
  if (open.value) {
    dialog.value?.showModal()
    locked.value = true
  }
})

function onBackdropClick(event: MouseEvent) {
  if (event.target === dialog.value) open.value = false
}

</script>

<template>
  <dialog
    ref="dialog"
    :aria-labelledby="titleId"
    class="ui-sheet m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-hidden rounded-t-[1.5rem] border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-scrim md:mt-0 md:mr-0 md:ml-auto md:h-dvh md:max-h-none md:w-[26rem] md:max-w-[90vw] md:rounded-none md:rounded-l-[1.5rem] md:border-y-0 md:border-r-0"
    @close="open = false"
    @click="onBackdropClick"
  >
    <div class="flex max-h-[inherit] flex-col md:h-full">
      <header class="flex items-center justify-between gap-4 border-b border-line py-3 pr-3 pl-5">
        <h2 :id="titleId" class="text-h3 font-semibold">{{ title }}</h2>
        <button
          type="button"
          class="pressable grid size-9 place-items-center rounded-full text-muted hover:bg-hover hover:text-ink"
          aria-label="Close"
          @click="open = false"
        >
          <XIcon class="size-5" />
        </button>
      </header>
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
        <slot />
      </div>
      <footer v-if="$slots.footer" class="pb-safe border-t border-line px-5 py-4">
        <slot name="footer" />
      </footer>
    </div>
  </dialog>
</template>
