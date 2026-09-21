import { fileURLToPath } from 'node:url'
import { defineNuxtConfig } from 'nuxt/config'
import tailwindcss from '@tailwindcss/vite'

/** Shared branding and controls; each app owns rendering, routing and PWA settings. */
export default defineNuxtConfig({
  vite: {
    plugins: [tailwindcss()],
  },
  // Local fonts work offline. Tokens must be imported into the app's Tailwind root.
  css: [
    '@fontsource-variable/onest',
    '@fontsource-variable/archivo',
    '@fontsource-variable/archivo/wght-italic.css',
  ],
  components: [{
    path: fileURLToPath(new URL('./components', import.meta.url)),
    pathPrefix: false,
    extensions: ['vue'],
  }],
  // Nuxt serves this layer's public directory at the same URLs in every app.
})
