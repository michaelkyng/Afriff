<script setup lang="ts">
defineProps<{ supportEmail?: string; compact?: boolean }>()
</script>

<template>
  <section
    aria-labelledby="about-title"
    class="card flex flex-col items-center gap-5 text-center"
    :class="compact ? 'px-5 py-6' : 'px-6 py-8 md:flex-row md:gap-10 md:px-10 md:text-left'"
  >
    <BrandLockup :emblem-size="compact ? 48 : 72" class="shrink-0 text-ink" />
    <div class="max-w-xl">
      <h2 id="about-title" class="font-semibold" :class="compact ? 'text-h3' : 'font-display text-h2'">About AFRIFF</h2>
      <p class="mt-1.5 text-muted" :class="compact && 'text-meta'">
        The Africa International Film Festival brings filmmakers, industry and audiences together in Lagos every
        November: screenings, masterclasses, the AFRIFF Film &amp; Content Market and the Globe Awards.
      </p>
      <p v-if="supportEmail" class="mt-3 text-meta text-muted">
        Questions about tickets?
        <a :href="`mailto:${supportEmail}`" class="font-medium text-ink underline decoration-line-strong hover:decoration-current">{{
          supportEmail
        }}</a>
      </p>
    </div>
  </section>
</template>
