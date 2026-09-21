<script setup lang="ts">
defineProps<{ supportEmail?: string; compact?: boolean }>()
</script>

<template>
  <section
    aria-labelledby="about-title"
    class="flex flex-col items-center gap-6 rounded-card border border-line bg-surface text-center"
    :class="compact ? 'px-5 py-6' : 'px-6 py-10 md:flex-row md:gap-10 md:px-12 md:text-left'"
  >
    <BrandLockup :emblem-size="compact ? 56 : 80" class="text-ink" />
    <div class="max-w-xl">
      <h2 id="about-title" class="font-display font-semibold tracking-tight" :class="compact ? 'text-lg' : 'text-2xl'">About AFRIFF</h2>
      <p class="mt-2 text-muted" :class="compact && 'text-sm'">
        The Africa International Film Festival brings filmmakers, industry and audiences together in Lagos every
        November — screenings, masterclasses, the AFRIFF Film &amp; Content Market and the Globe Awards.
      </p>
      <p v-if="supportEmail" class="mt-3 text-sm text-muted">
        Questions about tickets?
        <a :href="`mailto:${supportEmail}`" class="font-semibold text-accent-ink hover:underline">{{ supportEmail }}</a>
      </p>
    </div>
  </section>
</template>
