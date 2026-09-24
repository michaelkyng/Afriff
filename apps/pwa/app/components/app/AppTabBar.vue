<script setup lang="ts">
const route = useRoute()
const cart = useCartStore()
const { unread } = useUpdates()
</script>

<template>
  <nav
    aria-label="Primary"
    class="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-chrome backdrop-blur-xl md:hidden"
  >
    <ul class="mx-auto grid w-full max-w-lg auto-cols-fr grid-flow-col px-2 py-1">
      <li v-for="item in primaryNav" :key="item.to" class="min-w-0">
        <NuxtLink
          :to="item.to"
          :aria-current="isNavActive(item, route.path) ? 'page' : undefined"
          class="group flex h-16 w-full flex-col items-center justify-center gap-1 rounded-xl text-center text-micro font-medium transition-colors"
          :class="isNavActive(item, route.path) ? 'text-accent-ink' : 'text-muted'"
        >
          <span
            class="relative grid h-8 w-14 place-items-center rounded-full transition-[background-color,scale] duration-200 ease-out group-active:scale-95"
            :class="isNavActive(item, route.path) ? 'bg-accent-soft' : 'group-active:bg-raised'"
          >
            <span
              v-if="item.to === '/tickets' && cart.count"
              class="absolute top-0 right-2.5 grid size-4 place-items-center rounded-full bg-accent text-[0.625rem] font-semibold text-on-accent tabular-nums"
              :aria-label="`${cart.count} in cart`"
            >
              {{ cart.count }}
            </span>
            <span
              v-if="item.to === '/me' && unread"
              class="absolute top-0 right-2.5 grid size-4 place-items-center rounded-full bg-accent text-[0.625rem] font-semibold text-on-accent tabular-nums"
              :aria-label="`${unread} unread ${unread === 1 ? 'update' : 'updates'}`"
            >
              {{ unread }}
            </span>
            <component
              :is="item.icon"
              class="size-5 shrink-0"
              :stroke-width="isNavActive(item, route.path) ? 2.25 : 1.75"
              aria-hidden="true"
            />
          </span>
          <span class="block whitespace-nowrap leading-4">{{ item.label }}</span>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
