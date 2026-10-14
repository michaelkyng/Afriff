<script setup lang="ts">
import { CalendarClockIcon, HistoryIcon, LayoutDashboardIcon, LogOutIcon, MegaphoneIcon, ReceiptIcon, TagIcon, UsersIcon } from 'lucide-vue-next'

/** Sidebar on wide screens, a scrolling tab row on narrow ones. */
const { staff, signOut } = useStaff()
const route = useRoute()

const nav = [
  { to: '/', label: 'Overview', icon: LayoutDashboardIcon },
  { to: '/programme', label: 'Programme', icon: CalendarClockIcon },
  { to: '/updates', label: 'Updates', icon: MegaphoneIcon },
  { to: '/orders', label: 'Orders', icon: ReceiptIcon },
  { to: '/products', label: 'Products', icon: TagIcon },
  { to: '/staff', label: 'Staff', icon: UsersIcon },
  { to: '/activity', label: 'Activity', icon: HistoryIcon },
]

const active = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))
</script>

<template>
  <div class="min-h-dvh lg:flex">
    <a href="#main" class="sr-only z-[60] rounded-full bg-accent px-4 py-2 font-semibold text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
      Skip to content
    </a>

    <aside class="hidden w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex lg:h-dvh lg:sticky lg:top-0">
      <div class="flex items-center gap-2.5 px-5 py-5">
        <BrandEmblem :size="30" />
        <span class="font-display text-h3 font-semibold">Ops</span>
      </div>
      <nav class="flex-1 space-y-0.5 px-3" aria-label="Ops">
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-tile px-3 py-2 text-meta font-medium transition-colors"
          :class="active(item.to) ? 'bg-raised text-ink' : 'text-muted hover:bg-hover hover:text-ink'"
          :aria-current="active(item.to) ? 'page' : undefined"
        >
          <component :is="item.icon" class="size-4.5 shrink-0" aria-hidden="true" />
          {{ item.label }}
        </NuxtLink>
      </nav>
      <div class="border-t border-line px-4 py-4">
        <p class="truncate text-meta font-semibold">{{ staff?.name }}</p>
        <p class="truncate text-label text-muted">{{ staff?.email }} · {{ staff?.role }}</p>
        <UiButton size="sm" variant="ghost" class="mt-2 -ml-2" @click="signOut">
          <LogOutIcon aria-hidden="true" />
          Sign out
        </UiButton>
      </div>
    </aside>

    <header class="sticky top-0 z-30 border-b border-line bg-chrome backdrop-blur-md lg:hidden">
      <div class="flex items-center gap-2.5 px-4 py-3">
        <BrandEmblem :size="26" />
        <span class="flex-1 font-display text-h3 font-semibold">Ops</span>
        <UiButton size="sm" variant="ghost" aria-label="Sign out" @click="signOut"><LogOutIcon aria-hidden="true" /></UiButton>
      </div>
      <nav class="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Ops">
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="shrink-0 rounded-full px-3 py-1.5 text-meta font-medium"
          :class="active(item.to) ? 'bg-ink text-canvas' : 'text-muted hover:text-ink'"
          :aria-current="active(item.to) ? 'page' : undefined"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>
    </header>

    <main id="main" class="mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
      <slot />
    </main>
  </div>
</template>
