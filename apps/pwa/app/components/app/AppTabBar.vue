<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <nav
    aria-label="Primary"
    class="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-chrome backdrop-blur-xl md:hidden"
  >
    <ul class="mx-auto grid max-w-lg grid-cols-5">
      <li v-for="item in primaryNav" :key="item.to">
        <NuxtLink
          :to="item.to"
          :aria-current="isNavActive(item, route.path) ? 'page' : undefined"
          class="group flex flex-col items-center gap-1 pt-2 pb-2.5 text-[0.6875rem] font-semibold transition-colors"
          :class="isNavActive(item, route.path) ? 'text-accent-ink' : 'text-muted'"
        >
          <span
            class="grid h-8 w-14 place-items-center rounded-full transition-colors duration-200"
            :class="isNavActive(item, route.path) ? 'bg-accent-soft' : 'group-active:bg-raised'"
          >
            <component
              :is="item.icon"
              class="size-5"
              :stroke-width="isNavActive(item, route.path) ? 2.25 : 1.75"
              aria-hidden="true"
            />
          </span>
          {{ item.label }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
