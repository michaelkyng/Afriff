<script setup lang="ts">
/** Phone header. Tablets and laptops use AppSidebar + AppTopBar. */
const { data: festival } = useFestival()

const dates = computed(() =>
  festival.value ? formatDateRange(festival.value.startsAt, festival.value.endsAt) : '',
)
</script>

<template>
  <header class="pt-safe sticky top-0 z-40 border-b border-line bg-chrome backdrop-blur-xl md:hidden">
    <div class="flex h-14 items-center gap-4 px-4">
      <NuxtLink to="/" aria-label="AFRIFF home" class="rounded-lg">
        <AppLogo />
      </NuxtLink>
      <span v-if="dates" class="ml-auto text-xs font-medium text-muted">{{ dates }} · Lagos</span>
    </div>
  </header>
</template>
