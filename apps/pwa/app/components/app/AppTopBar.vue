<script setup lang="ts">
import { ArrowLeftIcon, ChevronRightIcon, SearchIcon } from 'lucide-vue-next'

/** Desktop top bar: where you are, a global programme search (press "/") and the main action. */
const route = useRoute()
const router = useRouter()
const crumb = useBreadcrumb()

const section = computed(() => {
  const nav = primaryNav.find((item) => isNavActive(item, route.path))
  if (nav) return { label: nav.label, to: nav.to }
  if (route.path.startsWith('/venues')) return { label: 'Venues', to: '/#venues' }
  if (route.path.startsWith('/styleguide')) return { label: 'Styleguide', to: '/styleguide' }
  return null
})

// The programme page has its own search box, so the global one steps aside there.
const showSearch = computed(() => route.path.replace(/\/$/, '') !== '/programme')

const query = ref('')
const input = useTemplateRef<HTMLInputElement>('input')

function isTyping(event: KeyboardEvent) {
  const el = event.target as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

onKeyStroke('/', (event) => {
  if (!showSearch.value || isTyping(event)) return
  event.preventDefault()
  input.value?.focus()
})

async function submit() {
  const q = query.value.trim()
  await navigateTo({ path: '/programme', query: q ? { view: 'films', q } : {} })
  query.value = ''
  input.value?.blur()
}

function back() {
  if (window.history.state?.back) router.back()
  else navigateTo(section.value?.to ?? '/')
}
</script>

<template>
  <header class="pt-safe sticky top-0 z-40 hidden border-b border-line bg-chrome backdrop-blur-xl md:block">
    <div class="mx-auto flex h-16 max-w-6xl items-center gap-4 px-8">
      <nav aria-label="Breadcrumb" class="flex min-w-0 items-center gap-1.5 text-sm">
        <button
          v-if="crumb"
          type="button"
          class="-ml-2 grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-raised hover:text-ink"
          aria-label="Back"
          @click="back"
        >
          <ArrowLeftIcon class="size-4.5" />
        </button>
        <NuxtLink
          v-if="section"
          :to="section.to"
          class="shrink-0 font-semibold"
          :class="crumb ? 'text-muted hover:text-ink' : 'text-ink'"
          :aria-current="crumb ? undefined : 'page'"
        >
          {{ section.label }}
        </NuxtLink>
        <template v-if="crumb">
          <ChevronRightIcon class="size-4 shrink-0 text-subtle" aria-hidden="true" />
          <span class="truncate font-semibold" aria-current="page">{{ crumb }}</span>
        </template>
      </nav>

      <form v-if="showSearch" role="search" class="relative ml-auto w-full max-w-xs" @submit.prevent="submit">
        <SearchIcon class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          ref="input"
          v-model="query"
          type="search"
          placeholder="Search the programme"
          aria-label="Search the programme"
          aria-keyshortcuts="/"
          autocomplete="off"
          class="h-10 w-full rounded-full border border-line bg-surface pr-10 pl-10 text-sm text-ink placeholder:text-subtle focus:border-line-strong focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          @keydown.esc="input?.blur()"
        />
        <kbd
          class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-md border border-line px-1.5 font-sans text-xs text-subtle"
          aria-hidden="true"
        >
          /
        </kbd>
      </form>
      <div v-else class="ml-auto" />

      <UiButton to="/passes" size="sm">Get passes</UiButton>
    </div>
  </header>
</template>
