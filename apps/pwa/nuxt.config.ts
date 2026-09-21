// AFRIFF Attendee PWA — frontend-only, fully local build.
// SPA mode (ssr: false) keeps everything in the browser so the app works offline
// and the mock API can persist to localStorage. Revisit when the real backend lands
// (public pages like film detail may benefit from prerendering for SEO).
export default defineNuxtConfig({
  extends: ['@afriff/ui-kit'],
  compatibilityDate: '2026-09-01',
  ssr: false,
  devtools: { enabled: true },

  modules: [
    '@pinia/nuxt',
    'pinia-plugin-persistedstate/nuxt',
    '@vueuse/nuxt',
    '@vite-pwa/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  // App and layer components retain their existing filename-based names.
  components: [{ path: '~/components', pathPrefix: false, extensions: ['vue'] }],

  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'Programme, passes and tickets for the Africa International Film Festival.' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'AFRIFF' },
      ],
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
      script: [
        {
          // Apply the saved theme before first paint to avoid a light/dark flash.
          // Reads the persisted prefs store (key `afriff:prefs`).
          innerHTML: `(function(){var t='dark';try{var p=JSON.parse(localStorage.getItem('afriff:prefs')||'{}');t=p.theme||'system';if(t==='system'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}}catch(e){}document.documentElement.setAttribute('data-theme',t)})()`,
          tagPosition: 'head',
        },
      ],
    },
  },

  runtimeConfig: {
    public: {
      // 'mock' today. An 'http' adapter implementing the same contract comes with the backend.
      apiMode: 'mock',
      // Simulated network latency for the mock API, in ms (0 to disable).
      mockLatency: 450,
    },
  },

  piniaPluginPersistedstate: {
    storage: 'localStorage',
    key: 'afriff:%id',
  },

  pwa: {
    registerType: 'prompt',
    manifest: {
      id: '/',
      name: 'AFRIFF — Africa International Film Festival',
      short_name: 'AFRIFF',
      description: 'Programme, passes and tickets for the Africa International Film Festival.',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#060A26',
      theme_color: '#060A26',
      categories: ['entertainment', 'events'],
      icons: [
        { src: '/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,webp,svg,ico,woff2,webmanifest}'],
      globIgnores: [
        // SPA mode: every route's HTML is the same shell, so only the root index.html is
        // precached and navigateFallback serves it for all routes.
        '200.html',
        '404.html',
        '*/**/index.html',
        // Skip font subsets the app doesn't need offline (Vietnamese stays: it covers Yoruba ẹ/ọ).
        '**/*-cyrillic*',
        '**/*-greek*',
      ],
      cleanupOutdatedCaches: true,
    },
    client: {
      installPrompt: true,
      periodicSyncForUpdates: 60 * 60,
    },
    devOptions: {
      // Flip to true to debug the service worker during `bun run dev`.
      enabled: false,
      type: 'module',
      navigateFallback: '/',
    },
  },
})
