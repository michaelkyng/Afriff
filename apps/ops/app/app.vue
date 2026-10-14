<script setup lang="ts">
// Follows the system's light or dark setting as it changes through the day.
const scheme = usePreferredColorScheme()
useHead({
  titleTemplate: (title) => (title ? `${title} · AFRIFF Ops` : 'AFRIFF Ops'),
  htmlAttrs: { 'data-theme': () => (scheme.value === 'light' ? 'light' : 'dark') },
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <OpsToasts />
</template>
