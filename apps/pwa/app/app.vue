<script setup lang="ts">
const { resolved } = useTheme()
const session = useSessionStore()
// Use the router's current route: Nuxt's useRoute waits for NuxtPage to render.
const route = useRouter().currentRoute
const canAccess = computed(() => session.isSignedIn || isAuthRoute(route.value.path))

// A cleared session also closes the current page without waiting for navigation.
watch(() => session.isSignedIn, (signedIn) => {
  if (!signedIn && !isAuthRoute(route.value.path)) {
    navigateTo({ path: '/signin', query: { redirect: route.value.fullPath } }, { replace: true })
  }
})

useHead({
  titleTemplate: (title) => (title ? `${title} · AFRIFF` : 'AFRIFF · Africa International Film Festival'),
  htmlAttrs: { 'data-theme': resolved },
  meta: [{ name: 'theme-color', content: () => THEME_COLORS[resolved.value] }],
})
</script>

<template>
  <NuxtPwaManifest />
  <NuxtLayout v-if="canAccess">
    <NuxtPage />
  </NuxtLayout>
</template>
