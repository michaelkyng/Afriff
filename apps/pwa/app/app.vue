<script setup lang="ts">
const { resolved } = useTheme()

useHead({
  titleTemplate: (title) => (title ? `${title} · AFRIFF` : 'AFRIFF — Africa International Film Festival'),
  htmlAttrs: { 'data-theme': resolved },
  meta: [{ name: 'theme-color', content: () => THEME_COLORS[resolved.value] }],
})
</script>

<template>
  <NuxtPwaManifest />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
